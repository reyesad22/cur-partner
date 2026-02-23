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
  VolumeX
} from "lucide-react";
import { toast } from "sonner";
import Fuse from "fuse.js";

const Reader = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  
  // Project data
  const [project, setProject] = useState(null);
  const [lines, setLines] = useState([]);
  const [loading, setLoading] = useState(true);
  
  // Reader state
  const [currentLineIndex, setCurrentLineIndex] = useState(0);
  const [isListening, setIsListening] = useState(false);
  const [isPlaying, setIsPlaying] = useState(false);
  const [transcript, setTranscript] = useState("");
  
  // Settings
  const [fontSize, setFontSize] = useState(32);
  const [showSettings, setShowSettings] = useState(false);
  const [autoScroll, setAutoScroll] = useState(true);
  const [showDebug, setShowDebug] = useState(false);
  const [sensitivity, setSensitivity] = useState(0.4);
  const [autoPlayAudio, setAutoPlayAudio] = useState(true);
  const [isMuted, setIsMuted] = useState(false);
  
  // Refs
  const recognitionRef = useRef(null);
  const lineRefs = useRef([]);
  const fuseRef = useRef(null);
  const containerRef = useRef(null);
  const audioRef = useRef(null);

  useEffect(() => {
    fetchReaderData();
    return () => {
      if (recognitionRef.current) {
        recognitionRef.current.stop();
      }
    };
  }, [id]);

  // Initialize Fuse.js for fuzzy matching
  useEffect(() => {
    if (lines.length > 0) {
      fuseRef.current = new Fuse(lines.map((l, i) => ({ text: l.text.toLowerCase(), index: i })), {
        keys: ['text'],
        threshold: sensitivity,
        includeScore: true
      });
    }
  }, [lines, sensitivity]);

  // Auto-scroll to current line
  useEffect(() => {
    if (autoScroll && lineRefs.current[currentLineIndex]) {
      lineRefs.current[currentLineIndex].scrollIntoView({
        behavior: 'smooth',
        block: 'center'
      });
    }
  }, [currentLineIndex, autoScroll]);

  // Auto-play audio for cue lines AND auto-advance after audio ends
  useEffect(() => {
    if (autoPlayAudio && !isMuted && lines[currentLineIndex]) {
      const currentLine = lines[currentLineIndex];
      // If it's a cue line (not user's line) and has audio, play it
      if (!currentLine.is_user_line && currentLine.audio_url) {
        playLineAudio(currentLine.audio_url);
      }
    }
  }, [currentLineIndex, autoPlayAudio, isMuted]);

  const playLineAudio = (audioUrl) => {
    if (audioRef.current) {
      audioRef.current.pause();
    }
    const audio = new Audio(audioUrl);
    audioRef.current = audio;
    
    // Auto-advance to next line after audio ends
    audio.onended = () => {
      // Move to next line automatically after cue audio finishes
      if (currentLineIndex < lines.length - 1) {
        setCurrentLineIndex(prev => prev + 1);
        setTranscript("");
      }
    };
    
    audio.play().catch(e => console.log("Audio play failed:", e));
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

  const initSpeechRecognition = useCallback(() => {
    if (!('webkitSpeechRecognition' in window) && !('SpeechRecognition' in window)) {
      toast.error("Speech recognition not supported in this browser");
      return null;
    }

    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    const recognition = new SpeechRecognition();
    
    recognition.continuous = true;
    recognition.interimResults = true;
    recognition.lang = 'en-US';

    recognition.onresult = (event) => {
      let interimTranscript = '';
      let finalTranscript = '';

      for (let i = event.resultIndex; i < event.results.length; i++) {
        const transcript = event.results[i][0].transcript;
        if (event.results[i].isFinal) {
          finalTranscript += transcript;
        } else {
          interimTranscript += transcript;
        }
      }

      const currentTranscript = (finalTranscript || interimTranscript).toLowerCase().trim();
      setTranscript(currentTranscript);

      // Check if the current user line matches
      if (currentLineIndex < lines.length) {
        const currentLine = lines[currentLineIndex];
        
        if (currentLine.is_user_line) {
          // User is speaking their line - check for match
          const lineText = currentLine.text.toLowerCase();
          const match = fuzzyMatch(currentTranscript, lineText);
          
          if (match) {
            // Move to next line
            handleNextLine();
          }
        }
      }
    };

    recognition.onerror = (event) => {
      console.error('Speech recognition error:', event.error);
      if (event.error !== 'no-speech') {
        toast.error(`Recognition error: ${event.error}`);
      }
    };

    recognition.onend = () => {
      // Restart if still supposed to be listening
      if (isListening && isPlaying) {
        recognition.start();
      }
    };

    return recognition;
  }, [currentLineIndex, lines, isListening, isPlaying]);

  const fuzzyMatch = (spoken, target) => {
    if (!spoken || !target) return false;
    
    // Clean both strings - remove punctuation and normalize
    const cleanSpoken = spoken.replace(/[^\w\s]/g, '').trim().toLowerCase();
    const cleanTarget = target.replace(/[^\w\s]/g, '').trim().toLowerCase();
    
    // If spoken text is very short, wait for more
    if (cleanSpoken.length < 3) return false;
    
    // EASY MODE: Check for any significant word matches
    const spokenWords = cleanSpoken.split(/\s+/).filter(w => w.length > 2);
    const targetWords = cleanTarget.split(/\s+/).filter(w => w.length > 2);
    
    if (spokenWords.length === 0) return false;
    
    // Count how many target words appear in spoken text
    let matchedWords = 0;
    let importantWordMatched = false;
    
    for (const targetWord of targetWords) {
      // Skip common words
      if (['the', 'and', 'but', 'for', 'are', 'was', 'were', 'been', 'being', 'have', 'has', 'had', 'will', 'would', 'could', 'should', 'can', 'may', 'might', 'must', 'shall', 'that', 'this', 'with', 'from', 'they', 'them', 'their', 'what', 'when', 'where', 'which', 'who', 'whom', 'whose', 'how', 'why'].includes(targetWord)) {
        continue;
      }
      
      for (const spokenWord of spokenWords) {
        // Exact match
        if (targetWord === spokenWord) {
          matchedWords++;
          if (targetWord.length >= 4) importantWordMatched = true;
          break;
        }
        // Partial match - word starts with same letters
        if (targetWord.length >= 4 && spokenWord.length >= 3) {
          if (targetWord.startsWith(spokenWord.substring(0, 3)) || 
              spokenWord.startsWith(targetWord.substring(0, 3))) {
            matchedWords++;
            break;
          }
        }
        // Contains match
        if (targetWord.length >= 5 && spokenWord.length >= 5) {
          if (targetWord.includes(spokenWord) || spokenWord.includes(targetWord)) {
            matchedWords++;
            break;
          }
        }
      }
    }
    
    // VERY EASY MATCHING:
    // Just need 1 important word (4+ letters) to match
    // OR 2 any words to match
    // OR the spoken text is very similar overall
    
    if (importantWordMatched) return true;
    if (matchedWords >= 2) return true;
    
    // Also check if first few words match (common for actors to start correctly)
    if (spokenWords.length >= 1 && targetWords.length >= 1) {
      const firstSpoken = spokenWords[0];
      const firstTarget = targetWords[0];
      if (firstSpoken === firstTarget || 
          (firstSpoken.length >= 3 && firstTarget.startsWith(firstSpoken.substring(0, 3)))) {
        return true;
      }
    }
    
    return false;
  };

  const handleNextLine = () => {
    if (currentLineIndex < lines.length - 1) {
      setCurrentLineIndex(prev => prev + 1);
      setTranscript("");
    } else {
      // Reached end
      setIsPlaying(false);
      setIsListening(false);
      toast.success("You've completed the script!");
    }
  };

  const handlePrevLine = () => {
    if (currentLineIndex > 0) {
      setCurrentLineIndex(prev => prev - 1);
      setTranscript("");
    }
  };

  const toggleListening = () => {
    if (isListening) {
      recognitionRef.current?.stop();
      setIsListening(false);
    } else {
      if (!recognitionRef.current) {
        recognitionRef.current = initSpeechRecognition();
      }
      if (recognitionRef.current) {
        recognitionRef.current.start();
        setIsListening(true);
        setIsPlaying(true);
      }
    }
  };

  const togglePlayPause = () => {
    if (isPlaying) {
      setIsPlaying(false);
      recognitionRef.current?.stop();
      setIsListening(false);
    } else {
      setIsPlaying(true);
      if (!recognitionRef.current) {
        recognitionRef.current = initSpeechRecognition();
      }
      recognitionRef.current?.start();
      setIsListening(true);
    }
  };

  const handleReset = () => {
    setCurrentLineIndex(0);
    setTranscript("");
    setIsPlaying(false);
    setIsListening(false);
    recognitionRef.current?.stop();
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <Loader2 className="w-8 h-8 animate-spin text-purple-400" />
      </div>
    );
  }

  const currentLine = lines[currentLineIndex];

  return (
    <div className="min-h-screen bg-background flex flex-col" data-testid="reader-page">
      {/* Header */}
      <header className="app-header border-b border-border shrink-0">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-12 md:h-14">
            <div className="flex items-center gap-3 md:gap-4">
              <Link
                to={`/project/${id}`}
                className="flex items-center gap-2 text-muted-foreground hover:text-foreground"
              >
                <ArrowLeft className="w-5 h-5" />
              </Link>
              <h1 className="font-semibold truncate text-sm md:text-base max-w-[150px] md:max-w-none">{project?.project_title}</h1>
            </div>

            <div className="flex items-center gap-2">
              <span className="text-xs md:text-sm text-muted-foreground">
                {currentLineIndex + 1}/{lines.length}
              </span>
              <Button
                variant="ghost"
                size="icon"
                onClick={() => setShowSettings(!showSettings)}
                className="w-8 h-8 md:w-10 md:h-10"
                data-testid="settings-btn"
              >
                <Settings className="w-4 h-4 md:w-5 md:h-5" />
              </Button>
            </div>
          </div>
        </div>
      </header>

      {/* Settings Panel */}
      {showSettings && (
        <div className="border-b border-border bg-card p-4 shrink-0">
          <div className="max-w-7xl mx-auto">
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-semibold">Reader Settings</h3>
              <Button
                variant="ghost"
                size="icon"
                onClick={() => setShowSettings(false)}
              >
                <X className="w-4 h-4" />
              </Button>
            </div>
            
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
              <div className="space-y-2">
                <Label>Font Size: {fontSize}px</Label>
                <Slider
                  value={[fontSize]}
                  onValueChange={([val]) => setFontSize(val)}
                  min={18}
                  max={64}
                  step={2}
                  className="py-2"
                  data-testid="font-size-slider"
                />
              </div>
              
              <div className="space-y-2">
                <Label>Match Sensitivity: {Math.round((1 - sensitivity) * 100)}%</Label>
                <Slider
                  value={[sensitivity]}
                  onValueChange={([val]) => setSensitivity(val)}
                  min={0.1}
                  max={0.8}
                  step={0.1}
                  className="py-2"
                  data-testid="sensitivity-slider"
                />
              </div>
              
              <div className="flex items-center gap-3">
                <Switch
                  checked={autoScroll}
                  onCheckedChange={setAutoScroll}
                  id="auto-scroll"
                  data-testid="auto-scroll-switch"
                />
                <Label htmlFor="auto-scroll">Auto-scroll</Label>
              </div>
              
              <div className="flex items-center gap-3">
                <Switch
                  checked={autoPlayAudio}
                  onCheckedChange={setAutoPlayAudio}
                  id="auto-play-audio"
                  data-testid="auto-play-audio-switch"
                />
                <Label htmlFor="auto-play-audio">Auto-play cue audio</Label>
              </div>
              
              <div className="flex items-center gap-3">
                <Switch
                  checked={showDebug}
                  onCheckedChange={setShowDebug}
                  id="show-debug"
                  data-testid="show-debug-switch"
                />
                <Label htmlFor="show-debug">Show Debug</Label>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Main Reader Area */}
      <div className="flex-1 overflow-hidden flex flex-col">
        {/* Lines Display */}
        <div 
          ref={containerRef}
          className="flex-1 overflow-y-auto px-4 py-8"
          data-testid="lines-container"
        >
          <div className="max-w-4xl mx-auto space-y-6">
            {lines.map((line, idx) => {
              const isActive = idx === currentLineIndex;
              const isCompleted = idx < currentLineIndex;
              const isUserLine = line.is_user_line;
              
              return (
                <div
                  key={line.id}
                  ref={el => lineRefs.current[idx] = el}
                  className={`
                    p-4 rounded-xl transition-all duration-300 cursor-pointer
                    ${isActive 
                      ? isUserLine 
                        ? 'bg-purple-500/20 border-2 border-purple-500 scale-[1.02]' 
                        : 'bg-secondary border-2 border-muted-foreground/30 scale-[1.02]'
                      : isCompleted
                        ? 'opacity-40'
                        : 'opacity-60 hover:opacity-80'
                    }
                  `}
                  style={{ fontSize: isActive ? fontSize : fontSize * 0.8 }}
                  onClick={() => setCurrentLineIndex(idx)}
                  data-testid={`reader-line-${idx}`}
                >
                  <p className={`text-xs mb-2 font-medium ${
                    isUserLine ? 'text-purple-400' : 'text-muted-foreground'
                  }`}>
                    {line.character}
                    {isUserLine && ' (You)'}
                  </p>
                  <p className={`leading-relaxed ${
                    isUserLine && isActive ? 'text-purple-200' : ''
                  }`}>
                    {line.text}
                  </p>
                </div>
              );
            })}
          </div>
        </div>

        {/* Debug Panel */}
        {showDebug && (
          <div className="border-t border-border bg-card p-4 shrink-0">
            <div className="max-w-4xl mx-auto">
              <div className="flex items-center gap-2 mb-2">
                <Volume2 className="w-4 h-4 text-purple-400" />
                <span className="text-sm font-medium">Voice Detection</span>
                {isListening && (
                  <span className="w-2 h-2 rounded-full bg-green-500 animate-pulse" />
                )}
              </div>
              <div className="p-3 rounded-lg bg-secondary min-h-[60px]">
                <p className="text-sm text-muted-foreground">
                  {transcript || "Start speaking to see transcription..."}
                </p>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Controls Bar - With all icons always visible */}
      <div className="border-t border-border bg-card shrink-0 safe-area-bottom">
        {/* Voice Transcript Bar - Visible when listening */}
        {isListening && (
          <div className="bg-secondary/50 border-b border-border px-4 py-3">
            <div className="max-w-4xl mx-auto flex items-center gap-3">
              <div className="w-8 h-8 rounded-full bg-purple-500/20 flex items-center justify-center shrink-0">
                <Mic className="w-4 h-4 text-purple-400 animate-pulse" />
              </div>
              <p className="text-sm text-muted-foreground flex-1 min-h-[20px]">
                {transcript ? `...${transcript}` : "Listening for your voice..."}
              </p>
              <Button 
                onClick={toggleListening}
                variant="destructive"
                size="sm"
                className="shrink-0"
                data-testid="stop-listening-btn"
              >
                Stop
              </Button>
            </div>
          </div>
        )}
        
        {/* Main Controls - Always visible */}
        <div className="p-3 md:p-4">
          {/* Status indicator */}
          <div className="max-w-4xl mx-auto mb-3 text-center">
            {currentLine?.is_user_line ? (
              <div className="flex items-center justify-center gap-2">
                <div className={`w-3 h-3 rounded-full ${isListening ? 'bg-green-500 animate-pulse' : 'bg-purple-500'}`} />
                <p className="text-sm font-medium text-purple-400">
                  {isListening ? "Listening - speak your line" : "Your turn - tap mic to start"}
                </p>
              </div>
            ) : (
              <div className="flex items-center justify-center gap-2">
                <div className={`w-3 h-3 rounded-full ${audioRef.current && !audioRef.current.paused ? 'bg-pink-500 animate-pulse' : 'bg-muted-foreground'}`} />
                <p className="text-sm text-muted-foreground">
                  {currentLine?.character}'s line - {audioRef.current && !audioRef.current.paused ? "Playing..." : "will auto-play"}
                </p>
              </div>
            )}
          </div>
        
          {/* All controls always visible */}
          <div className="max-w-4xl mx-auto flex items-center justify-center gap-2 md:gap-4">
            <Button
              variant="ghost"
              size="icon"
              onClick={handleReset}
              className="w-10 h-10 md:w-12 md:h-12"
              title="Reset"
              data-testid="reset-btn"
            >
              <RotateCcw className="w-5 h-5" />
            </Button>
            
            <Button
              variant="ghost"
              size="icon"
              onClick={() => setIsMuted(!isMuted)}
              className={`w-10 h-10 md:w-12 md:h-12 ${isMuted ? 'text-red-400' : ''}`}
              title={isMuted ? "Unmute" : "Mute"}
              data-testid="mute-btn"
            >
              {isMuted ? <VolumeX className="w-5 h-5" /> : <Volume2 className="w-5 h-5" />}
            </Button>
            
            <Button
              variant="ghost"
              size="icon"
              onClick={handlePrevLine}
              disabled={currentLineIndex === 0}
              className="w-10 h-10 md:w-12 md:h-12"
              title="Previous line"
              data-testid="prev-line-btn"
            >
              <ChevronUp className="w-6 h-6" />
            </Button>
            
            {/* Main mic button */}
            <Button
              onClick={toggleListening}
              className={`w-16 h-16 md:w-20 md:h-20 rounded-full transition-all ${
                isListening 
                  ? 'bg-red-500 hover:bg-red-600 scale-105' 
                  : 'bg-gradient-to-br from-purple-500 to-pink-500 hover:from-purple-600 hover:to-pink-600'
              }`}
              title={isListening ? "Stop listening" : "Start listening"}
              data-testid="mic-btn"
            >
              {isListening ? (
                <MicOff className="w-7 h-7 md:w-8 md:h-8" />
              ) : (
                <Mic className="w-7 h-7 md:w-8 md:h-8" />
              )}
            </Button>
            
            <Button
              variant="ghost"
              size="icon"
              onClick={handleNextLine}
              disabled={currentLineIndex === lines.length - 1}
              className="w-10 h-10 md:w-12 md:h-12"
              title="Next line"
              data-testid="next-line-btn"
            >
              <ChevronDown className="w-6 h-6" />
            </Button>
            
            <Button
              variant="ghost"
              size="icon"
              onClick={togglePlayPause}
              className="w-10 h-10 md:w-12 md:h-12"
              title={isPlaying ? "Pause" : "Play"}
              data-testid="play-pause-btn"
            >
              {isPlaying ? <Pause className="w-5 h-5" /> : <Play className="w-5 h-5" />}
            </Button>
            
            <Button
              variant="ghost"
              size="icon"
              onClick={() => setShowSettings(true)}
              className="w-10 h-10 md:w-12 md:h-12"
              title="Settings"
              data-testid="settings-btn"
            >
              <Settings className="w-5 h-5" />
            </Button>
          </div>
          
          {/* Line counter */}
          <div className="max-w-4xl mx-auto mt-2 text-center">
            <span className="text-xs text-muted-foreground">
              Line {currentLineIndex + 1} of {lines.length}
            </span>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Reader;
