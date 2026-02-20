import { useState, useEffect, useRef, useCallback } from "react";
import { useParams, useNavigate, Link } from "react-router-dom";
import { api } from "@/App";
import { Button } from "@/components/ui/button";
import { Slider } from "@/components/ui/slider";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import {
  Video,
  VideoOff,
  Mic,
  MicOff,
  ArrowLeft,
  Play,
  Pause,
  Square,
  RotateCcw,
  Download,
  Settings,
  Loader2,
  X,
  Volume2,
  VolumeX,
  Camera,
  Circle
} from "lucide-react";
import { toast } from "sonner";

const Recording = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  
  // Project data
  const [project, setProject] = useState(null);
  const [lines, setLines] = useState([]);
  const [loading, setLoading] = useState(true);
  
  // Recording state
  const [isRecording, setIsRecording] = useState(false);
  const [isPaused, setIsPaused] = useState(false);
  const [recordedBlob, setRecordedBlob] = useState(null);
  const [recordedUrl, setRecordedUrl] = useState(null);
  const [countdown, setCountdown] = useState(null);
  const [recordingTime, setRecordingTime] = useState(0);
  
  // Current line tracking
  const [currentLineIndex, setCurrentLineIndex] = useState(0);
  
  // Camera/Audio settings
  const [cameraEnabled, setCameraEnabled] = useState(true);
  const [micEnabled, setMicEnabled] = useState(true);
  const [showSettings, setShowSettings] = useState(false);
  const [autoPlayCues, setAutoPlayCues] = useState(true);
  const [showSlate, setShowSlate] = useState(true);
  
  // Refs
  const videoRef = useRef(null);
  const mediaRecorderRef = useRef(null);
  const streamRef = useRef(null);
  const chunksRef = useRef([]);
  const timerRef = useRef(null);
  const audioRef = useRef(null);
  const lineRefs = useRef([]);

  useEffect(() => {
    fetchReaderData();
    return () => {
      stopMediaStream();
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, [id]);

  useEffect(() => {
    if (project) {
      initCamera();
    }
  }, [project, cameraEnabled, micEnabled]);

  const fetchReaderData = async () => {
    try {
      const response = await api.get(`/projects/${id}/reader-data`);
      setProject(response.data);
      
      const allLines = response.data.scenes.reduce((acc, scene) => {
        return [...acc, ...scene.lines];
      }, []);
      setLines(allLines);
    } catch (error) {
      toast.error("Failed to load project");
      navigate("/dashboard");
    } finally {
      setLoading(false);
    }
  };

  const initCamera = async () => {
    try {
      stopMediaStream();
      
      const constraints = {
        video: cameraEnabled ? { facingMode: "user", width: 1280, height: 720 } : false,
        audio: micEnabled
      };
      
      if (!cameraEnabled && !micEnabled) return;
      
      const stream = await navigator.mediaDevices.getUserMedia(constraints);
      streamRef.current = stream;
      
      if (videoRef.current && cameraEnabled) {
        videoRef.current.srcObject = stream;
      }
    } catch (error) {
      console.error("Camera error:", error);
      toast.error("Could not access camera/microphone");
    }
  };

  const stopMediaStream = () => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(track => track.stop());
      streamRef.current = null;
    }
  };

  const startCountdown = () => {
    setCountdown(3);
    const interval = setInterval(() => {
      setCountdown(prev => {
        if (prev <= 1) {
          clearInterval(interval);
          startRecording();
          return null;
        }
        return prev - 1;
      });
    }, 1000);
  };

  const startRecording = () => {
    if (!streamRef.current) {
      toast.error("No camera/mic stream available");
      return;
    }

    chunksRef.current = [];
    
    const options = { mimeType: 'video/webm;codecs=vp9,opus' };
    try {
      mediaRecorderRef.current = new MediaRecorder(streamRef.current, options);
    } catch (e) {
      mediaRecorderRef.current = new MediaRecorder(streamRef.current);
    }
    
    mediaRecorderRef.current.ondataavailable = (event) => {
      if (event.data.size > 0) {
        chunksRef.current.push(event.data);
      }
    };
    
    mediaRecorderRef.current.onstop = () => {
      const blob = new Blob(chunksRef.current, { type: 'video/webm' });
      setRecordedBlob(blob);
      setRecordedUrl(URL.createObjectURL(blob));
    };
    
    mediaRecorderRef.current.start(1000);
    setIsRecording(true);
    setRecordingTime(0);
    
    // Start timer
    timerRef.current = setInterval(() => {
      setRecordingTime(prev => prev + 1);
    }, 1000);

    // Play first cue if it's not user's line
    if (autoPlayCues && lines[0] && !lines[0].is_user_line && lines[0].audio_url) {
      setTimeout(() => playLineAudio(lines[0].audio_url), 500);
    }
  };

  const pauseRecording = () => {
    if (mediaRecorderRef.current && isRecording) {
      if (isPaused) {
        mediaRecorderRef.current.resume();
        timerRef.current = setInterval(() => {
          setRecordingTime(prev => prev + 1);
        }, 1000);
      } else {
        mediaRecorderRef.current.pause();
        if (timerRef.current) clearInterval(timerRef.current);
      }
      setIsPaused(!isPaused);
    }
  };

  const stopRecording = () => {
    if (mediaRecorderRef.current && isRecording) {
      mediaRecorderRef.current.stop();
      setIsRecording(false);
      setIsPaused(false);
      if (timerRef.current) clearInterval(timerRef.current);
    }
  };

  const resetRecording = () => {
    setRecordedBlob(null);
    setRecordedUrl(null);
    setCurrentLineIndex(0);
    setRecordingTime(0);
  };

  const downloadRecording = () => {
    if (recordedBlob) {
      const url = URL.createObjectURL(recordedBlob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `${project?.project_title || 'self-tape'}_${new Date().toISOString().split('T')[0]}.webm`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
      toast.success("Recording downloaded!");
    }
  };

  const playLineAudio = (audioUrl) => {
    if (audioRef.current) {
      audioRef.current.pause();
    }
    const audio = new Audio(audioUrl);
    audioRef.current = audio;
    audio.play().catch(e => console.log("Audio play failed:", e));
  };

  const handleNextLine = () => {
    if (currentLineIndex < lines.length - 1) {
      const nextIndex = currentLineIndex + 1;
      setCurrentLineIndex(nextIndex);
      
      // Auto-play cue audio
      const nextLine = lines[nextIndex];
      if (autoPlayCues && nextLine && !nextLine.is_user_line && nextLine.audio_url) {
        playLineAudio(nextLine.audio_url);
      }
      
      // Scroll to line
      if (lineRefs.current[nextIndex]) {
        lineRefs.current[nextIndex].scrollIntoView({ behavior: 'smooth', block: 'center' });
      }
    }
  };

  const handlePrevLine = () => {
    if (currentLineIndex > 0) {
      setCurrentLineIndex(prev => prev - 1);
    }
  };

  const formatTime = (seconds) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
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
    <div className="min-h-screen bg-black flex flex-col" data-testid="recording-page">
      {/* Header */}
      <header className="absolute top-0 left-0 right-0 z-20 p-4">
        <div className="flex items-center justify-between">
          <Link
            to={`/project/${id}`}
            className="w-10 h-10 rounded-full bg-black/50 backdrop-blur flex items-center justify-center"
          >
            <ArrowLeft className="w-5 h-5 text-white" />
          </Link>
          
          <div className="flex items-center gap-2">
            {isRecording && (
              <div className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-red-500/90 backdrop-blur">
                <Circle className="w-3 h-3 fill-white text-white animate-pulse" />
                <span className="text-white text-sm font-medium">{formatTime(recordingTime)}</span>
              </div>
            )}
            
            <button
              onClick={() => setShowSettings(!showSettings)}
              className="w-10 h-10 rounded-full bg-black/50 backdrop-blur flex items-center justify-center"
            >
              <Settings className="w-5 h-5 text-white" />
            </button>
          </div>
        </div>
      </header>

      {/* Settings Panel */}
      {showSettings && (
        <div className="absolute top-16 right-4 z-30 w-64 p-4 rounded-2xl bg-black/90 backdrop-blur border border-white/10">
          <div className="flex items-center justify-between mb-4">
            <h3 className="font-semibold text-white">Settings</h3>
            <button onClick={() => setShowSettings(false)}>
              <X className="w-4 h-4 text-white" />
            </button>
          </div>
          
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <Label className="text-white text-sm">Camera</Label>
              <Switch checked={cameraEnabled} onCheckedChange={setCameraEnabled} />
            </div>
            <div className="flex items-center justify-between">
              <Label className="text-white text-sm">Microphone</Label>
              <Switch checked={micEnabled} onCheckedChange={setMicEnabled} />
            </div>
            <div className="flex items-center justify-between">
              <Label className="text-white text-sm">Auto-play cues</Label>
              <Switch checked={autoPlayCues} onCheckedChange={setAutoPlayCues} />
            </div>
            <div className="flex items-center justify-between">
              <Label className="text-white text-sm">Show slate</Label>
              <Switch checked={showSlate} onCheckedChange={setShowSlate} />
            </div>
          </div>
        </div>
      )}

      {/* Countdown Overlay */}
      {countdown !== null && (
        <div className="absolute inset-0 z-40 flex items-center justify-center bg-black/80">
          <div className="text-9xl font-bold text-white animate-pulse">{countdown}</div>
        </div>
      )}

      {/* Main Content */}
      <div className="flex-1 flex flex-col md:flex-row">
        {/* Video Preview */}
        <div className="flex-1 relative bg-black flex items-center justify-center">
          {recordedUrl ? (
            <video
              src={recordedUrl}
              controls
              className="w-full h-full object-contain"
              data-testid="recorded-video"
            />
          ) : cameraEnabled ? (
            <video
              ref={videoRef}
              autoPlay
              muted
              playsInline
              className="w-full h-full object-cover mirror"
              style={{ transform: 'scaleX(-1)' }}
              data-testid="camera-preview"
            />
          ) : (
            <div className="flex flex-col items-center text-white/50">
              <VideoOff className="w-16 h-16 mb-4" />
              <p>Camera off - Audio only</p>
            </div>
          )}
          
          {/* Slate Overlay */}
          {showSlate && !isRecording && !recordedUrl && (
            <div className="absolute bottom-20 left-4 right-4 p-4 rounded-xl bg-black/70 backdrop-blur">
              <p className="text-white font-semibold">{project?.project_title}</p>
              <p className="text-white/70 text-sm">
                {project?.user_character && `Playing: ${project.user_character}`}
              </p>
              <p className="text-white/50 text-xs mt-1">
                {new Date().toLocaleDateString()}
              </p>
            </div>
          )}
        </div>

        {/* Script Sidebar (visible on larger screens or when recording) */}
        {(isRecording || recordedUrl) && (
          <div className="md:w-80 h-48 md:h-auto bg-background/95 backdrop-blur border-t md:border-t-0 md:border-l border-border overflow-hidden flex flex-col">
            <div className="p-3 border-b border-border">
              <p className="text-sm font-medium">Line {currentLineIndex + 1} of {lines.length}</p>
            </div>
            
            <div className="flex-1 overflow-y-auto p-3 space-y-2">
              {lines.map((line, idx) => {
                const isActive = idx === currentLineIndex;
                const isPast = idx < currentLineIndex;
                
                return (
                  <div
                    key={line.id}
                    ref={el => lineRefs.current[idx] = el}
                    className={`p-2 rounded-lg text-sm transition-all ${
                      isActive
                        ? line.is_user_line
                          ? 'bg-purple-500/20 border border-purple-500'
                          : 'bg-secondary border border-muted'
                        : isPast
                          ? 'opacity-40'
                          : 'opacity-60'
                    }`}
                  >
                    <p className={`text-xs mb-1 ${line.is_user_line ? 'text-purple-400' : 'text-muted-foreground'}`}>
                      {line.character} {line.is_user_line && '(You)'}
                    </p>
                    <p className={line.is_user_line && isActive ? 'text-purple-200' : ''}>{line.text}</p>
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </div>

      {/* Controls */}
      <div className="p-4 bg-black/90 backdrop-blur border-t border-white/10 safe-area-bottom">
        <div className="max-w-lg mx-auto">
          {recordedUrl ? (
            // Playback controls
            <div className="flex items-center justify-center gap-4">
              <Button
                variant="ghost"
                onClick={resetRecording}
                className="text-white hover:text-white hover:bg-white/10"
              >
                <RotateCcw className="w-5 h-5 mr-2" />
                Retake
              </Button>
              
              <Button
                onClick={downloadRecording}
                className="bg-gradient-to-r from-purple-500 to-pink-500"
              >
                <Download className="w-5 h-5 mr-2" />
                Download
              </Button>
            </div>
          ) : isRecording ? (
            // Recording controls
            <div className="flex items-center justify-center gap-4">
              <Button
                variant="ghost"
                size="icon"
                onClick={handlePrevLine}
                disabled={currentLineIndex === 0}
                className="w-12 h-12 text-white hover:text-white hover:bg-white/10"
              >
                <ArrowLeft className="w-5 h-5" />
              </Button>
              
              <Button
                variant="ghost"
                size="icon"
                onClick={pauseRecording}
                className="w-12 h-12 text-white hover:text-white hover:bg-white/10"
              >
                {isPaused ? <Play className="w-6 h-6" /> : <Pause className="w-6 h-6" />}
              </Button>
              
              <Button
                onClick={stopRecording}
                className="w-16 h-16 rounded-full bg-red-500 hover:bg-red-600"
                data-testid="stop-recording-btn"
              >
                <Square className="w-6 h-6 fill-white" />
              </Button>
              
              <Button
                variant="ghost"
                size="icon"
                onClick={handleNextLine}
                disabled={currentLineIndex === lines.length - 1}
                className="w-12 h-12 text-white hover:text-white hover:bg-white/10"
              >
                <Play className="w-5 h-5" />
              </Button>
              
              <div className="w-12" /> {/* Spacer */}
            </div>
          ) : (
            // Pre-recording controls
            <div className="flex items-center justify-center gap-4">
              <Button
                variant="ghost"
                size="icon"
                onClick={() => setCameraEnabled(!cameraEnabled)}
                className={`w-12 h-12 ${!cameraEnabled ? 'text-red-400' : 'text-white'} hover:text-white hover:bg-white/10`}
              >
                {cameraEnabled ? <Video className="w-5 h-5" /> : <VideoOff className="w-5 h-5" />}
              </Button>
              
              <Button
                onClick={startCountdown}
                className="w-20 h-20 rounded-full bg-gradient-to-r from-purple-500 to-pink-500 hover:from-purple-600 hover:to-pink-600"
                data-testid="start-recording-btn"
              >
                <Camera className="w-8 h-8" />
              </Button>
              
              <Button
                variant="ghost"
                size="icon"
                onClick={() => setMicEnabled(!micEnabled)}
                className={`w-12 h-12 ${!micEnabled ? 'text-red-400' : 'text-white'} hover:text-white hover:bg-white/10`}
              >
                {micEnabled ? <Mic className="w-5 h-5" /> : <MicOff className="w-5 h-5" />}
              </Button>
            </div>
          )}
          
          {/* Line info */}
          {isRecording && currentLine && (
            <div className="mt-4 text-center">
              {currentLine.is_user_line ? (
                <p className="text-purple-400 text-sm">Your line - {currentLine.character}</p>
              ) : (
                <p className="text-white/70 text-sm">{currentLine.character}'s line - tap Next to continue</p>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default Recording;
