import { useState, useEffect, useRef } from "react";
import { useParams, useNavigate, Link } from "react-router-dom";
import { api } from "@/App";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
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
  AlertCircle
} from "lucide-react";
import { toast } from "sonner";

const ProjectDetail = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const fileInputRef = useRef(null);
  
  const [project, setProject] = useState(null);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [selectedCharacter, setSelectedCharacter] = useState("");
  const [settingCharacter, setSettingCharacter] = useState(false);

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
    const formData = new FormData();
    formData.append("file", file);

    try {
      const response = await api.post(`/projects/${id}/upload-pdf`, formData, {
        headers: { "Content-Type": "multipart/form-data" }
      });
      setProject(response.data);
      toast.success("Script uploaded and parsed!");
    } catch (error) {
      toast.error(error.response?.data?.detail || "Failed to upload PDF");
    } finally {
      setUploading(false);
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
      toast.success(`You're now playing ${character}`);
    } catch (error) {
      toast.error("Failed to set character");
    } finally {
      setSettingCharacter(false);
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

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <Loader2 className="w-8 h-8 animate-spin text-purple-400" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background has-bottom-nav" data-testid="project-detail-page">
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
                <Button className="btn-primary text-sm px-3 py-2 md:px-4 md:py-2" data-testid="start-reader-btn">
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
        {/* Script Upload Section */}
        {(!project?.scenes || project.scenes.length === 0) ? (
          <div className="text-center py-16">
            <div
              className="w-full max-w-md mx-auto p-8 rounded-2xl border-2 border-dashed border-border hover:border-purple-500/50 transition cursor-pointer"
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
                  <Loader2 className="w-12 h-12 text-purple-400 animate-spin mb-4" />
                  <p className="text-lg font-medium">Parsing your script...</p>
                  <p className="text-sm text-muted-foreground">
                    Detecting characters and dialogue
                  </p>
                </div>
              ) : (
                <>
                  <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-purple-500/20 to-pink-500/20 flex items-center justify-center mx-auto mb-4">
                    <Upload className="w-8 h-8 text-purple-400" />
                  </div>
                  <h3 className="text-lg font-medium mb-2">Upload Your Script</h3>
                  <p className="text-muted-foreground text-sm mb-4">
                    Drop your PDF script here or click to browse
                  </p>
                  <p className="text-xs text-muted-foreground">
                    We'll automatically detect characters and dialogue
                  </p>
                </>
              )}
            </div>
          </div>
        ) : (
          <div className="space-y-8">
            {/* Stats Cards */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <div className="feature-card">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl bg-purple-500/20 flex items-center justify-center">
                    <FileText className="w-5 h-5 text-purple-400" />
                  </div>
                  <div>
                    <p className="text-2xl font-bold">{getTotalLines()}</p>
                    <p className="text-sm text-muted-foreground">Total Lines</p>
                  </div>
                </div>
              </div>
              
              <div className="feature-card">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl bg-pink-500/20 flex items-center justify-center">
                    <Users className="w-5 h-5 text-pink-400" />
                  </div>
                  <div>
                    <p className="text-2xl font-bold">{project.characters?.length || 0}</p>
                    <p className="text-sm text-muted-foreground">Characters</p>
                  </div>
                </div>
              </div>
              
              <div className="feature-card">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl bg-green-500/20 flex items-center justify-center">
                    <Mic className="w-5 h-5 text-green-400" />
                  </div>
                  <div>
                    <p className="text-2xl font-bold">{getUserLines()}</p>
                    <p className="text-sm text-muted-foreground">Your Lines</p>
                  </div>
                </div>
              </div>
            </div>

            {/* Character Selection */}
            <div className="feature-card">
              <h3 className="text-lg font-semibold mb-4">Select Your Character</h3>
              <p className="text-sm text-muted-foreground mb-4">
                Choose the character you'll be playing. Your lines will be highlighted differently.
              </p>
              
              <div className="flex flex-col sm:flex-row gap-4">
                <div className="flex-1">
                  <Select
                    value={selectedCharacter}
                    onValueChange={(value) => setSelectedCharacter(value)}
                    disabled={settingCharacter}
                  >
                    <SelectTrigger className="bg-secondary border-border" data-testid="character-select">
                      <SelectValue placeholder="Select your character" />
                    </SelectTrigger>
                    <SelectContent className="bg-card border-border">
                      {project.characters?.map((char) => (
                        <SelectItem key={char} value={char} data-testid={`character-option-${char}`}>
                          {char}
                          {char === project.user_character && (
                            <span className="ml-2 text-green-400">(Current)</span>
                          )}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                
                <Button
                  onClick={() => handleSetCharacter(selectedCharacter)}
                  disabled={!selectedCharacter || selectedCharacter === project.user_character || settingCharacter}
                  className="btn-primary"
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
                    "Set Character"
                  )}
                </Button>
              </div>
            </div>

            {/* Script Preview */}
            <div className="feature-card">
              <h3 className="text-lg font-semibold mb-4">Script Preview</h3>
              
              {!project.user_character && (
                <div className="flex items-center gap-2 p-3 rounded-lg bg-yellow-500/10 border border-yellow-500/20 mb-4">
                  <AlertCircle className="w-5 h-5 text-yellow-400" />
                  <p className="text-sm text-yellow-400">
                    Select your character above to start rehearsing
                  </p>
                </div>
              )}
              
              <div className="space-y-4 max-h-[500px] overflow-y-auto pr-2">
                {project.scenes?.map((scene) => (
                  <div key={scene.id}>
                    <h4 className="text-sm font-medium text-purple-400 mb-3">{scene.name}</h4>
                    <div className="space-y-3">
                      {scene.lines.slice(0, 20).map((line, idx) => (
                        <div
                          key={line.id}
                          className={`p-3 rounded-lg ${
                            line.is_user_line
                              ? "bg-purple-500/10 border border-purple-500/20"
                              : "bg-secondary"
                          }`}
                          data-testid={`script-line-${idx}`}
                        >
                          <p className="text-xs text-muted-foreground mb-1">
                            {line.character}
                            {line.is_user_line && (
                              <span className="ml-2 text-purple-400">(You)</span>
                            )}
                          </p>
                          <p className={line.is_user_line ? "text-purple-200" : ""}>
                            {line.text}
                          </p>
                        </div>
                      ))}
                      {scene.lines.length > 20 && (
                        <p className="text-sm text-muted-foreground text-center py-2">
                          ...and {scene.lines.length - 20} more lines
                        </p>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Upload New Script */}
            <div className="feature-card">
              <h3 className="text-lg font-semibold mb-2">Replace Script</h3>
              <p className="text-sm text-muted-foreground mb-4">
                Upload a different PDF to replace the current script
              </p>
              <div className="flex items-center gap-4">
                <Button
                  variant="outline"
                  onClick={() => fileInputRef.current?.click()}
                  disabled={uploading}
                  data-testid="replace-script-btn"
                >
                  {uploading ? (
                    <Loader2 className="w-4 h-4 animate-spin mr-2" />
                  ) : (
                    <Upload className="w-4 h-4 mr-2" />
                  )}
                  Upload New PDF
                </Button>
                <input
                  ref={fileInputRef}
                  type="file"
                  accept=".pdf"
                  onChange={handleFileUpload}
                  className="hidden"
                />
              </div>
            </div>
          </div>
        )}
      </main>
    </div>
  );
};

export default ProjectDetail;
