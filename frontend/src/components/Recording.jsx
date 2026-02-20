import { useState, useEffect, useRef, useCallback } from "react";
import { useParams, useNavigate, Link } from "react-router-dom";
import { api } from "@/App";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
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
  Camera,
  Circle,
  Star,
  Trash2,
  List,
  ChevronRight,
  Save,
  Share2,
  Copy,
  Mail
} from "lucide-react";
import { toast } from "sonner";
import { Input } from "@/components/ui/input";

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
  
  // Takes management
  const [takes, setTakes] = useState([]);
  const [showTakes, setShowTakes] = useState(false);
  const [savingTake, setSavingTake] = useState(false);
  const [showSaveDialog, setShowSaveDialog] = useState(false);
  const [takeNotes, setTakeNotes] = useState("");
  const [selectedTake, setSelectedTake] = useState(null);
  const [compareTakes, setCompareTakes] = useState([]);
  const [showCompare, setShowCompare] = useState(false);
  
  // Sharing
  const [showShareDialog, setShowShareDialog] = useState(false);
  const [shareEmail, setShareEmail] = useState("");
  const [shareName, setShareName] = useState("");
  const [shareMessage, setShareMessage] = useState("");
  const [sharing, setSharing] = useState(false);
  const [shareUrl, setShareUrl] = useState("");
  
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
    fetchTakes();
    return () => {
      stopMediaStream();
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, [id]);

  useEffect(() => {
    if (project && !showTakes && !showCompare && !selectedTake) {
      initCamera();
    }
  }, [project, cameraEnabled, micEnabled, showTakes, showCompare, selectedTake]);

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

  const fetchTakes = async () => {
    try {
      const response = await api.get(`/projects/${id}/takes`);
      setTakes(response.data);
    } catch (error) {
      console.error("Failed to fetch takes:", error);
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
    
    timerRef.current = setInterval(() => {
      setRecordingTime(prev => prev + 1);
    }, 1000);

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
    setTakeNotes("");
    initCamera();
  };

  const saveTake = async () => {
    if (!recordedBlob) return;
    
    setSavingTake(true);
    try {
      // Convert blob to base64
      const reader = new FileReader();
      reader.readAsDataURL(recordedBlob);
      
      reader.onloadend = async () => {
        const base64data = reader.result;
        
        const response = await api.post(`/projects/${id}/takes`, {
          project_id: id,
          video_data: base64data,
          duration: recordingTime,
          notes: takeNotes
        });
        
        setTakes([response.data, ...takes]);
        toast.success(`Take ${response.data.take_number} saved!`);
        setShowSaveDialog(false);
        resetRecording();
        setSavingTake(false);
      };
    } catch (error) {
      toast.error("Failed to save take");
      setSavingTake(false);
    }
  };

  const toggleFavorite = async (take) => {
    try {
      const response = await api.put(`/projects/${id}/takes/${take.id}`, {
        is_favorite: !take.is_favorite
      });
      setTakes(takes.map(t => t.id === take.id ? response.data : t));
    } catch (error) {
      toast.error("Failed to update take");
    }
  };

  const deleteTake = async (takeId) => {
    if (!window.confirm("Delete this take?")) return;
    
    try {
      await api.delete(`/projects/${id}/takes/${takeId}`);
      setTakes(takes.filter(t => t.id !== takeId));
      toast.success("Take deleted");
    } catch (error) {
      toast.error("Failed to delete take");
    }
  };

  const shareTake = async (take) => {
    setSelectedTake(take);
    setShowShareDialog(true);
    setShareUrl("");
  };

  const createShareLink = async () => {
    if (!selectedTake) return;
    
    setSharing(true);
    try {
      const response = await api.post(`/projects/${id}/takes/${selectedTake.id}/share`, {
        take_id: selectedTake.id,
        recipient_email: shareEmail || null,
        recipient_name: shareName || null,
        message: shareMessage || null,
        expires_hours: 72
      });
      
      setShareUrl(response.data.share_url);
      toast.success("Share link created!");
    } catch (error) {
      toast.error("Failed to create share link");
    } finally {
      setSharing(false);
    }
  };

  const copyShareLink = () => {
    navigator.clipboard.writeText(shareUrl);
    toast.success("Link copied to clipboard!");
  };

  const downloadTake = (take) => {
    // Extract base64 and convert to blob
    const base64 = take.video_url.split(',')[1];
    const byteCharacters = atob(base64);
    const byteNumbers = new Array(byteCharacters.length);
    for (let i = 0; i < byteCharacters.length; i++) {
      byteNumbers[i] = byteCharacters.charCodeAt(i);
    }
    const byteArray = new Uint8Array(byteNumbers);
    const blob = new Blob([byteArray], { type: 'video/webm' });
    
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${project?.project_title || 'self-tape'}_take${take.take_number}.webm`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    toast.success("Download started!");
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
      
      const nextLine = lines[nextIndex];
      if (autoPlayCues && nextLine && !nextLine.is_user_line && nextLine.audio_url) {
        playLineAudio(nextLine.audio_url);
      }
      
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

  const toggleCompare = (take) => {
    if (compareTakes.find(t => t.id === take.id)) {
      setCompareTakes(compareTakes.filter(t => t.id !== take.id));
    } else if (compareTakes.length < 2) {
      setCompareTakes([...compareTakes, take]);
    } else {
      toast.error("Can only compare 2 takes at a time");
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <Loader2 className="w-8 h-8 animate-spin text-purple-400" />
      </div>
    );
  }

  // Takes List View
  if (showTakes) {
    return (
      <div className="min-h-screen bg-background" data-testid="takes-list-page">
        <header className="app-header border-b border-border">
          <div className="max-w-7xl mx-auto px-4">
            <div className="flex items-center justify-between h-14">
              <div className="flex items-center gap-3">
                <button onClick={() => setShowTakes(false)} className="text-muted-foreground">
                  <ArrowLeft className="w-5 h-5" />
                </button>
                <h1 className="font-semibold">My Takes ({takes.length})</h1>
              </div>
              {compareTakes.length === 2 && (
                <Button size="sm" onClick={() => setShowCompare(true)} className="btn-primary">
                  Compare
                </Button>
              )}
            </div>
          </div>
        </header>
        
        <main className="max-w-4xl mx-auto px-4 py-6">
          {takes.length === 0 ? (
            <div className="text-center py-12">
              <Video className="w-12 h-12 text-muted-foreground mx-auto mb-4" />
              <p className="text-muted-foreground">No takes yet. Record your first one!</p>
              <Button onClick={() => setShowTakes(false)} className="mt-4 btn-primary">
                Start Recording
              </Button>
            </div>
          ) : (
            <div className="space-y-4">
              <p className="text-sm text-muted-foreground">Select 2 takes to compare side-by-side</p>
              
              {takes.map((take) => (
                <div
                  key={take.id}
                  className={`feature-card app-card ${compareTakes.find(t => t.id === take.id) ? 'border-purple-500' : ''}`}
                >
                  <div className="flex items-center gap-4">
                    <button
                      onClick={() => toggleCompare(take)}
                      className={`w-6 h-6 rounded-full border-2 flex items-center justify-center shrink-0 ${
                        compareTakes.find(t => t.id === take.id) 
                          ? 'bg-purple-500 border-purple-500' 
                          : 'border-muted-foreground'
                      }`}
                    >
                      {compareTakes.find(t => t.id === take.id) && (
                        <span className="text-white text-xs">
                          {compareTakes.findIndex(t => t.id === take.id) + 1}
                        </span>
                      )}
                    </button>
                    
                    <div className="flex-1 min-w-0" onClick={() => setSelectedTake(take)}>
                      <div className="flex items-center gap-2">
                        <span className="font-semibold">Take {take.take_number}</span>
                        {take.is_favorite && <Star className="w-4 h-4 text-yellow-400 fill-yellow-400" />}
                      </div>
                      <p className="text-sm text-muted-foreground">
                        {formatTime(take.duration)} • {new Date(take.created_at).toLocaleDateString()}
                      </p>
                      {take.notes && (
                        <p className="text-sm text-muted-foreground truncate mt-1">{take.notes}</p>
                      )}
                    </div>
                    
                    <div className="flex items-center gap-1">
                      <Button variant="ghost" size="icon" onClick={() => shareTake(take)}>
                        <Share2 className="w-4 h-4 text-purple-400" />
                      </Button>
                      <Button variant="ghost" size="icon" onClick={() => toggleFavorite(take)}>
                        <Star className={`w-4 h-4 ${take.is_favorite ? 'text-yellow-400 fill-yellow-400' : ''}`} />
                      </Button>
                      <Button variant="ghost" size="icon" onClick={() => downloadTake(take)}>
                        <Download className="w-4 h-4" />
                      </Button>
                      <Button variant="ghost" size="icon" onClick={() => deleteTake(take.id)}>
                        <Trash2 className="w-4 h-4 text-red-400" />
                      </Button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </main>
      </div>
    );
  }

  // Compare View
  if (showCompare && compareTakes.length === 2) {
    return (
      <div className="min-h-screen bg-black" data-testid="compare-takes-page">
        <header className="absolute top-0 left-0 right-0 z-20 p-4">
          <div className="flex items-center justify-between">
            <button
              onClick={() => {
                setShowCompare(false);
                setCompareTakes([]);
              }}
              className="w-10 h-10 rounded-full bg-black/50 backdrop-blur flex items-center justify-center"
            >
              <ArrowLeft className="w-5 h-5 text-white" />
            </button>
            <span className="text-white font-semibold">Compare Takes</span>
            <div className="w-10" />
          </div>
        </header>
        
        <div className="flex flex-col md:flex-row h-screen pt-16">
          {compareTakes.map((take, idx) => (
            <div key={take.id} className="flex-1 relative">
              <video
                src={take.video_url}
                controls
                className="w-full h-full object-contain"
              />
              <div className="absolute bottom-4 left-4 px-3 py-1.5 rounded-full bg-black/70 backdrop-blur">
                <span className="text-white text-sm">Take {take.take_number}</span>
              </div>
            </div>
          ))}
        </div>
      </div>
    );
  }

  // Single Take View
  if (selectedTake) {
    return (
      <div className="min-h-screen bg-black flex flex-col" data-testid="take-view-page">
        <header className="absolute top-0 left-0 right-0 z-20 p-4">
          <div className="flex items-center justify-between">
            <button
              onClick={() => setSelectedTake(null)}
              className="w-10 h-10 rounded-full bg-black/50 backdrop-blur flex items-center justify-center"
            >
              <ArrowLeft className="w-5 h-5 text-white" />
            </button>
            <span className="text-white font-semibold">Take {selectedTake.take_number}</span>
            <div className="flex gap-2">
              <button
                onClick={() => toggleFavorite(selectedTake)}
                className="w-10 h-10 rounded-full bg-black/50 backdrop-blur flex items-center justify-center"
              >
                <Star className={`w-5 h-5 ${selectedTake.is_favorite ? 'text-yellow-400 fill-yellow-400' : 'text-white'}`} />
              </button>
              <button
                onClick={() => downloadTake(selectedTake)}
                className="w-10 h-10 rounded-full bg-black/50 backdrop-blur flex items-center justify-center"
              >
                <Download className="w-5 h-5 text-white" />
              </button>
            </div>
          </div>
        </header>
        
        <div className="flex-1 flex items-center justify-center">
          <video
            src={selectedTake.video_url}
            controls
            autoPlay
            className="w-full h-full object-contain"
          />
        </div>
        
        {selectedTake.notes && (
          <div className="p-4 bg-black/90">
            <p className="text-white/70 text-sm">{selectedTake.notes}</p>
          </div>
        )}
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
            
            {takes.length > 0 && !isRecording && !recordedUrl && (
              <button
                onClick={() => setShowTakes(true)}
                className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-black/50 backdrop-blur"
              >
                <List className="w-4 h-4 text-white" />
                <span className="text-white text-sm">{takes.length} takes</span>
              </button>
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

      {/* Save Dialog */}
      <Dialog open={showSaveDialog} onOpenChange={setShowSaveDialog}>
        <DialogContent className="bg-card border-border">
          <DialogHeader>
            <DialogTitle>Save Take</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 mt-4">
            <div>
              <Label>Notes (optional)</Label>
              <Textarea
                value={takeNotes}
                onChange={(e) => setTakeNotes(e.target.value)}
                placeholder="Add notes about this take..."
                className="mt-2 bg-secondary border-border"
                rows={3}
              />
            </div>
            <div className="flex justify-end gap-3">
              <Button variant="ghost" onClick={() => setShowSaveDialog(false)}>
                Cancel
              </Button>
              <Button onClick={saveTake} disabled={savingTake} className="btn-primary">
                {savingTake ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4 mr-2" />}
                Save Take
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Share Dialog */}
      <Dialog open={showShareDialog} onOpenChange={setShowShareDialog}>
        <DialogContent className="bg-card border-border">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Share2 className="w-5 h-5 text-purple-400" />
              Share Take {selectedTake?.take_number}
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4 mt-4">
            {shareUrl ? (
              <div>
                <Label className="text-green-400">Link created!</Label>
                <div className="flex gap-2 mt-2">
                  <Input
                    value={shareUrl}
                    readOnly
                    className="bg-secondary border-border text-sm"
                  />
                  <Button onClick={copyShareLink} size="icon" variant="outline">
                    <Copy className="w-4 h-4" />
                  </Button>
                </div>
                <p className="text-xs text-muted-foreground mt-2">
                  Link expires in 72 hours
                </p>
              </div>
            ) : (
              <>
                <div>
                  <Label>Recipient Name (optional)</Label>
                  <Input
                    value={shareName}
                    onChange={(e) => setShareName(e.target.value)}
                    placeholder="Casting Director"
                    className="mt-2 bg-secondary border-border"
                  />
                </div>
                <div>
                  <Label>Recipient Email (optional)</Label>
                  <Input
                    value={shareEmail}
                    onChange={(e) => setShareEmail(e.target.value)}
                    placeholder="casting@studio.com"
                    className="mt-2 bg-secondary border-border"
                  />
                </div>
                <div>
                  <Label>Message (optional)</Label>
                  <Textarea
                    value={shareMessage}
                    onChange={(e) => setShareMessage(e.target.value)}
                    placeholder="Thank you for considering me for this role..."
                    className="mt-2 bg-secondary border-border"
                    rows={2}
                  />
                </div>
              </>
            )}
            <div className="flex justify-end gap-3">
              <Button variant="ghost" onClick={() => {
                setShowShareDialog(false);
                setShareUrl("");
                setShareEmail("");
                setShareName("");
                setShareMessage("");
              }}>
                {shareUrl ? "Done" : "Cancel"}
              </Button>
              {!shareUrl && (
                <Button onClick={createShareLink} disabled={sharing} className="btn-primary">
                  {sharing ? <Loader2 className="w-4 h-4 animate-spin" /> : <Share2 className="w-4 h-4 mr-2" />}
                  Create Link
                </Button>
              )}
            </div>
          </div>
        </DialogContent>
      </Dialog>

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
              className="w-full h-full object-cover"
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
                {new Date().toLocaleDateString()} • Take {takes.length + 1}
              </p>
            </div>
          )}
        </div>

        {/* Script Sidebar */}
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
                    onClick={() => setCurrentLineIndex(idx)}
                    className={`p-2 rounded-lg text-sm transition-all cursor-pointer ${
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
                onClick={() => setShowSaveDialog(true)}
                className="bg-gradient-to-r from-purple-500 to-pink-500"
              >
                <Save className="w-5 h-5 mr-2" />
                Save Take
              </Button>
              
              <Button
                variant="ghost"
                onClick={downloadRecording}
                className="text-white hover:text-white hover:bg-white/10"
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
                <ChevronRight className="w-5 h-5" />
              </Button>
              
              <div className="w-12" />
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
