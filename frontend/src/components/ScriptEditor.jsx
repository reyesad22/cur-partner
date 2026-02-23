import { useState, useEffect, useRef } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { api } from "@/App";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  ArrowLeft,
  Save,
  Plus,
  Trash2,
  User,
  MessageSquare,
  AlertCircle,
  Loader2,
  GripVertical,
  Volume2,
  Play,
  Pause,
  ChevronUp,
  ChevronDown
} from "lucide-react";
import { toast } from "sonner";

const LINE_TYPES = [
  { value: "dialogue", label: "Dialogue", icon: MessageSquare },
  { value: "parenthetical", label: "Parenthetical", icon: AlertCircle },
  { value: "action", label: "Stage Direction", icon: null },
];

const ScriptEditor = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  
  const [project, setProject] = useState(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [lines, setLines] = useState([]);
  const [characters, setCharacters] = useState([]);
  const [hasChanges, setHasChanges] = useState(false);
  const [showAddCharacter, setShowAddCharacter] = useState(false);
  const [newCharacterName, setNewCharacterName] = useState("");
  const [playingAudio, setPlayingAudio] = useState(null);
  const audioRef = useRef(null);

  useEffect(() => {
    fetchProject();
  }, [id]);

  const fetchProject = async () => {
    try {
      const response = await api.get(`/projects/${id}`);
      setProject(response.data);
      
      // Flatten lines from scenes
      const allLines = response.data.scenes?.reduce((acc, scene) => {
        return [...acc, ...scene.lines.map(line => ({
          ...line,
          type: line.parenthetical ? "parenthetical" : "dialogue"
        }))];
      }, []) || [];
      
      setLines(allLines);
      setCharacters(response.data.characters || []);
    } catch (error) {
      toast.error("Failed to load project");
      navigate("/dashboard");
    } finally {
      setLoading(false);
    }
  };

  const handleLineChange = (index, field, value) => {
    const newLines = [...lines];
    newLines[index] = { ...newLines[index], [field]: value };
    
    // If changing to parenthetical, wrap in parentheses if not already
    if (field === "type" && value === "parenthetical") {
      const text = newLines[index].text;
      if (!text.startsWith("(")) {
        newLines[index].text = `(${text.replace(/^\(|\)$/g, '')})`;
      }
    }
    
    // Clear audio URL when text changes (needs regeneration)
    if (field === "text") {
      newLines[index].audio_url = null;
    }
    
    setLines(newLines);
    setHasChanges(true);
  };

  const addLine = (afterIndex = lines.length - 1) => {
    const newLine = {
      id: `new-${Date.now()}`,
      character: characters[0] || "CHARACTER",
      text: "",
      type: "dialogue",
      line_number: afterIndex + 2,
      is_user_line: false,
      emotion: null,
      audio_url: null
    };
    
    const newLines = [...lines];
    newLines.splice(afterIndex + 1, 0, newLine);
    
    // Update line numbers
    newLines.forEach((line, idx) => {
      line.line_number = idx + 1;
    });
    
    setLines(newLines);
    setHasChanges(true);
  };

  const deleteLine = (index) => {
    if (lines.length <= 1) {
      toast.error("Cannot delete the last line");
      return;
    }
    
    const newLines = lines.filter((_, idx) => idx !== index);
    
    // Update line numbers
    newLines.forEach((line, idx) => {
      line.line_number = idx + 1;
    });
    
    setLines(newLines);
    setHasChanges(true);
  };

  const moveLine = (index, direction) => {
    const newIndex = direction === "up" ? index - 1 : index + 1;
    if (newIndex < 0 || newIndex >= lines.length) return;
    
    const newLines = [...lines];
    [newLines[index], newLines[newIndex]] = [newLines[newIndex], newLines[index]];
    
    // Update line numbers
    newLines.forEach((line, idx) => {
      line.line_number = idx + 1;
    });
    
    setLines(newLines);
    setHasChanges(true);
  };

  const addCharacter = () => {
    if (!newCharacterName.trim()) return;
    
    const name = newCharacterName.trim().toUpperCase();
    if (characters.includes(name)) {
      toast.error("Character already exists");
      return;
    }
    
    setCharacters([...characters, name]);
    setNewCharacterName("");
    setShowAddCharacter(false);
    setHasChanges(true);
  };

  const handleSave = async () => {
    setSaving(true);
    
    try {
      // Format lines back into scenes structure
      const formattedLines = lines.map((line, idx) => ({
        id: line.id.startsWith("new-") ? undefined : line.id,
        character: line.character,
        text: line.text,
        line_number: idx + 1,
        is_user_line: line.character === project?.user_character,
        emotion: line.emotion,
        audio_url: null, // Clear audio - will regenerate
        parenthetical: line.type === "parenthetical" ? line.text : null
      }));

      // Save to backend
      const response = await api.put(`/projects/${id}/script`, {
        lines: formattedLines,
        characters: characters
      });
      
      setProject(response.data);
      setHasChanges(false);
      
      // Auto-generate voices
      toast.info("Generating AI voices for updated script...");
      
      try {
        const voiceResponse = await api.post(`/projects/${id}/generate-voices`);
        setProject(voiceResponse.data);
        
        // Update lines with new audio URLs
        const updatedLines = voiceResponse.data.scenes?.reduce((acc, scene) => {
          return [...acc, ...scene.lines];
        }, []) || [];
        setLines(updatedLines);
        
        toast.success("Script saved and voices generated!");
      } catch (voiceError) {
        console.error("Voice generation error:", voiceError);
        toast.warning("Script saved but voice generation failed. You can regenerate later.");
      }
      
    } catch (error) {
      console.error("Save error:", error);
      toast.error(error.response?.data?.detail || "Failed to save script");
    } finally {
      setSaving(false);
    }
  };

  const playAudio = (lineId, audioUrl) => {
    if (!audioUrl) {
      toast.error("No audio available. Save to generate voices.");
      return;
    }
    
    if (playingAudio === lineId) {
      audioRef.current?.pause();
      setPlayingAudio(null);
      return;
    }
    
    if (audioRef.current) {
      audioRef.current.pause();
    }
    
    const audio = new Audio(audioUrl);
    audioRef.current = audio;
    
    audio.onended = () => setPlayingAudio(null);
    audio.onerror = () => {
      toast.error("Failed to play audio");
      setPlayingAudio(null);
    };
    
    audio.play();
    setPlayingAudio(lineId);
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <Loader2 className="w-8 h-8 animate-spin text-purple-400" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background flex flex-col" data-testid="script-editor">
      {/* Header */}
      <header className="app-header border-b border-border shrink-0 sticky top-0 z-10 bg-background">
        <div className="max-w-5xl mx-auto px-4">
          <div className="flex items-center justify-between h-14">
            <div className="flex items-center gap-3">
              <Button
                variant="ghost"
                size="icon"
                onClick={() => {
                  if (hasChanges) {
                    if (confirm("You have unsaved changes. Discard them?")) {
                      navigate(`/project/${id}`);
                    }
                  } else {
                    navigate(`/project/${id}`);
                  }
                }}
                data-testid="back-btn"
              >
                <ArrowLeft className="w-5 h-5" />
              </Button>
              <div>
                <h1 className="font-semibold text-sm">{project?.title}</h1>
                <p className="text-xs text-muted-foreground">Script Editor</p>
              </div>
            </div>

            <Button
              onClick={handleSave}
              disabled={saving || !hasChanges}
              className="bg-gradient-to-r from-purple-500 to-pink-500"
              data-testid="save-btn"
            >
              {saving ? (
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
              ) : (
                <Save className="w-4 h-4 mr-2" />
              )}
              {saving ? "Saving..." : "Save & Generate Voices"}
            </Button>
          </div>
        </div>
      </header>

      {/* Main Editor */}
      <div className="flex-1 overflow-y-auto">
        <div className="max-w-4xl mx-auto px-4 py-6">
          {/* Lines */}
          <div className="space-y-4">
            {lines.map((line, index) => (
              <div
                key={line.id}
                className="group bg-card border border-border rounded-lg p-4 hover:border-purple-500/50 transition-colors"
                data-testid={`script-line-${index}`}
              >
                <div className="flex items-start gap-3">
                  {/* Drag Handle & Line Number */}
                  <div className="flex flex-col items-center gap-1 pt-2 opacity-50 group-hover:opacity-100">
                    <span className="text-xs text-muted-foreground">{index + 1}</span>
                    <div className="flex flex-col gap-0.5">
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-6 w-6"
                        onClick={() => moveLine(index, "up")}
                        disabled={index === 0}
                      >
                        <ChevronUp className="w-3 h-3" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-6 w-6"
                        onClick={() => moveLine(index, "down")}
                        disabled={index === lines.length - 1}
                      >
                        <ChevronDown className="w-3 h-3" />
                      </Button>
                    </div>
                  </div>

                  {/* Main Content */}
                  <div className="flex-1 space-y-3">
                    {/* Character & Type Row */}
                    <div className="flex items-center gap-3">
                      <Select
                        value={line.character}
                        onValueChange={(value) => {
                          if (value === "__add_new__") {
                            setShowAddCharacter(true);
                          } else {
                            handleLineChange(index, "character", value);
                          }
                        }}
                      >
                        <SelectTrigger className="w-40" data-testid={`character-select-${index}`}>
                          <User className="w-4 h-4 mr-2 text-purple-400" />
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {characters.map((char) => (
                            <SelectItem key={char} value={char}>
                              {char}
                            </SelectItem>
                          ))}
                          <SelectItem value="__add_new__" className="text-purple-400">
                            + Add Character
                          </SelectItem>
                        </SelectContent>
                      </Select>

                      <Select
                        value={line.type || "dialogue"}
                        onValueChange={(value) => handleLineChange(index, "type", value)}
                      >
                        <SelectTrigger className="w-36" data-testid={`type-select-${index}`}>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {LINE_TYPES.map((type) => (
                            <SelectItem key={type.value} value={type.value}>
                              {type.label}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>

                      {/* Play Audio Button */}
                      <Button
                        variant="ghost"
                        size="icon"
                        className={`h-8 w-8 ${line.audio_url ? 'text-purple-400' : 'text-muted-foreground'}`}
                        onClick={() => playAudio(line.id, line.audio_url)}
                        title={line.audio_url ? "Play audio" : "No audio - save to generate"}
                      >
                        {playingAudio === line.id ? (
                          <Pause className="w-4 h-4" />
                        ) : (
                          <Volume2 className="w-4 h-4" />
                        )}
                      </Button>
                    </div>

                    {/* Dialogue Text */}
                    <Textarea
                      value={line.text}
                      onChange={(e) => handleLineChange(index, "text", e.target.value)}
                      placeholder={line.type === "parenthetical" ? "(emotion or action)" : "Enter dialogue..."}
                      className={`min-h-[80px] resize-none ${
                        line.type === "parenthetical" 
                          ? "italic text-muted-foreground" 
                          : line.type === "action"
                            ? "text-muted-foreground"
                            : ""
                      }`}
                      data-testid={`dialogue-input-${index}`}
                    />
                  </div>

                  {/* Actions */}
                  <div className="flex flex-col gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-8 w-8 text-muted-foreground hover:text-green-400"
                      onClick={() => addLine(index)}
                      title="Add line below"
                    >
                      <Plus className="w-4 h-4" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-8 w-8 text-muted-foreground hover:text-red-400"
                      onClick={() => deleteLine(index)}
                      title="Delete line"
                    >
                      <Trash2 className="w-4 h-4" />
                    </Button>
                  </div>
                </div>
              </div>
            ))}
          </div>

          {/* Add Line Button */}
          <div className="mt-6 flex justify-center">
            <Button
              variant="outline"
              onClick={() => addLine()}
              className="border-dashed"
              data-testid="add-line-btn"
            >
              <Plus className="w-4 h-4 mr-2" />
              Add New Line
            </Button>
          </div>
        </div>
      </div>

      {/* Bottom Toolbar */}
      <div className="border-t border-border bg-card shrink-0 safe-area-bottom">
        <div className="max-w-4xl mx-auto px-4 py-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <span>{lines.length} lines</span>
              <span>•</span>
              <span>{characters.length} characters</span>
              {hasChanges && (
                <>
                  <span>•</span>
                  <span className="text-yellow-400">Unsaved changes</span>
                </>
              )}
            </div>
            
            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => setShowAddCharacter(true)}
              >
                <User className="w-4 h-4 mr-2" />
                Add Character
              </Button>
            </div>
          </div>
        </div>
      </div>

      {/* Add Character Dialog */}
      <Dialog open={showAddCharacter} onOpenChange={setShowAddCharacter}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Add New Character</DialogTitle>
          </DialogHeader>
          <div className="py-4">
            <Input
              value={newCharacterName}
              onChange={(e) => setNewCharacterName(e.target.value.toUpperCase())}
              placeholder="Character name (e.g., JOHN)"
              className="uppercase"
              onKeyDown={(e) => e.key === "Enter" && addCharacter()}
              data-testid="new-character-input"
            />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowAddCharacter(false)}>
              Cancel
            </Button>
            <Button onClick={addCharacter} disabled={!newCharacterName.trim()}>
              Add Character
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default ScriptEditor;
