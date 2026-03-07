import { useState, useEffect, useRef, useCallback } from "react";
import { useParams, useNavigate, Link } from "react-router-dom";
import { api } from "@/App";
import { Button } from "@/components/ui/button";
import { Slider } from "@/components/ui/slider";
import {
  Mic,
  MicOff,
  ArrowLeft,
  Play,
  Pause,
  Settings,
  Volume2,
  Loader2,
  VolumeX,
  SkipForward,
  SkipBack,
  RotateCcw,
  Square,
  Check
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
  const [transcript, setTranscript] = useState("");
  const [isAudioPlaying, setIsAudioPlaying] = useState(false);
  const [highlightedWordIndex, setHighlightedWordIndex] = useState(-1);
  const [matchedWords, setMatchedWords] = useState([]);
  const [waitingForUser, setWaitingForUser] = useState(false);
  const [silenceTimer, setSilenceTimer] = useState(null);
  
  // Settings
  const [fontSize, setFontSize] = useState(32);
  const [showSettings, setShowSettings] = useState(false);
  const [isMuted, setIsMuted] = useState(false);
  const [autoPlay, setAutoPlay] = useState(true);
  
  // Refs
  const recognitionRef = useRef(null);
  const lineRefs = useRef([]);
  const audioRef = useRef(null);
  const lastSpeechTime = useRef(Date.now());
  const currentLineRef = useRef(null);

  useEffect(() => {
    fetchReaderData();
    return () => {
      cleanup();
    };
  }, [id]);

  const cleanup = () => {
    if (recognitionRef.current) {
      try { recognitionRef.current.stop(); } catch (e) {}
    }
    if (audioRef.current) {
      audioRef.current.pause();
    }
    if (silenceTimer) {
      clearTimeout(silenceTimer);
    }
  };

  // Auto-scroll to current line
  useEffect(() => {
    if (rehearsalStarted && lineRefs.current[currentLineIndex]) {
      lineRefs.current[currentLineIndex].scrollIntoView({
        behavior: 'smooth',
        block: 'center'
      });
    }
  }, [currentLineIndex, rehearsalStarted]);

  // Handle line changes
  useEffect(() => {
    if (!rehearsalStarted || !lines[currentLineIndex]) return;
    
    const currentLine = lines[currentLineIndex];
    setHighlightedWordIndex(-1);
    setMatchedWords([]);
    setTranscript("");
    
    if (currentLine.is_user_line) {
      // It's user's turn
      setWaitingForUser(true);
      setTimeout(() => startListening(), 500);
    } else {
      // AI's turn - play audio
      setWaitingForUser(false);
      if (!isMuted && autoPlay && currentLine.audio_url) {
        setTimeout(() => playLineAudio(currentLine.audio_url), 300);
      }
    }
  }, [currentLineIndex, rehearsalStarted, isMuted, autoPlay]);

  const fetchReaderData = async () => {
    try {
      const response = await api.get(`/projects/${id}/reader-data`);
      setProject(response.data);
      
      const allLines = response.data.scenes.reduce((acc, scene) => {
        return [...acc, ...scene.lines];
      }, []);
      setLines(allLines);
    } catch (error) {
      toast.error("Failed to load script");
      navigate("/dashboard");
    } finally {
      setLoading(false);
    }
  };

  const playLineAudio = async (audioUrl) => {
    if (!audioUrl) {
      handleNextLine();
      return;
    }
    
    if (audioRef.current) {
      audioRef.current.pause();
    }
    
    stopListening();
    setIsAudioPlaying(true);
    
    try {
      const audio = new Audio(audioUrl);
      audioRef.current = audio;
      
      // Highlight words as audio plays
      const currentLine = lines[currentLineIndex];
      if (currentLine) {
        const words = currentLine.text.split(/\s+/);
        const wordDuration = (audio.duration || 3) * 1000 / words.length;
        
        let wordIdx = 0;
        const highlightInterval = setInterval(() => {
          if (wordIdx < words.length) {
            setHighlightedWordIndex(wordIdx);
            wordIdx++;
          } else {
            clearInterval(highlightInterval);
          }
        }, wordDuration || 200);
        
        audio.onended = () => {
          clearInterval(highlightInterval);
          setIsAudioPlaying(false);
          setHighlightedWordIndex(-1);
          // Move to next line
          if (currentLineIndex < lines.length - 1) {
            setTimeout(() => setCurrentLineIndex(prev => prev + 1), 500);
          } else {
            toast.success("Scene complete! Great work!");
            setRehearsalStarted(false);
          }
        };
      }
      
      audio.onerror = () => {
        setIsAudioPlaying(false);
        toast.error("Audio playback failed");
      };
      
      await audio.play();
    } catch (e) {
      setIsAudioPlaying(false);
      // Autoplay blocked - user needs to interact
      toast.info("Tap play to hear the line", { duration: 2000 });
    }
  };

  const startListening = () => {
    if (!('webkitSpeechRecognition' in window) && !('SpeechRecognition' in window)) {
      toast.error("Speech recognition not supported in this browser");
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
    recognition.maxAlternatives = 3;

    recognition.onresult = (event) => {
      lastSpeechTime.current = Date.now();
      
      let fullTranscript = '';
      for (let i = 0; i < event.results.length; i++) {
        fullTranscript += event.results[i][0].transcript;
      }
      
      const cleanTranscript = fullTranscript.toLowerCase().trim();
      setTranscript(cleanTranscript);
      
      // Highlight matching words in user's line
      if (lines[currentLineIndex]?.is_user_line) {
        const lineWords = lines[currentLineIndex].text.toLowerCase().split(/\s+/);
        const spokenWords = cleanTranscript.split(/\s+/);
        
        const matched = [];
        let lineIdx = 0;
        
        for (const spokenWord of spokenWords) {
          // Look for this word in remaining line words
          for (let i = lineIdx; i < lineWords.length; i++) {
            const lineWord = lineWords[i].replace(/[^\w]/g, '');
            const spoken = spokenWord.replace(/[^\w]/g, '');
            
            if (lineWord === spoken || 
                (lineWord.length > 3 && spoken.length > 2 && 
                 (lineWord.startsWith(spoken) || spoken.startsWith(lineWord.substring(0, 3))))) {
              matched.push(i);
              lineIdx = i + 1;
              setHighlightedWordIndex(i);
              break;
            }
          }
        }
        
        setMatchedWords(matched);
        
        // Check if user finished the line (matched most words)
        const matchRatio = matched.length / lineWords.filter(w => w.length > 2).length;
        if (matchRatio >= 0.6 || matched.length >= 3) {
          // User has said enough - wait for silence then advance
          checkForSilenceAndAdvance();
        }
      }
    };

    recognition.onerror = (event) => {
      if (event.error !== 'no-speech' && event.error !== 'aborted') {
        console.log("Speech error:", event.error);
      }
    };

    recognition.onend = () => {
      // Restart if still on user's line
      if (rehearsalStarted && lines[currentLineIndex]?.is_user_line && waitingForUser) {
        try { 
          recognition.start(); 
        } catch (e) {
          console.log("Could not restart recognition");
        }
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

  const checkForSilenceAndAdvance = () => {
    // Wait for 1.5 seconds of silence before advancing
    if (silenceTimer) clearTimeout(silenceTimer);
    
    const timer = setTimeout(() => {
      const timeSinceLastSpeech = Date.now() - lastSpeechTime.current;
      if (timeSinceLastSpeech >= 1500) {
        // User has paused long enough - advance
        handleLineComplete();
      }
    }, 1500);
    
    setSilenceTimer(timer);
  };

  const handleLineComplete = () => {
    setWaitingForUser(false);
    stopListening();
    
    // Show checkmark briefly
    setHighlightedWordIndex(-2); // -2 means show completed state
    
    setTimeout(() => {
      if (currentLineIndex < lines.length - 1) {
        setCurrentLineIndex(prev => prev + 1);
      } else {
        toast.success("Scene complete! Great work!");
        setRehearsalStarted(false);
      }
    }, 500);
  };

  const stopListening = () => {
    if (recognitionRef.current) {
      try { recognitionRef.current.stop(); } catch (e) {}
    }
    setIsListening(false);
    if (silenceTimer) {
      clearTimeout(silenceTimer);
      setSilenceTimer(null);
    }
  };

  const handleNextLine = () => {
    stopListening();
    if (audioRef.current) audioRef.current.pause();
    setIsAudioPlaying(false);
    setHighlightedWordIndex(-1);
    setMatchedWords([]);
    setTranscript("");
    
    if (currentLineIndex < lines.length - 1) {
      setCurrentLineIndex(prev => prev + 1);
    } else {
      toast.success("Scene complete!");
      setRehearsalStarted(false);
    }
  };

  const handlePrevLine = () => {
    stopListening();
    if (audioRef.current) audioRef.current.pause();
    setIsAudioPlaying(false);
    setHighlightedWordIndex(-1);
    setMatchedWords([]);
    
    if (currentLineIndex > 0) {
      setCurrentLineIndex(prev => prev - 1);
    }
  };

  const startRehearsal = () => {
    setRehearsalStarted(true);
    setCurrentLineIndex(0);
    toast.success("Rehearsal started!");
  };

  const stopRehearsal = () => {
    cleanup();
    setRehearsalStarted(false);
    setCurrentLineIndex(0);
    setHighlightedWordIndex(-1);
    setMatchedWords([]);
    setTranscript("");
    setWaitingForUser(false);
  };

  const replayCurrentAudio = () => {
    const currentLine = lines[currentLineIndex];
    if (currentLine?.audio_url && !currentLine.is_user_line) {
      playLineAudio(currentLine.audio_url);
    }
  };

  // Render words with highlighting
  const renderLineText = (line, idx) => {
    const isActive = idx === currentLineIndex && rehearsalStarted;
    const words = line.text.split(/\s+/);
    
    if (!isActive) {
      return <span>{line.text}</span>;
    }
    
    return (
      <span>
        {words.map((word, wordIdx) => {
          let className = "transition-all duration-150 ";
          
          if (line.is_user_line) {
            // User's line - highlight matched words
            if (matchedWords.includes(wordIdx)) {
              className += "text-green-400 font-semibold";
            } else if (wordIdx <= highlightedWordIndex) {
              className += "text-purple-300";
            }
          } else {
            // AI line - highlight current word during playback
            if (wordIdx === highlightedWordIndex) {
              className += "bg-yellow-400/30 text-yellow-300 font-semibold px-1 rounded";
            } else if (wordIdx < highlightedWordIndex) {
              className += "text-muted-foreground";
            }
          }
          
          return (
            <span key={wordIdx} className={className}>
              {word}{' '}
            </span>
          );
        })}
      </span>
    );
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-black">
        <Loader2 className="w-8 h-8 animate-spin text-purple-400" />
      </div>
    );
  }

  const currentLine = lines[currentLineIndex];
  const userCharacter = project?.user_character;
  const userLineCount = lines.filter(l => l.is_user_line).length;

  // Start Screen
  if (!rehearsalStarted) {
    return (
      <div className="min-h-screen bg-gradient-to-b from-gray-900 to-black flex flex-col" data-testid="reader-start">
        {/* Header */}
        <header className="border-b border-white/10 bg-black/50 backdrop-blur">
          <div className="max-w-4xl mx-auto px-4">
            <div className="flex items-center justify-between h-14">
              <Link
                to={`/project/${id}`}
                className="flex items-center gap-2 text-gray-400 hover:text-white transition-colors"
              >
                <ArrowLeft className="w-5 h-5" />
                <span>Back</span>
              </Link>
              <span className="font-semibold text-white">{project?.project_title}</span>
              <div className="w-16"></div>
            </div>
          </div>
        </header>

        {/* Start Content */}
        <div className="flex-1 flex flex-col items-center justify-center p-6">
          <div className="text-center max-w-md">
            {/* Icon */}
            <div className="w-24 h-24 mx-auto mb-8 rounded-full bg-gradient-to-br from-purple-600 to-pink-600 flex items-center justify-center shadow-lg shadow-purple-500/30">
              <Mic className="w-12 h-12 text-white" />
            </div>
            
            <h1 className="text-3xl font-bold text-white mb-3">Ready to Rehearse</h1>
            
            <p className="text-gray-400 mb-8 text-lg">
              Playing as <span className="text-purple-400 font-semibold">{userCharacter || 'Not selected'}</span>
            </p>
            
            {/* Stats */}
            <div className="grid grid-cols-3 gap-4 mb-8">
              <div className="bg-white/5 rounded-xl p-4">
                <div className="text-2xl font-bold text-white">{lines.length}</div>
                <div className="text-xs text-gray-500">Total Lines</div>
              </div>
              <div className="bg-purple-500/20 rounded-xl p-4 border border-purple-500/30">
                <div className="text-2xl font-bold text-purple-400">{userLineCount}</div>
                <div className="text-xs text-purple-300">Your Lines</div>
              </div>
              <div className="bg-white/5 rounded-xl p-4">
                <div className="text-2xl font-bold text-white">{project?.characters?.length || 0}</div>
                <div className="text-xs text-gray-500">Characters</div>
              </div>
            </div>
            
            <Button
              size="lg"
              onClick={startRehearsal}
              className="w-full bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-700 hover:to-pink-700 text-white text-xl py-7 rounded-xl shadow-lg shadow-purple-500/30"
              data-testid="start-rehearsal-btn"
            >
              <Play className="w-6 h-6 mr-3" />
              Start Rehearsal
            </Button>
            
            <p className="text-gray-500 text-sm mt-6">
              AI voices will read other characters' lines.
              <br />
              Speak your lines when prompted.
            </p>
          </div>
        </div>
      </div>
    );
  }

  // Active Rehearsal
  return (
    <div className="min-h-screen bg-black flex flex-col" data-testid="reader-active">
      {/* Minimal Header */}
      <header className="border-b border-white/10 bg-black/80 backdrop-blur shrink-0 sticky top-0 z-20">
        <div className="max-w-4xl mx-auto px-4">
          <div className="flex items-center justify-between h-12">
            <Button
              variant="ghost"
              size="sm"
              onClick={stopRehearsal}
              className="text-gray-400 hover:text-white"
            >
              <Square className="w-4 h-4 mr-1" />
              Stop
            </Button>
            
            <div className="flex items-center gap-3">
              <span className="text-white font-mono">
                {currentLineIndex + 1} / {lines.length}
              </span>
            </div>
            
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setShowSettings(!showSettings)}
              className="text-gray-400 hover:text-white"
            >
              <Settings className="w-4 h-4" />
            </Button>
          </div>
        </div>
      </header>

      {/* Settings */}
      {showSettings && (
        <div className="bg-gray-900/95 border-b border-white/10 p-4 shrink-0">
          <div className="max-w-md mx-auto">
            <div className="flex items-center justify-between">
              <span className="text-gray-400">Font Size</span>
              <div className="flex items-center gap-3 w-32">
                <Slider
                  value={[fontSize]}
                  onValueChange={([v]) => setFontSize(v)}
                  min={20}
                  max={48}
                  step={2}
                  className="flex-1"
                />
                <span className="text-white w-6 text-right">{fontSize}</span>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Script Display - Teleprompter Style */}
      <div className="flex-1 overflow-y-auto">
        <div className="max-w-3xl mx-auto px-6 py-8">
          <div className="space-y-6">
            {lines.map((line, idx) => {
              const isActive = idx === currentLineIndex;
              const isUserLine = line.is_user_line;
              const isCompleted = idx < currentLineIndex;
              const isLineComplete = isActive && highlightedWordIndex === -2;
              
              return (
                <div
                  key={line.id}
                  ref={el => lineRefs.current[idx] = el}
                  className={`
                    transition-all duration-500 rounded-lg p-4
                    ${isActive 
                      ? 'opacity-100 scale-100' 
                      : isCompleted
                        ? 'opacity-30 scale-95'
                        : 'opacity-40 scale-95'
                    }
                  `}
                  onClick={() => {
                    if (!isActive) {
                      stopListening();
                      if (audioRef.current) audioRef.current.pause();
                      setCurrentLineIndex(idx);
                    }
                  }}
                >
                  {/* Character Name */}
                  <div className="flex items-center gap-2 mb-2">
                    <span className={`
                      text-sm font-bold tracking-wide
                      ${isUserLine ? 'text-purple-400' : 'text-gray-500'}
                    `}>
                      {line.character.toUpperCase()}
                      {isUserLine && ' (YOU)'}
                    </span>
                    
                    {isActive && isLineComplete && (
                      <Check className="w-4 h-4 text-green-400" />
                    )}
                  </div>
                  
                  {/* Dialogue */}
                  <p 
                    className={`
                      leading-relaxed
                      ${isActive 
                        ? isUserLine 
                          ? 'text-purple-100' 
                          : 'text-white'
                        : 'text-gray-400'
                      }
                    `}
                    style={{ fontSize: isActive ? fontSize : fontSize * 0.75 }}
                  >
                    {renderLineText(line, idx)}
                  </p>
                </div>
              );
            })}
          </div>
          
          {/* Bottom padding for scrolling */}
          <div className="h-48"></div>
        </div>
      </div>

      {/* Status & Controls Bar */}
      <div className="border-t border-white/10 bg-gray-900/95 backdrop-blur shrink-0 safe-area-bottom">
        <div className="max-w-4xl mx-auto px-4 py-4">
          {/* Status */}
          <div className="text-center mb-4">
            {currentLine?.is_user_line ? (
              <div className="flex flex-col items-center gap-2">
                <div className="flex items-center gap-2">
                  <div className={`
                    w-3 h-3 rounded-full 
                    ${isListening ? 'bg-green-500 animate-pulse' : 'bg-gray-500'}
                  `} />
                  <span className="text-purple-400 font-medium">
                    {isListening ? 'Listening... speak your line' : 'Tap mic to start'}
                  </span>
                </div>
                
                {/* Transcript */}
                {transcript && (
                  <div className="bg-white/5 rounded-lg px-4 py-2 max-w-md">
                    <p className="text-sm text-gray-400 italic">"{transcript}"</p>
                  </div>
                )}
              </div>
            ) : (
              <div className="flex items-center justify-center gap-2">
                <div className={`
                  w-3 h-3 rounded-full 
                  ${isAudioPlaying ? 'bg-pink-500 animate-pulse' : 'bg-gray-500'}
                `} />
                <span className="text-gray-400">
                  {isAudioPlaying 
                    ? `${currentLine?.character} is speaking...` 
                    : currentLine?.audio_url 
                      ? 'Tap play to hear line'
                      : 'No audio available'
                  }
                </span>
              </div>
            )}
          </div>
          
          {/* Controls */}
          <div className="flex items-center justify-center gap-4">
            <Button
              variant="outline"
              size="icon"
              onClick={handlePrevLine}
              disabled={currentLineIndex === 0}
              className="w-12 h-12 rounded-full border-white/20 text-white hover:bg-white/10"
            >
              <SkipBack className="w-5 h-5" />
            </Button>
            
            <Button
              variant="outline"
              size="icon"
              onClick={() => setIsMuted(!isMuted)}
              className="w-10 h-10 rounded-full border-white/20 text-white hover:bg-white/10"
            >
              {isMuted ? <VolumeX className="w-5 h-5" /> : <Volume2 className="w-5 h-5" />}
            </Button>
            
            {/* Main Action Button */}
            {currentLine?.is_user_line ? (
              <Button
                size="lg"
                onClick={isListening ? handleLineComplete : startListening}
                className={`
                  w-16 h-16 rounded-full shadow-lg transition-all
                  ${isListening 
                    ? 'bg-green-500 hover:bg-green-600 shadow-green-500/30' 
                    : 'bg-purple-500 hover:bg-purple-600 shadow-purple-500/30'
                  }
                `}
              >
                {isListening ? (
                  <Check className="w-7 h-7" />
                ) : (
                  <Mic className="w-7 h-7" />
                )}
              </Button>
            ) : (
              <Button
                size="lg"
                onClick={isAudioPlaying ? () => { if(audioRef.current) audioRef.current.pause(); setIsAudioPlaying(false); } : replayCurrentAudio}
                disabled={!currentLine?.audio_url}
                className="w-16 h-16 rounded-full bg-pink-500 hover:bg-pink-600 shadow-lg shadow-pink-500/30"
              >
                {isAudioPlaying ? (
                  <Pause className="w-7 h-7" />
                ) : (
                  <Play className="w-7 h-7" />
                )}
              </Button>
            )}
            
            <Button
              variant="outline"
              size="icon"
              onClick={() => {
                const line = lines[currentLineIndex];
                if (line?.is_user_line) {
                  // Reset current line
                  setMatchedWords([]);
                  setHighlightedWordIndex(-1);
                  setTranscript("");
                  startListening();
                } else {
                  replayCurrentAudio();
                }
              }}
              className="w-10 h-10 rounded-full border-white/20 text-white hover:bg-white/10"
            >
              <RotateCcw className="w-5 h-5" />
            </Button>
            
            <Button
              variant="outline"
              size="icon"
              onClick={handleNextLine}
              disabled={currentLineIndex >= lines.length - 1}
              className="w-12 h-12 rounded-full border-white/20 text-white hover:bg-white/10"
            >
              <SkipForward className="w-5 h-5" />
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Reader;
