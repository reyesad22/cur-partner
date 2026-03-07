import { useState, useEffect, useRef, useCallback } from "react";
import { useParams, useNavigate, Link } from "react-router-dom";
import { api } from "@/App";
import { Button } from "@/components/ui/button";
import { Slider } from "@/components/ui/slider";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import {
  Mic,
  MicOff,
  ArrowLeft,
  Play,
  Pause,
  RotateCcw,
  Settings,
  ChevronUp,
  ChevronDown,
  Volume2,
  Loader2,
  X,
  VolumeX,
  SkipForward,
  Square
} from "lucide-react";
import { toast } from "sonner";

const Reader = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  
  // Project data
  const [project, setProject] = useState(null);
  const [lines, setLines] = useState([]);
  const [loading, setLoading] = useState(true);
  
  // Rehearsal state
  const [rehearsalStarted, setRehearsalStarted] = useState(false);
  const [currentLineIndex, setCurrentLineIndex] = useState(0);
  const [isListening, setIsListening] = useState(false);
  const [isPlaying, setIsPlaying] = useState(false);
  const [transcript, setTranscript] = useState("");
  const [isAudioPlaying, setIsAudioPlaying] = useState(false);
  
  // Settings
  const [fontSize, setFontSize] = useState(28);
  const [showSettings, setShowSettings] = useState(false);
  const [autoAdvance, setAutoAdvance] = useState(true);
  const [isMuted, setIsMuted] = useState(false);
  
  // Refs
  const recognitionRef = useRef(null);
  const lineRefs = useRef([]);
  const containerRef = useRef(null);
  const audioRef = useRef(null);

  useEffect(() => {
    fetchReaderData();
    return () => {
      if (recognitionRef.current) {
        try { recognitionRef.current.stop(); } catch (e) {}
      }
      if (audioRef.current) {
        audioRef.current.pause();
      }
    };
  }, [id]);

  // Auto-scroll to current line
  useEffect(() => {
    if (rehearsalStarted && lineRefs.current[currentLineIndex]) {
      lineRefs.current[currentLineIndex].scrollIntoView({
        behavior: 'smooth',
        block: 'center'
      });
    }
  }, [currentLineIndex, rehearsalStarted]);

  // Auto-play audio for cue lines when rehearsal is active
  useEffect(() => {
    if (rehearsalStarted && !isMuted && lines[currentLineIndex]) {
      const currentLine = lines[currentLineIndex];
      
      // If it's a cue line (not user's line) and has audio, play it
      if (!currentLine.is_user_line && currentLine.audio_url) {
        playLineAudio(currentLine.audio_url);
      } else if (currentLine.is_user_line) {
        // It's user's turn - start listening
        startListening();
      }
    }
  }, [currentLineIndex, rehearsalStarted, isMuted, lines]);

  const playLineAudio = async (audioUrl) => {
    if (!audioUrl) return;
    
    // Stop any existing audio
    if (audioRef.current) {
      audioRef.current.pause();
      audioRef.current = null;
    }
    
    // Stop listening while audio plays
    stopListening();
    setIsAudioPlaying(true);
    
    try {
      const audio = new Audio(audioUrl);
      audioRef.current = audio;
      
      audio.onended = () => {
        setIsAudioPlaying(false);
        // Auto-advance to next line after audio ends
        if (autoAdvance && currentLineIndex < lines.length - 1) {
          setCurrentLineIndex(prev => prev + 1);
        }
      };
      
      audio.onerror = (e) => {
        console.error("Audio playback error:", e);
        setIsAudioPlaying(false);
        toast.error("Failed to play audio");
      };
      
      await audio.play();
    } catch (e) {
      console.error("Audio play failed:", e);
      setIsAudioPlaying(false);
      // On mobile, autoplay might be blocked - show message
      toast.error("Tap the play button to hear the line");
    }
  };

  const fetchReaderData = async () => {
    try {
      const response = await api.get(`/projects/${id}/reader-data`);
      setProject(response.data);
      
      // Flatten all lines from all scenes
      const allLines = response.data.scenes.reduce((acc, scene) => {
        return [...acc, ...scene.lines];
      }, []);
      setLines(allLines);
    } catch (error) {
      toast.error("Failed to load reader data");
      navigate("/dashboard");
    } finally {
      setLoading(false);
    }
  };

  const startListening = () => {
    if (!('webkitSpeechRecognition' in window) && !('SpeechRecognition' in window)) {
      return;
    }
    
    if (recognitionRef.current) {
      try { recognitionRef.current.stop(); } catch (e) {}
    }
    
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    const recognition = new SpeechRecognition();
    
    recognition.continuous = true;
    recognition.interimResults = true;
    recognition.lang = 'en-US';

    recognition.onresult = (event) => {
      let currentTranscript = '';
      for (let i = event.resultIndex; i < event.results.length; i++) {
        currentTranscript += event.results[i][0].transcript;
      }
      
      setTranscript(currentTranscript.toLowerCase().trim());
      
      // Check if user said enough of their line
      if (lines[currentLineIndex]?.is_user_line) {
        const match = fuzzyMatch(currentTranscript.toLowerCase(), lines[currentLineIndex].text.toLowerCase());
        if (match) {
          // User completed their line - move to next
          handleNextLine();
        }
      }
    };

    recognition.onerror = (event) => {
      console.log("Speech recognition error:", event.error);
      if (event.error !== 'no-speech') {
        setIsListening(false);
      }
    };

    recognition.onend = () => {
      // Restart if still supposed to be listening
      if (isListening && rehearsalStarted && lines[currentLineIndex]?.is_user_line) {
        try { recognition.start(); } catch (e) {}
      }
    };

    recognitionRef.current = recognition;
    try {
      recognition.start();
      setIsListening(true);
    } catch (e) {
      console.error("Failed to start speech recognition:", e);
    }
  };

  const stopListening = () => {
    if (recognitionRef.current) {
      try { recognitionRef.current.stop(); } catch (e) {}
    }
    setIsListening(false);
  };

  const fuzzyMatch = (spoken, target) => {
    if (!spoken || !target) return false;
    
    const cleanSpoken = spoken.replace(/[^\w\s]/g, '').trim().toLowerCase();
    const cleanTarget = target.replace(/[^\w\s]/g, '').trim().toLowerCase();
    
    if (cleanSpoken.length < 3) return false;
    
    // Get significant words
    const spokenWords = cleanSpoken.split(/\s+/).filter(w => w.length > 2);
    const targetWords = cleanTarget.split(/\s+/).filter(w => w.length > 2);
    
    if (spokenWords.length === 0) return false;
    
    // Count matching words
    let matchedWords = 0;
    const commonWords = ['the', 'and', 'but', 'for', 'are', 'was', 'were', 'have', 'has', 'will', 'would', 'could', 'should', 'can', 'that', 'this', 'with', 'from', 'they', 'them', 'their', 'what', 'when', 'where', 'which', 'who'];
    
    for (const targetWord of targetWords) {
      if (commonWords.includes(targetWord)) continue;
      
      for (const spokenWord of spokenWords) {
        if (targetWord === spokenWord || 
            (targetWord.length >= 4 && spokenWord.startsWith(targetWord.substring(0, 3))) ||
            (spokenWord.length >= 4 && targetWord.startsWith(spokenWord.substring(0, 3)))) {
          matchedWords++;
          break;
        }
      }
    }
    
    // Need at least 1 important word or 25% of words
    return matchedWords >= 1 || matchedWords >= targetWords.length * 0.25;
  };

  const handleNextLine = () => {
    stopListening();
    setTranscript("");
    
    if (currentLineIndex < lines.length - 1) {
      setCurrentLineIndex(prev => prev + 1);
    } else {
      // End of script
      setRehearsalStarted(false);
      toast.success("Scene complete! Great job!");
    }
  };

  const handlePrevLine = () => {
    if (currentLineIndex > 0) {
      stopListening();
      if (audioRef.current) audioRef.current.pause();
      setCurrentLineIndex(prev => prev - 1);
      setTranscript("");
    }
  };

  const startRehearsal = () => {
    setRehearsalStarted(true);
    setCurrentLineIndex(0);
    setTranscript("");
    toast.success("Rehearsal started! Listen and speak your lines.");
  };

  const stopRehearsal = () => {
    setRehearsalStarted(false);
    stopListening();
    if (audioRef.current) audioRef.current.pause();
    setCurrentLineIndex(0);
    setTranscript("");
  };

  const replayCurrentAudio = () => {
    const currentLine = lines[currentLineIndex];
    if (currentLine?.audio_url && !currentLine.is_user_line) {
      playLineAudio(currentLine.audio_url);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <Loader2 className="w-8 h-8 animate-spin text-purple-400" />
      </div>
    );
  }

  const currentLine = lines[currentLineIndex];
  const userCharacter = project?.user_character;

  // Start Screen (like Actoncue)
  if (!rehearsalStarted) {
    return (
      <div className="min-h-screen bg-background flex flex-col" data-testid="reader-start">
        {/* Header */}
        <header className="border-b border-border bg-card/50">
          <div className="max-w-4xl mx-auto px-4">
            <div className="flex items-center justify-between h-14">
              <Link
                to={`/project/${id}`}
                className="flex items-center gap-2 text-muted-foreground hover:text-foreground"
              >
                <ArrowLeft className="w-5 h-5" />
                <span className="text-sm">Back</span>
              </Link>
              <h1 className="font-semibold">{project?.project_title}</h1>
              <div className="w-16"></div>
            </div>
          </div>
        </header>

        {/* Start Screen Content */}
        <div className="flex-1 flex flex-col items-center justify-center p-6">
          <div className="text-center max-w-md">
            <div className="w-20 h-20 mx-auto mb-6 rounded-full bg-gradient-to-br from-purple-500 to-pink-500 flex items-center justify-center">
              <Mic className="w-10 h-10 text-white" />
            </div>
            
            <h2 className="text-2xl font-bold mb-3">Ready to Rehearse?</h2>
            
            <p className="text-muted-foreground mb-6">
              You're playing <span className="text-purple-400 font-semibold">{userCharacter}</span>.
              <br />
              The AI will read all other characters' lines.
            </p>
            
            <div className="bg-card rounded-lg p-4 mb-6 text-left">
              <h3 className="font-semibold mb-2">Scene Overview</h3>
              <div className="text-sm text-muted-foreground space-y-1">
                <p>{lines.length} lines total</p>
                <p>{lines.filter(l => l.is_user_line).length} of your lines</p>
                <p>{project?.characters?.length || 0} characters</p>
              </div>
            </div>
            
            <Button
              size="lg"
              onClick={startRehearsal}
              className="w-full bg-gradient-to-r from-purple-500 to-pink-500 hover:from-purple-600 hover:to-pink-600 text-lg py-6"
              data-testid="start-rehearsal-btn"
            >
              <Play className="w-6 h-6 mr-2" />
              Start Rehearsal
            </Button>
            
            <p className="text-xs text-muted-foreground mt-4">
              Make sure your microphone is enabled for voice detection
            </p>
          </div>
        </div>
      </div>
    );
  }

  // Active Rehearsal Screen
  return (
    <div className="min-h-screen bg-background flex flex-col" data-testid="reader-active">
      {/* Header */}
      <header className="border-b border-border bg-card/50 shrink-0">
        <div className="max-w-4xl mx-auto px-4">
          <div className="flex items-center justify-between h-12">
            <Button
              variant="ghost"
              size="sm"
              onClick={stopRehearsal}
              className="text-muted-foreground"
            >
              <Square className="w-4 h-4 mr-1" />
              Stop
            </Button>
            
            <div className="flex items-center gap-2">
              <span className="text-sm font-medium">
                {currentLineIndex + 1} / {lines.length}
              </span>
            </div>
            
            <Button
              variant="ghost"
              size="icon"
              onClick={() => setShowSettings(!showSettings)}
            >
              <Settings className="w-5 h-5" />
            </Button>
          </div>
        </div>
      </header>

      {/* Settings Panel */}
      {showSettings && (
        <div className="border-b border-border bg-card p-4 shrink-0">
          <div className="max-w-4xl mx-auto space-y-4">
            <div className="flex items-center justify-between">
              <Label>Font Size</Label>
              <div className="flex items-center gap-2 w-48">
                <Slider
                  value={[fontSize]}
                  onValueChange={([v]) => setFontSize(v)}
                  min={18}
                  max={48}
                  step={2}
                />
                <span className="text-sm w-8">{fontSize}</span>
              </div>
            </div>
            <div className="flex items-center justify-between">
              <Label>Auto-advance after audio</Label>
              <Switch checked={autoAdvance} onCheckedChange={setAutoAdvance} />
            </div>
            <div className="flex items-center justify-between">
              <Label>Mute voices</Label>
              <Switch checked={isMuted} onCheckedChange={setIsMuted} />
            </div>
          </div>
        </div>
      )}

      {/* Script Content */}
      <div className="flex-1 overflow-y-auto" ref={containerRef}>
        <div className="max-w-4xl mx-auto px-4 py-6">
          <div className="space-y-4">
            {lines.map((line, idx) => {
              const isActive = idx === currentLineIndex;
              const isUserLine = line.is_user_line;
              const isCompleted = idx < currentLineIndex;
              
              return (
                <div
                  key={line.id}
                  ref={el => lineRefs.current[idx] = el}
                  className={`
                    p-4 rounded-xl transition-all duration-300 cursor-pointer
                    ${isActive 
                      ? isUserLine 
                        ? 'bg-purple-500/20 border-2 border-purple-500 scale-[1.01]' 
                        : 'bg-secondary border-2 border-muted-foreground/30 scale-[1.01]'
                      : isCompleted
                        ? 'opacity-40'
                        : 'opacity-60'
                    }
                  `}
                  onClick={() => {
                    if (isActive) {
                      handleNextLine();
                    } else {
                      if (audioRef.current) audioRef.current.pause();
                      stopListening();
                      setCurrentLineIndex(idx);
                    }
                  }}
                >
                  <div className="flex items-start gap-3">
                    <div className="shrink-0">
                      <span className={`
                        text-xs font-semibold px-2 py-1 rounded
                        ${isUserLine 
                          ? 'bg-purple-500/30 text-purple-300' 
                          : 'bg-muted text-muted-foreground'
                        }
                      `}>
                        {line.character}
                        {isUserLine && ' (You)'}
                      </span>
                    </div>
                  </div>
                  
                  <p 
                    className={`mt-2 leading-relaxed ${isUserLine ? 'text-purple-100' : ''}`}
                    style={{ fontSize: isActive ? fontSize : fontSize * 0.85 }}
                  >
                    {line.text}
                  </p>
                  
                  {isActive && !isUserLine && line.audio_url && (
                    <div className="mt-2 flex items-center gap-2">
                      {isAudioPlaying ? (
                        <span className="text-xs text-muted-foreground flex items-center gap-1">
                          <Volume2 className="w-3 h-3 animate-pulse" /> Playing...
                        </span>
                      ) : (
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={(e) => {
                            e.stopPropagation();
                            replayCurrentAudio();
                          }}
                          className="text-xs h-7"
                        >
                          <Play className="w-3 h-3 mr-1" /> Replay
                        </Button>
                      )}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {/* Status Bar */}
      <div className="border-t border-border bg-card/80 backdrop-blur shrink-0 safe-area-bottom">
        <div className="max-w-4xl mx-auto px-4 py-3">
          {/* Current status */}
          <div className="text-center mb-3">
            {currentLine?.is_user_line ? (
              <div className="flex items-center justify-center gap-2">
                <div className={`w-3 h-3 rounded-full ${isListening ? 'bg-green-500 animate-pulse' : 'bg-purple-500'}`} />
                <span className="text-sm font-medium text-purple-400">
                  Your turn - speak your line
                </span>
              </div>
            ) : (
              <div className="flex items-center justify-center gap-2">
                <div className={`w-3 h-3 rounded-full ${isAudioPlaying ? 'bg-pink-500 animate-pulse' : 'bg-muted-foreground'}`} />
                <span className="text-sm text-muted-foreground">
                  {isAudioPlaying ? `${currentLine?.character} is speaking...` : 'Waiting...'}
                </span>
              </div>
            )}
          </div>
          
          {/* Transcript (if user is speaking) */}
          {currentLine?.is_user_line && transcript && (
            <div className="bg-secondary/50 rounded-lg px-3 py-2 mb-3 text-center">
              <p className="text-sm text-muted-foreground italic">"{transcript}"</p>
            </div>
          )}
          
          {/* Controls */}
          <div className="flex items-center justify-center gap-3">
            <Button
              variant="outline"
              size="icon"
              onClick={handlePrevLine}
              disabled={currentLineIndex === 0}
              className="w-10 h-10"
            >
              <ChevronUp className="w-5 h-5" />
            </Button>
            
            <Button
              variant="outline"
              size="icon"
              onClick={() => setIsMuted(!isMuted)}
              className="w-10 h-10"
            >
              {isMuted ? <VolumeX className="w-5 h-5" /> : <Volume2 className="w-5 h-5" />}
            </Button>
            
            {currentLine?.is_user_line ? (
              <Button
                size="lg"
                onClick={isListening ? stopListening : startListening}
                className={`w-14 h-14 rounded-full ${isListening ? 'bg-green-500 hover:bg-green-600' : 'bg-purple-500 hover:bg-purple-600'}`}
              >
                {isListening ? <Mic className="w-6 h-6" /> : <MicOff className="w-6 h-6" />}
              </Button>
            ) : (
              <Button
                size="lg"
                onClick={replayCurrentAudio}
                disabled={!currentLine?.audio_url || isAudioPlaying}
                className="w-14 h-14 rounded-full bg-pink-500 hover:bg-pink-600"
              >
                {isAudioPlaying ? <Loader2 className="w-6 h-6 animate-spin" /> : <Play className="w-6 h-6" />}
              </Button>
            )}
            
            <Button
              variant="outline"
              size="icon"
              onClick={handleNextLine}
              className="w-10 h-10"
            >
              <SkipForward className="w-5 h-5" />
            </Button>
            
            <Button
              variant="outline"
              size="icon"
              onClick={handleNextLine}
              disabled={currentLineIndex >= lines.length - 1}
              className="w-10 h-10"
            >
              <ChevronDown className="w-5 h-5" />
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Reader;
