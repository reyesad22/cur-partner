import { useState, useEffect } from "react";
import { api } from "@/App";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Volume2, Play, Pause, Loader2, Wand2, User } from "lucide-react";
import { toast } from "sonner";

// Voice presets with ElevenLabs voice IDs
const VOICE_PRESETS = {
  male: {
    young: [
      { id: "IKne3meq5aSn9XLyUdCD", name: "Charlie", accent: "Australian", style: "Deep, Confident" },
      { id: "SOYHLrjzK2X1ezoPC6cr", name: "Harry", accent: "American", style: "Fierce, Warrior" },
      { id: "TX3LPaxmHKxFdv7VOQHJ", name: "Liam", accent: "American", style: "Energetic" },
      { id: "bIHbv24MWmeRgasZH58o", name: "Will", accent: "American", style: "Relaxed, Optimist" },
    ],
    middle_aged: [
      { id: "CwhRBWXzGAHq8TQ4Fs17", name: "Roger", accent: "American", style: "Laid-Back, Casual" },
      { id: "JBFqnCBsd6RMkjVDRZzb", name: "George", accent: "British", style: "Warm, Storyteller" },
      { id: "N2lVS1w4EtoT3dr4eOWO", name: "Callum", accent: "American", style: "Husky" },
      { id: "cjVigY5qzO86Huf0OWal", name: "Eric", accent: "American", style: "Smooth, Trustworthy" },
    ],
    elderly: [
      { id: "VR6AewLTigWG4xSOukaG", name: "Arnold", accent: "American", style: "Mature, Wise" },
      { id: "JBFqnCBsd6RMkjVDRZzb", name: "George", accent: "British", style: "Warm, Storyteller" },
    ]
  },
  female: {
    young: [
      { id: "EXAVITQu4vr4xnSDxMaL", name: "Sarah", accent: "American", style: "Mature, Confident" },
      { id: "FGY2WhTYpPnrIDTdsKH5", name: "Laura", accent: "American", style: "Enthusiastic, Quirky" },
      { id: "cgSgspJ2msm6clMCkdW9", name: "Jessica", accent: "American", style: "Playful, Warm" },
    ],
    middle_aged: [
      { id: "Xb7hH8MSUJpSbSDYk0k2", name: "Alice", accent: "British", style: "Clear, Engaging" },
      { id: "XrExE9yKIg1WjnnlVkGX", name: "Matilda", accent: "American", style: "Professional" },
      { id: "hpp4J3VqNfWAUOO0d1Us", name: "Bella", accent: "American", style: "Professional, Warm" },
    ],
    elderly: [
      { id: "ThT5KcBeYPX3keUQqHPh", name: "Dorothy", accent: "American", style: "Mature, Gentle" },
      { id: "Xb7hH8MSUJpSbSDYk0k2", name: "Alice", accent: "British", style: "Clear, Engaging" },
    ]
  },
  neutral: {
    all: [
      { id: "SAz9YHcvj6GT2YYXdXww", name: "River", accent: "American", style: "Relaxed, Neutral" },
    ]
  }
};

const VoiceSelector = ({ 
  isOpen, 
  onClose, 
  characters, 
  characterAnalysis,
  projectId,
  onVoicesUpdated 
}) => {
  const [voiceSelections, setVoiceSelections] = useState({});
  const [playingVoice, setPlayingVoice] = useState(null);
  const [generating, setGenerating] = useState(false);
  const [useAI, setUseAI] = useState(true);
  const audioRef = useState(null);

  useEffect(() => {
    // Initialize selections from character analysis
    const initial = {};
    characters.forEach(char => {
      const analysis = characterAnalysis?.find(a => a.name === char);
      initial[char] = {
        gender: analysis?.gender || "male",
        age: analysis?.age_group || "middle_aged",
        voiceId: analysis?.voice_id || null,
        voiceName: null
      };
    });
    setVoiceSelections(initial);
  }, [characters, characterAnalysis]);

  const getVoicesForSelection = (gender, age) => {
    if (gender === "neutral") {
      return VOICE_PRESETS.neutral.all;
    }
    return VOICE_PRESETS[gender]?.[age] || VOICE_PRESETS[gender]?.middle_aged || [];
  };

  const handleGenderChange = (char, gender) => {
    setVoiceSelections(prev => ({
      ...prev,
      [char]: {
        ...prev[char],
        gender,
        voiceId: null, // Reset voice when gender changes
        voiceName: null
      }
    }));
  };

  const handleAgeChange = (char, age) => {
    setVoiceSelections(prev => ({
      ...prev,
      [char]: {
        ...prev[char],
        age,
        voiceId: null, // Reset voice when age changes
        voiceName: null
      }
    }));
  };

  const handleVoiceChange = (char, voiceId, voiceName) => {
    setVoiceSelections(prev => ({
      ...prev,
      [char]: {
        ...prev[char],
        voiceId,
        voiceName
      }
    }));
  };

  const previewVoice = async (voiceId, voiceName) => {
    if (playingVoice === voiceId) {
      // Stop playing
      setPlayingVoice(null);
      return;
    }

    setPlayingVoice(voiceId);
    
    try {
      const response = await api.post('/voice-preview', {
        voice_id: voiceId,
        text: `Hello, I'm ${voiceName}. This is how I sound when reading your script.`
      });
      
      if (response.data.audio_url) {
        const audio = new Audio(response.data.audio_url);
        audio.onended = () => setPlayingVoice(null);
        audio.onerror = () => {
          setPlayingVoice(null);
          toast.error("Failed to play preview");
        };
        await audio.play();
      }
    } catch (error) {
      setPlayingVoice(null);
      toast.error("Failed to generate preview");
    }
  };

  const handleGenerate = async () => {
    setGenerating(true);
    
    try {
      if (useAI) {
        // Use AI to generate voices
        const response = await api.post(`/projects/${projectId}/generate-all-audio`);
        toast.success("AI voices generated successfully!");
        onVoicesUpdated(response.data);
      } else {
        // Use manual selections
        const voiceConfig = {};
        Object.entries(voiceSelections).forEach(([char, sel]) => {
          if (sel.voiceId) {
            voiceConfig[char] = {
              voice_id: sel.voiceId,
              gender: sel.gender,
              age_group: sel.age
            };
          }
        });
        
        const response = await api.post(`/projects/${projectId}/generate-voices-manual`, {
          voice_config: voiceConfig
        });
        
        toast.success("Voices generated with your selections!");
        onVoicesUpdated(response.data);
      }
      
      onClose();
    } catch (error) {
      console.error("Voice generation error:", error);
      toast.error(error.response?.data?.detail || "Failed to generate voices");
    } finally {
      setGenerating(false);
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Volume2 className="w-5 h-5 text-purple-400" />
            Voice Settings
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-6 py-4">
          {/* AI vs Manual Toggle */}
          <div className="bg-secondary/50 rounded-lg p-4">
            <Label className="text-base font-semibold mb-3 block">Voice Selection Method</Label>
            <RadioGroup
              value={useAI ? "ai" : "manual"}
              onValueChange={(v) => setUseAI(v === "ai")}
              className="flex gap-4"
            >
              <div className="flex items-center space-x-2">
                <RadioGroupItem value="ai" id="ai" />
                <Label htmlFor="ai" className="flex items-center gap-2 cursor-pointer">
                  <Wand2 className="w-4 h-4 text-purple-400" />
                  AI Auto-Select
                </Label>
              </div>
              <div className="flex items-center space-x-2">
                <RadioGroupItem value="manual" id="manual" />
                <Label htmlFor="manual" className="flex items-center gap-2 cursor-pointer">
                  <User className="w-4 h-4 text-pink-400" />
                  Manual Selection
                </Label>
              </div>
            </RadioGroup>
            <p className="text-xs text-muted-foreground mt-2">
              {useAI 
                ? "AI will analyze characters and select appropriate voices based on gender, age, and personality."
                : "Choose specific voices for each character manually."
              }
            </p>
          </div>

          {/* Manual Voice Selection */}
          {!useAI && (
            <div className="space-y-4">
              <Label className="text-base font-semibold">Configure Voices</Label>
              
              {characters.map(char => {
                const selection = voiceSelections[char] || { gender: "male", age: "middle_aged" };
                const availableVoices = getVoicesForSelection(selection.gender, selection.age);
                
                return (
                  <div 
                    key={char} 
                    className="bg-card border border-border rounded-lg p-4 space-y-3"
                  >
                    <div className="font-semibold text-purple-400">{char}</div>
                    
                    <div className="grid grid-cols-2 gap-3">
                      {/* Gender */}
                      <div>
                        <Label className="text-xs text-muted-foreground">Gender</Label>
                        <Select
                          value={selection.gender}
                          onValueChange={(v) => handleGenderChange(char, v)}
                        >
                          <SelectTrigger className="mt-1">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="male">Male</SelectItem>
                            <SelectItem value="female">Female</SelectItem>
                            <SelectItem value="neutral">Neutral</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                      
                      {/* Age */}
                      <div>
                        <Label className="text-xs text-muted-foreground">Age</Label>
                        <Select
                          value={selection.age}
                          onValueChange={(v) => handleAgeChange(char, v)}
                          disabled={selection.gender === "neutral"}
                        >
                          <SelectTrigger className="mt-1">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="young">Young (20s-30s)</SelectItem>
                            <SelectItem value="middle_aged">Middle Aged (40s-50s)</SelectItem>
                            <SelectItem value="elderly">Elderly (60+)</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                    </div>
                    
                    {/* Voice Selection */}
                    <div>
                      <Label className="text-xs text-muted-foreground">Voice</Label>
                      <div className="grid grid-cols-2 gap-2 mt-1">
                        {availableVoices.map(voice => (
                          <Button
                            key={voice.id}
                            variant={selection.voiceId === voice.id ? "default" : "outline"}
                            size="sm"
                            className={`justify-start h-auto py-2 px-3 ${
                              selection.voiceId === voice.id 
                                ? "bg-purple-500 hover:bg-purple-600" 
                                : ""
                            }`}
                            onClick={() => handleVoiceChange(char, voice.id, voice.name)}
                          >
                            <div className="flex flex-col items-start text-left">
                              <span className="font-medium">{voice.name}</span>
                              <span className="text-xs opacity-70">
                                {voice.accent} • {voice.style}
                              </span>
                            </div>
                          </Button>
                        ))}
                      </div>
                    </div>
                    
                    {/* Preview Button */}
                    {selection.voiceId && (
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => previewVoice(selection.voiceId, selection.voiceName)}
                        className="w-full"
                      >
                        {playingVoice === selection.voiceId ? (
                          <>
                            <Pause className="w-4 h-4 mr-2" />
                            Stop Preview
                          </>
                        ) : (
                          <>
                            <Play className="w-4 h-4 mr-2" />
                            Preview Voice
                          </>
                        )}
                      </Button>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={onClose} disabled={generating}>
            Cancel
          </Button>
          <Button 
            onClick={handleGenerate} 
            disabled={generating}
            className="bg-gradient-to-r from-purple-500 to-pink-500"
          >
            {generating ? (
              <>
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                Generating...
              </>
            ) : (
              <>
                <Volume2 className="w-4 h-4 mr-2" />
                Generate Voices
              </>
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

export default VoiceSelector;
