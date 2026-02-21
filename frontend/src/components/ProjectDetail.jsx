import { useState, useEffect, useRef } from "react";
import { useParams, useNavigate, Link } from "react-router-dom";
import { api } from "@/App";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Mic,
  ArrowLeft,
  Upload,
  Play,
  Loader2,
  FileText,
  Users,
  Check,
  AlertCircle,
  Sparkles,
  Volume2,
  User,
  Zap,
  Pause,
  Video,
  ClipboardPaste
} from "lucide-react";
import { toast } from "sonner";

const ProjectDetail = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const fileInputRef = useRef(null);
  
  const [project, setProject] = useState(null);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [analyzing, setAnalyzing] = useState(false);
  const [selectedCharacter, setSelectedCharacter] = useState("");
  const [settingCharacter, setSettingCharacter] = useState(false);
  const [generatingAudio, setGeneratingAudio] = useState(false);
  const [previewingVoice, setPreviewingVoice] = useState(null);
  const [playingPreview, setPlayingPreview] = useState(null);
  const [showPasteDialog, setShowPasteDialog] = useState(false);
  const [pastedScript, setPastedScript] = useState("");
  const [pasting, setPasting] = useState(false);
  const audioRef = useRef(null);

  useEffect(() => {
    fetchProject();
  }, [id]);

  const fetchProject = async () => {
    try {
      const response = await api.get(`/projects/${id}`);
      setProject(response.data);
      setSelectedCharacter(response.data.user_character || "");
    } catch (error) {
      toast.error("Failed to load project");
      navigate("/dashboard");
    } finally {
      setLoading(false);
    }
  };

  const handleFileUpload = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!file.name.toLowerCase().endsWith('.pdf')) {
      toast.error("Please upload a PDF file");
      return;
    }

    setUploading(true);
    setAnalyzing(true);
    const formData = new FormData();
    formData.append("file", file);

    try {
      toast.info("Uploading and analyzing script with AI...");
      const response = await api.post(`/projects/${id}/upload-pdf`, formData, {
        headers: { "Content-Type": "multipart/form-data" },
        timeout: 120000 // 2 minute timeout for AI analysis
      });
      setProject(response.data);
      
      if (response.data.ai_analyzed) {
        toast.success("Script analyzed! AI detected characters and emotions.");
      } else {
        toast.success("Script uploaded! (AI analysis unavailable)");
      }
    } catch (error) {
      toast.error(error.response?.data?.detail || "Failed to upload PDF. Try pasting your script instead.");
    } finally {
      setUploading(false);
      setAnalyzing(false);
    }
  };

  const handlePasteScript = async () => {
    if (!pastedScript.trim()) {
      toast.error("Please paste your script first");
      return;
    }
    
    setPasting(true);
    try {
      toast.info("Analyzing script with AI...");
      const response = await api.post(`/projects/${id}/paste-script`, {
        script_text: pastedScript
      }, { timeout: 120000 });
      
      setProject(response.data);
      setShowPasteDialog(false);
      setPastedScript("");
      
      if (response.data.ai_analyzed) {
        toast.success("Script analyzed! AI detected characters and emotions.");
      } else {
        toast.success("Script parsed! (AI analysis unavailable)");
      }
    } catch (error) {
      toast.error(error.response?.data?.detail || "Failed to parse script. Check the format.");
    } finally {
      setPasting(false);
    }
  };

  const handleSetCharacter = async (character) => {
    setSettingCharacter(true);
    try {
      const response = await api.post(`/projects/${id}/set-character`, {
        character
      });
      setProject(response.data);
      setSelectedCharacter(character);
      toast.success(`You're playing ${character}`);
    } catch (error) {
      toast.error("Failed to set character");
    } finally {
      setSettingCharacter(false);
    }
  };

  const handleGenerateAllAudio = async () => {
    // Check if there are cue lines to generate
    const cueLines = project?.scenes?.reduce((total, scene) => 
      total + scene.lines.filter(l => !l.is_user_line).length, 0
    ) || 0;
    
    if (cueLines === 0) {
      toast.error("No cue lines to generate. Upload a script with dialogue first.");
      return;
    }
    
    setGeneratingAudio(true);
    try {
      toast.info(`Generating AI voices for ${cueLines} cue lines...`);
      const response = await api.post(`/projects/${id}/generate-all-audio`, {}, {
        timeout: 300000 // 5 minute timeout
      });
      
      if (response.data.generated_count === 0) {
        toast.warning("No new audio generated. Lines may already have audio or there are no cue lines.");
      } else {
        toast.success(response.data.message);
      }
      fetchProject(); // Refresh to get audio URLs
    } catch (error) {
      if (error.response?.status === 503) {
        toast.error("ElevenLabs not configured. Add your API key in settings.");
      } else {
        const detail = error.response?.data?.detail || "Failed to generate audio";
        toast.error(detail);
      }
    } finally {
      setGeneratingAudio(false);
    }
  };

  const getTotalLines = () => {
    if (!project?.scenes) return 0;
    return project.scenes.reduce((total, scene) => total + scene.lines.length, 0);
  };

  const getUserLines = () => {
    if (!project?.scenes || !project.user_character) return 0;
    return project.scenes.reduce((total, scene) => 
      total + scene.lines.filter(l => l.is_user_line).length, 0
    );
  };

  const getCharacterAnalysis = (charName) => {
    return project?.character_analysis?.find(c => c.name === charName);
  };

  const handlePreviewVoice = async (character) => {
    const analysis = getCharacterAnalysis(character);
    if (!analysis) {
      toast.error("Character analysis not available");
      return;
    }

    // Stop any playing audio
    if (audioRef.current) {
      audioRef.current.pause();
      audioRef.current = null;
    }

    setPreviewingVoice(character);
    
    try {
      // Find a sample line from this character
      let sampleLine = null;
      for (const scene of project.scenes || []) {
        const line = scene.lines.find(l => l.character === character);
        if (line) {
          sampleLine = line;
          break;
        }
      }

      if (!sampleLine) {
        toast.error("No lines found for this character");
        setPreviewingVoice(null);
        return;
      }

      // Generate audio for this line
      const response = await api.post(`/projects/${id}/generate-audio/${sampleLine.id}`, {}, {
        timeout: 60000
      });

      // Play the audio
      const audio = new Audio(response.data.audio_url);
      audioRef.current = audio;
      
      audio.onended = () => {
        setPlayingPreview(null);
      };
      
      audio.play();
      setPlayingPreview(character);
      
      // Update project to get the new audio URL
      fetchProject();
      
    } catch (error) {
      if (error.response?.status === 503) {
        toast.error("ElevenLabs not configured");
      } else {
        toast.error("Failed to preview voice");
      }
    } finally {
      setPreviewingVoice(null);
    }
  };

  const stopPreview = () => {
    if (audioRef.current) {
      audioRef.current.pause();
      audioRef.current = null;
    }
    setPlayingPreview(null);
  };

  const getEmotionColor = (emotion) => {
    const colors = {
      happy: "text-yellow-400",
      sad: "text-blue-400",
      angry: "text-red-400",
      fearful: "text-purple-400",
      screaming: "text-red-500",
      whispering: "text-gray-400",
      loving: "text-pink-400",
      desperate: "text-orange-400",
      sarcastic: "text-cyan-400",
      neutral: "text-muted-foreground"
    };
    return colors[emotion] || "text-muted-foreground";
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <Loader2 className="w-8 h-8 animate-spin text-purple-400" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background has-bottom-nav page-transition" data-testid="project-detail-page">
      {/* Header */}
      <header className="app-header border-b border-border">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-14 md:h-16">
            <div className="flex items-center gap-3 md:gap-4 min-w-0">
              <Link
                to="/dashboard"
                className="flex items-center gap-2 text-muted-foreground hover:text-foreground shrink-0"
              >
                <ArrowLeft className="w-5 h-5" />
              </Link>
              <h1 className="font-semibold truncate text-sm md:text-base">
                {project?.title}
              </h1>
            </div>

            {project?.scenes?.length > 0 && project?.user_character && (
              <Link to={`/reader/${id}`}>
                <Button className="btn-primary text-sm px-3 py-2 md:px-4 md:py-2 app-btn" data-testid="start-reader-btn">
                  <Play className="w-4 h-4 md:mr-2" />
                  <span className="hidden md:inline">Start Reader</span>
                </Button>
              </Link>
            )}
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-6 md:py-8 app-scroll">
        {/* Step 1: Upload Script */}
        {(!project?.scenes || project.scenes.length === 0) ? (
          <div className="text-center py-12 md:py-16">
            <div className="mb-6">
              <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-purple-500/10 text-purple-400 text-sm mb-4">
                <Sparkles className="w-4 h-4" />
                AI-Powered Analysis
              </div>
              <h2 className="text-xl md:text-2xl font-bold mb-2">Add Your Script</h2>
              <p className="text-muted-foreground text-sm md:text-base">
                AI will detect characters, emotions, and prepare voice readings
              </p>
            </div>
            
            {/* Two options: Upload PDF or Paste Text */}
            <div className="flex flex-col sm:flex-row gap-4 max-w-lg mx-auto">
              {/* Upload PDF */}
              <div
                className="flex-1 p-6 rounded-2xl border-2 border-dashed border-border hover:border-purple-500/50 transition cursor-pointer app-card"
                onClick={() => fileInputRef.current?.click()}
                data-testid="upload-area"
              >
                <input
                  ref={fileInputRef}
                  type="file"
                  accept=".pdf"
                  onChange={handleFileUpload}
                  className="hidden"
                  data-testid="pdf-upload-input"
                />
                
                {uploading ? (
                  <div className="flex flex-col items-center">
                    <Loader2 className="w-10 h-10 text-purple-400 animate-spin mb-3" />
                    <p className="font-medium">
                      {analyzing ? "Analyzing..." : "Uploading..."}
                    </p>
                  </div>
                ) : (
                  <>
                    <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-purple-500/20 to-pink-500/20 flex items-center justify-center mx-auto mb-3">
                      <Upload className="w-6 h-6 text-purple-400" />
                    </div>
                    <h3 className="font-medium mb-1">Upload PDF</h3>
                    <p className="text-muted-foreground text-xs">
                      Drop or tap to browse
                    </p>
                  </>
                )}
              </div>
              
              {/* Paste Script */}
              <div
                className="flex-1 p-6 rounded-2xl border-2 border-dashed border-border hover:border-pink-500/50 transition cursor-pointer app-card"
                onClick={() => setShowPasteDialog(true)}
                data-testid="paste-script-btn"
              >
                <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-pink-500/20 to-purple-500/20 flex items-center justify-center mx-auto mb-3">
                  <ClipboardPaste className="w-6 h-6 text-pink-400" />
                </div>
                <h3 className="font-medium mb-1">Paste Script</h3>
                <p className="text-muted-foreground text-xs">
                  Copy & paste text
                </p>
              </div>
            </div>
            
            <p className="text-xs text-muted-foreground mt-4">
              Supported format: CHARACTER: dialogue or CHARACTER on its own line
            </p>
          </div>
        ) : (
          <div className="space-y-6">
            {/* AI Analysis Badge */}
            {project.ai_analyzed && (
              <div className="flex items-center gap-2 p-3 rounded-xl bg-green-500/10 border border-green-500/20">
                <Sparkles className="w-5 h-5 text-green-400" />
                <span className="text-sm text-green-400">AI Analysis Complete</span>
              </div>
            )}

            {/* Stats */}
            <div className="grid grid-cols-3 gap-3 md:gap-4">
              <div className="feature-card app-card p-4">
                <FileText className="w-5 h-5 text-purple-400 mb-2" />
                <p className="text-xl md:text-2xl font-bold">{getTotalLines()}</p>
                <p className="text-xs text-muted-foreground">Lines</p>
              </div>
              <div className="feature-card app-card p-4">
                <Users className="w-5 h-5 text-pink-400 mb-2" />
                <p className="text-xl md:text-2xl font-bold">{project.characters?.length || 0}</p>
                <p className="text-xs text-muted-foreground">Characters</p>
              </div>
              <div className="feature-card app-card p-4">
                <Mic className="w-5 h-5 text-green-400 mb-2" />
                <p className="text-xl md:text-2xl font-bold">{getUserLines()}</p>
                <p className="text-xs text-muted-foreground">Your Lines</p>
              </div>
            </div>

            {/* Step 2: Choose Character */}
            <div className="feature-card app-card">
              <div className="flex items-center gap-2 mb-4">
                <div className="w-8 h-8 rounded-full bg-purple-500/20 flex items-center justify-center">
                  <User className="w-4 h-4 text-purple-400" />
                </div>
                <h3 className="font-semibold">Choose Your Character</h3>
              </div>
              
              {/* Character Cards */}
              <div className="grid grid-cols-1 gap-3 mb-4">
                {project.characters?.map((char) => {
                  const analysis = getCharacterAnalysis(char);
                  const isSelected = selectedCharacter === char;
                  const isPreviewing = previewingVoice === char;
                  const isPlaying = playingPreview === char;
                  
                  return (
                    <div
                      key={char}
                      className={`p-3 rounded-xl transition ${
                        isSelected 
                          ? "bg-purple-500/20 border-2 border-purple-500" 
                          : "bg-secondary border-2 border-transparent"
                      }`}
                    >
                      <div className="flex items-center justify-between">
                        <button
                          onClick={() => setSelectedCharacter(char)}
                          className="flex-1 text-left app-btn"
                          data-testid={`character-btn-${char}`}
                        >
                          <p className="font-medium">{char}</p>
                          {analysis && (
                            <p className="text-xs text-muted-foreground mt-0.5">
                              {analysis.gender} • {analysis.age_group} • {analysis.voice_type}
                            </p>
                          )}
                        </button>
                        
                        {/* Voice Preview Button */}
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={(e) => {
                            e.stopPropagation();
                            if (isPlaying) {
                              stopPreview();
                            } else {
                              handlePreviewVoice(char);
                            }
                          }}
                          disabled={isPreviewing}
                          className="ml-2 shrink-0"
                          data-testid={`preview-voice-${char}`}
                        >
                          {isPreviewing ? (
                            <Loader2 className="w-4 h-4 animate-spin" />
                          ) : isPlaying ? (
                            <Pause className="w-4 h-4 text-purple-400" />
                          ) : (
                            <Volume2 className="w-4 h-4" />
                          )}
                        </Button>
                      </div>
                    </div>
                  );
                })}
              </div>
              
              <Button
                onClick={() => handleSetCharacter(selectedCharacter)}
                disabled={!selectedCharacter || selectedCharacter === project.user_character || settingCharacter}
                className="w-full btn-primary app-btn"
                data-testid="set-character-btn"
              >
                {settingCharacter ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : project.user_character === selectedCharacter ? (
                  <>
                    <Check className="w-4 h-4 mr-2" />
                    Selected
                  </>
                ) : (
                  "Confirm Character"
                )}
              </Button>
            </div>

            {/* Step 3: Generate AI Voices */}
            {project.user_character && (
              <div className="feature-card app-card">
                <div className="flex items-center gap-2 mb-4">
                  <div className="w-8 h-8 rounded-full bg-pink-500/20 flex items-center justify-center">
                    <Volume2 className="w-4 h-4 text-pink-400" />
                  </div>
                  <h3 className="font-semibold">AI Voice Reading</h3>
                </div>
                
                <p className="text-sm text-muted-foreground mb-4">
                  Generate emotional AI voices for all cue lines. The AI will read with the right feeling - angry, sad, screaming, etc.
                </p>
                
                <Button
                  onClick={handleGenerateAllAudio}
                  disabled={generatingAudio}
                  className="w-full bg-gradient-to-r from-pink-500 to-purple-500 hover:from-pink-600 hover:to-purple-600 app-btn"
                  data-testid="generate-audio-btn"
                >
                  {generatingAudio ? (
                    <>
                      <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                      Generating Voices...
                    </>
                  ) : (
                    <>
                      <Zap className="w-4 h-4 mr-2" />
                      Generate AI Voices
                    </>
                  )}
                </Button>
              </div>
            )}

            {/* Script Preview with Emotions */}
            <div className="feature-card app-card">
              <h3 className="font-semibold mb-4">Script Preview</h3>
              
              {!project.user_character && (
                <div className="flex items-center gap-2 p-3 rounded-lg bg-yellow-500/10 border border-yellow-500/20 mb-4">
                  <AlertCircle className="w-5 h-5 text-yellow-400 shrink-0" />
                  <p className="text-sm text-yellow-400">
                    Select your character above to start
                  </p>
                </div>
              )}
              
              <div className="space-y-3 max-h-[400px] overflow-y-auto momentum-scroll pr-2">
                {project.scenes?.map((scene) => (
                  <div key={scene.id}>
                    {scene.lines.slice(0, 15).map((line, idx) => (
                      <div
                        key={line.id}
                        className={`p-3 rounded-lg mb-2 ${
                          line.is_user_line
                            ? "bg-purple-500/10 border border-purple-500/20"
                            : "bg-secondary/50"
                        }`}
                        data-testid={`script-line-${idx}`}
                      >
                        <div className="flex items-center justify-between mb-1">
                          <span className="text-xs font-medium text-muted-foreground">
                            {line.character}
                            {line.is_user_line && <span className="text-purple-400 ml-1">(You)</span>}
                          </span>
                          {line.emotion && (
                            <span className={`text-xs ${getEmotionColor(line.emotion.emotion)}`}>
                              {line.emotion.emotion} • {line.emotion.intensity}
                            </span>
                          )}
                        </div>
                        <p className={`text-sm ${line.is_user_line ? "text-purple-200" : ""}`}>
                          {line.text}
                        </p>
                        {line.audio_url && (
                          <div className="mt-2">
                            <audio src={line.audio_url} controls className="w-full h-8" />
                          </div>
                        )}
                      </div>
                    ))}
                    {scene.lines.length > 15 && (
                      <p className="text-sm text-muted-foreground text-center py-2">
                        ...and {scene.lines.length - 15} more lines
                      </p>
                    )}
                  </div>
                ))}
              </div>
            </div>

            {/* Start Rehearsal CTA */}
            {project.user_character && (
              <div className="space-y-3">
                <Link to={`/reader/${id}`} className="block">
                  <Button className="w-full h-14 btn-primary text-lg app-btn" data-testid="start-rehearsal-btn">
                    <Play className="w-5 h-5 mr-2" />
                    Start Rehearsal
                  </Button>
                </Link>
                
                <Link to={`/record/${id}`} className="block">
                  <Button 
                    variant="outline" 
                    className="w-full h-12 border-pink-500/50 text-pink-400 hover:bg-pink-500/10 app-btn"
                    data-testid="record-self-tape-btn"
                  >
                    <Video className="w-5 h-5 mr-2" />
                    Record Self-Tape
                  </Button>
                </Link>
              </div>
            )}
          </div>
        )}
      </main>
    </div>
  );
};

export default ProjectDetail;
