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
  X
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
  
  // Refs
  const recognitionRef = useRef(null);
  const lineRefs = useRef([]);
  const fuseRef = useRef(null);
  const containerRef = useRef(null);

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
    
    // Clean both strings
    const cleanSpoken = spoken.replace(/[^\w\s]/g, '').trim();
    const cleanTarget = target.replace(/[^\w\s]/g, '').trim();
    
    // Direct inclusion check
    if (cleanTarget.includes(cleanSpoken) || cleanSpoken.includes(cleanTarget)) {
      return cleanSpoken.length > 3;
    }
    
    // Use Fuse for fuzzy matching
    if (fuseRef.current) {
      const results = fuseRef.current.search(cleanSpoken);
      if (results.length > 0 && results[0].item.index === currentLineIndex) {
        return results[0].score < sensitivity;
      }
    }
    
    // Word overlap check
    const spokenWords = cleanSpoken.split(/\s+/);
    const targetWords = cleanTarget.split(/\s+/);
    const matchingWords = spokenWords.filter(word => 
      targetWords.some(tw => tw.includes(word) || word.includes(tw))
    );
    
    return matchingWords.length >= Math.min(3, Math.floor(targetWords.length * 0.5));
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
      <header className="border-b border-border shrink-0">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-14">
            <div className="flex items-center gap-4">
              <Link
                to={`/project/${id}`}
                className="flex items-center gap-2 text-muted-foreground hover:text-foreground"
              >
                <ArrowLeft className="w-4 h-4" />
              </Link>
              <h1 className="font-semibold truncate">{project?.project_title}</h1>
            </div>

            <div className="flex items-center gap-2">
              <span className="text-sm text-muted-foreground">
                Line {currentLineIndex + 1} of {lines.length}
              </span>
              <Button
                variant="ghost"
                size="icon"
                onClick={() => setShowSettings(!showSettings)}
                data-testid="settings-btn"
              >
                <Settings className="w-5 h-5" />
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

      {/* Controls Bar */}
      <div className="border-t border-border bg-card p-4 shrink-0">
        <div className="max-w-4xl mx-auto flex items-center justify-center gap-4">
          <Button
            variant="ghost"
            size="icon"
            onClick={handleReset}
            className="w-12 h-12"
            data-testid="reset-btn"
          >
            <RotateCcw className="w-5 h-5" />
          </Button>
          
          <Button
            variant="ghost"
            size="icon"
            onClick={handlePrevLine}
            disabled={currentLineIndex === 0}
            className="w-12 h-12"
            data-testid="prev-line-btn"
          >
            <ChevronUp className="w-6 h-6" />
          </Button>
          
          <Button
            onClick={toggleListening}
            className={`w-16 h-16 rounded-full ${
              isListening 
                ? 'bg-red-500 hover:bg-red-600' 
                : 'bg-gradient-to-br from-purple-500 to-pink-500 hover:from-purple-600 hover:to-pink-600'
            }`}
            data-testid="mic-btn"
          >
            {isListening ? (
              <MicOff className="w-7 h-7" />
            ) : (
              <Mic className="w-7 h-7" />
            )}
          </Button>
          
          <Button
            variant="ghost"
            size="icon"
            onClick={handleNextLine}
            disabled={currentLineIndex === lines.length - 1}
            className="w-12 h-12"
            data-testid="next-line-btn"
          >
            <ChevronDown className="w-6 h-6" />
          </Button>
          
          <Button
            variant="ghost"
            size="icon"
            onClick={togglePlayPause}
            className="w-12 h-12"
            data-testid="play-pause-btn"
          >
            {isPlaying ? (
              <Pause className="w-5 h-5" />
            ) : (
              <Play className="w-5 h-5" />
            )}
          </Button>
        </div>
        
        {/* Current Line Info */}
        <div className="max-w-4xl mx-auto mt-4 text-center">
          {currentLine?.is_user_line ? (
            <p className="text-sm text-purple-400">
              Your turn - speak your line
            </p>
          ) : (
            <p className="text-sm text-muted-foreground">
              {currentLine?.character}'s line - tap Next when ready
            </p>
          )}
        </div>
      </div>
    </div>
  );
};

export default Reader;
