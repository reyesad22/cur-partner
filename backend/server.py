from fastapi import FastAPI, APIRouter, HTTPException, Depends, UploadFile, File, status, Query
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from fastapi.responses import Response
from dotenv import load_dotenv
from starlette.middleware.cors import CORSMiddleware
from motor.motor_asyncio import AsyncIOMotorClient
import os
import logging
import re
import json
import base64
import time
import asyncio
from pathlib import Path
from pydantic import BaseModel, Field, ConfigDict, EmailStr
from typing import List, Optional, Literal
import uuid
from datetime import datetime, timezone, timedelta
import jwt
import bcrypt
from PyPDF2 import PdfReader
import io
import cloudinary
import cloudinary.utils
import cloudinary.uploader
import resend

# AI Integrations
from emergentintegrations.llm.chat import LlmChat, UserMessage
from elevenlabs import ElevenLabs
from elevenlabs.types import VoiceSettings

ROOT_DIR = Path(__file__).parent
load_dotenv(ROOT_DIR / '.env')

# MongoDB connection
mongo_url = os.environ['MONGO_URL']
client = AsyncIOMotorClient(mongo_url)
db = client[os.environ['DB_NAME']]

# API Keys
EMERGENT_LLM_KEY = os.environ.get('EMERGENT_LLM_KEY')
ELEVENLABS_API_KEY = os.environ.get('ELEVENLABS_API_KEY')

# Cloudinary configuration
CLOUDINARY_CONFIGURED = False
if os.environ.get('CLOUDINARY_CLOUD_NAME') and os.environ.get('CLOUDINARY_CLOUD_NAME') != 'your_cloud_name':
    cloudinary.config(
        cloud_name=os.environ.get('CLOUDINARY_CLOUD_NAME'),
        api_key=os.environ.get('CLOUDINARY_API_KEY'),
        api_secret=os.environ.get('CLOUDINARY_API_SECRET'),
        secure=True
    )
    CLOUDINARY_CONFIGURED = True

# Initialize ElevenLabs client
eleven_client = None
if ELEVENLABS_API_KEY and ELEVENLABS_API_KEY != 'your_elevenlabs_api_key_here':
    eleven_client = ElevenLabs(api_key=ELEVENLABS_API_KEY)

# Resend Email Configuration
RESEND_API_KEY = os.environ.get('RESEND_API_KEY')
SENDER_EMAIL = os.environ.get('SENDER_EMAIL', 'onboarding@resend.dev')
RESEND_CONFIGURED = bool(RESEND_API_KEY and RESEND_API_KEY != 'your_resend_api_key_here')
if RESEND_CONFIGURED:
    resend.api_key = RESEND_API_KEY

# JWT Configuration
JWT_SECRET = os.environ.get('JWT_SECRET', 'cuepartner-secret-key-change-in-production')
JWT_ALGORITHM = "HS256"
JWT_EXPIRATION_HOURS = 24

# Create the main app
app = FastAPI(title="CuePartner API", version="2.0.0")

# CORS Middleware - MUST be added early before routes
# Support both wildcard and specific origins
cors_origins_env = os.environ.get('CORS_ORIGINS', '*')
if cors_origins_env == "*":
    origins = ["*"]
else:
    origins = [o.strip() for o in cors_origins_env.split(',')]

app.add_middleware(
    CORSMiddleware,
    allow_origins=origins,
    allow_credentials=True if cors_origins_env != "*" else False,
    allow_methods=["GET", "POST", "PUT", "DELETE", "OPTIONS", "PATCH", "HEAD"],
    allow_headers=["*"],
    expose_headers=["*"],
    max_age=600,
)

# Root-level health check for deployment - MUST be registered early
@app.get("/health")
async def root_health_check():
    """Health check endpoint for Kubernetes deployment."""
    return {"status": "healthy"}

# Create a router with the /api prefix
api_router = APIRouter(prefix="/api")

# Security
security = HTTPBearer()

# ============== MODELS ==============

class UserBase(BaseModel):
    email: EmailStr
    name: str

class UserCreate(UserBase):
    password: str

class UserLogin(BaseModel):
    email: EmailStr
    password: str

class UserResponse(BaseModel):
    model_config = ConfigDict(extra="ignore")
    id: str
    email: str
    name: str
    created_at: str

class TokenResponse(BaseModel):
    access_token: str
    token_type: str = "bearer"
    user: UserResponse

class ProjectBase(BaseModel):
    title: str
    description: Optional[str] = ""

class ProjectCreate(ProjectBase):
    pass

class ProjectUpdate(BaseModel):
    title: Optional[str] = None
    description: Optional[str] = None

class CharacterAnalysis(BaseModel):
    name: str
    gender: str  # male, female, unknown
    age_group: str  # child, teen, adult, elderly
    voice_type: str  # description for voice selection
    suggested_voice_id: Optional[str] = None

class LineEmotion(BaseModel):
    emotion: str  # happy, sad, angry, fearful, surprised, disgusted, neutral, screaming, whispering
    intensity: str  # low, medium, high
    direction: Optional[str] = None  # e.g., "building anger", "breaking down"

class Line(BaseModel):
    model_config = ConfigDict(extra="ignore")
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    character: str
    text: str
    line_number: int
    is_user_line: bool = False
    emotion: Optional[LineEmotion] = None
    audio_url: Optional[str] = None

class Scene(BaseModel):
    model_config = ConfigDict(extra="ignore")
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    name: str
    lines: List[Line] = []

class ProjectResponse(BaseModel):
    model_config = ConfigDict(extra="ignore")
    id: str
    user_id: str
    title: str
    description: str
    scenes: List[Scene] = []
    characters: List[str] = []
    character_analysis: List[CharacterAnalysis] = []
    user_character: Optional[str] = None
    ai_analyzed: bool = False
    created_at: str
    updated_at: str

class SetUserCharacterRequest(BaseModel):
    character: str

class ReaderData(BaseModel):
    project_id: str
    project_title: str
    user_character: Optional[str]
    scenes: List[Scene]
    characters: List[str]
    character_analysis: List[CharacterAnalysis]

class GenerateAudioRequest(BaseModel):
    project_id: str
    line_id: str

class TTSResponse(BaseModel):
    audio_url: str
    line_id: str

# ============== TAKE MODELS ==============

class TakeCreate(BaseModel):
    project_id: str
    video_data: str  # Base64 encoded video
    duration: int  # seconds
    notes: Optional[str] = ""

class TakeResponse(BaseModel):
    model_config = ConfigDict(extra="ignore")
    id: str
    project_id: str
    user_id: str
    take_number: int
    duration: int
    notes: str
    is_favorite: bool
    video_url: str
    thumbnail_url: Optional[str] = None
    created_at: str

class TakeUpdate(BaseModel):
    notes: Optional[str] = None
    is_favorite: Optional[bool] = None

# ============== MEMBERSHIP MODELS ==============

class MembershipTier(BaseModel):
    tier: str  # free, pro
    cloud_storage_mb: int  # storage limit in MB
    features: List[str]

class UserMembership(BaseModel):
    tier: str = "free"
    cloud_storage_used_mb: float = 0
    cloud_storage_limit_mb: int = 0  # 0 for free = no cloud storage
    expires_at: Optional[str] = None

# ============== SHARE/SUBMISSION MODELS ==============

class ShareCreate(BaseModel):
    take_id: str
    recipient_email: Optional[str] = None
    recipient_name: Optional[str] = None
    message: Optional[str] = None
    expires_hours: int = 72  # Link expires after 72 hours

class ShareResponse(BaseModel):
    model_config = ConfigDict(extra="ignore")
    id: str
    take_id: str
    project_id: str
    share_token: str
    share_url: str
    recipient_email: Optional[str]
    recipient_name: Optional[str]
    message: Optional[str]
    views: int
    expires_at: str
    created_at: str

class CloudUploadSignature(BaseModel):
    signature: str
    timestamp: int
    cloud_name: str
    api_key: str
    folder: str
    resource_type: str

class DirectSubmissionRequest(BaseModel):
    recipient_email: EmailStr
    recipient_name: str
    message: Optional[str] = ""

class DirectSubmissionResponse(BaseModel):
    status: str
    message: str
    share_url: str
    email_sent: bool

class PasteScriptRequest(BaseModel):
    script_text: str

# ============== HELPER FUNCTIONS ==============

def hash_password(password: str) -> str:
    return bcrypt.hashpw(password.encode('utf-8'), bcrypt.gensalt()).decode('utf-8')

def verify_password(password: str, hashed: str) -> bool:
    return bcrypt.checkpw(password.encode('utf-8'), hashed.encode('utf-8'))

def create_token(user_id: str) -> str:
    payload = {
        "sub": user_id,
        "exp": datetime.now(timezone.utc) + timedelta(hours=JWT_EXPIRATION_HOURS),
        "iat": datetime.now(timezone.utc)
    }
    return jwt.encode(payload, JWT_SECRET, algorithm=JWT_ALGORITHM)

async def get_current_user(credentials: HTTPAuthorizationCredentials = Depends(security)):
    try:
        payload = jwt.decode(credentials.credentials, JWT_SECRET, algorithms=[JWT_ALGORITHM])
        user_id = payload.get("sub")
        if not user_id:
            raise HTTPException(status_code=401, detail="Invalid token")
        
        user = await db.users.find_one({"id": user_id}, {"_id": 0, "password": 0})
        if not user:
            raise HTTPException(status_code=401, detail="User not found")
        
        return user
    except jwt.ExpiredSignatureError:
        raise HTTPException(status_code=401, detail="Token expired")
    except jwt.InvalidTokenError:
        raise HTTPException(status_code=401, detail="Invalid token")

def parse_script_pdf(pdf_content: bytes) -> tuple[List[Scene], List[str]]:
    """Parse PDF script and extract scenes with dialogue."""
    reader = PdfReader(io.BytesIO(pdf_content))
    full_text = ""
    for page in reader.pages:
        page_text = page.extract_text()
        if page_text:
            full_text += page_text + "\n"
    
    logging.info(f"PDF extracted text length: {len(full_text)}")
    logging.info(f"First 500 chars: {full_text[:500]}")
    
    if not full_text.strip():
        logging.error("PDF extraction returned empty text")
        raise ValueError("Could not extract text from PDF. The PDF might be image-based or encrypted.")
    
    lines_data = []
    characters = set()
    current_character = None
    line_number = 0
    current_dialogue = []
    
    # Pattern for character names - more flexible
    # Matches: JOHN, SARAH (V.O.), DR. SMITH, MRS. JONES, DETECTIVE VAZIRI
    character_pattern = re.compile(r'^([A-Z][A-Z\s\-\'\.]+?)(?:\s*\([^)]*\))?\s*$')
    
    # Also try to match character names followed by colon
    # Matches: JOHN: or John:
    colon_pattern = re.compile(r'^([A-Za-z][A-Za-z\s\-\'\.]+?):\s*(.*)$')
    
    # Scene/action markers to skip
    skip_words = {'INT', 'EXT', 'FADE', 'CUT', 'SCENE', 'ACT', 'END', 'CONTINUED', 'CONT', 
                  'THE END', 'MORE', 'DISSOLVE', 'SMASH', 'INTERCUT', 'FLASHBACK', 
                  'BACK TO', 'ANGLE', 'CLOSE', 'WIDE', 'POV', 'INSERT', 'SUPER', 'TITLE',
                  'V.O.', 'O.S.', 'O.C.', 'CONT\'D'}
    
    text_lines = full_text.split('\n')
    
    for i, line in enumerate(text_lines):
        stripped = line.strip()
        if not stripped:
            # Empty line - save accumulated dialogue if any
            if current_character and current_dialogue:
                dialogue_text = ' '.join(current_dialogue).strip()
                if dialogue_text and len(dialogue_text) > 1:
                    line_number += 1
                    lines_data.append({
                        "id": str(uuid.uuid4()),
                        "character": current_character,
                        "text": dialogue_text,
                        "line_number": line_number,
                        "is_user_line": False,
                        "emotion": None,
                        "audio_url": None
                    })
                current_dialogue = []
            continue
        
        # First check for "CHARACTER: dialogue" format
        colon_match = colon_pattern.match(stripped)
        if colon_match:
            char_name = colon_match.group(1).strip()
            dialogue = colon_match.group(2).strip()
            
            # Check if it's a valid character name (not a scene direction)
            upper_name = char_name.upper()
            if not any(skip_word in upper_name for skip_word in skip_words):
                # Save previous dialogue
                if current_character and current_dialogue:
                    dialogue_text = ' '.join(current_dialogue).strip()
                    if dialogue_text and len(dialogue_text) > 1:
                        line_number += 1
                        lines_data.append({
                            "id": str(uuid.uuid4()),
                            "character": current_character,
                            "text": dialogue_text,
                            "line_number": line_number,
                            "is_user_line": False,
                            "emotion": None,
                            "audio_url": None
                        })
                    current_dialogue = []
                
                current_character = char_name.title()
                characters.add(current_character)
                if dialogue:
                    current_dialogue.append(dialogue)
                continue
        
        # Check if this is a character name (all caps on its own line)
        char_match = character_pattern.match(stripped)
        if char_match and len(stripped) < 50:
            potential_char = char_match.group(1).strip()
            
            # Must be mostly uppercase to be a character name
            uppercase_ratio = sum(1 for c in potential_char if c.isupper()) / max(len(potential_char.replace(' ','')), 1)
            if uppercase_ratio >= 0.7:
                # Skip scene directions and technical terms
                upper_char = potential_char.upper()
                if not any(skip_word in upper_char for skip_word in skip_words):
                    # Save any previous dialogue
                    if current_character and current_dialogue:
                        dialogue_text = ' '.join(current_dialogue).strip()
                        if dialogue_text and len(dialogue_text) > 1:
                            line_number += 1
                            lines_data.append({
                                "id": str(uuid.uuid4()),
                                "character": current_character,
                                "text": dialogue_text,
                                "line_number": line_number,
                                "is_user_line": False,
                                "emotion": None,
                                "audio_url": None
                            })
                        current_dialogue = []
                    
                    current_character = potential_char.title()
                    characters.add(current_character)
                    continue
        
        # If we have a current character, accumulate dialogue
        if current_character:
            # Skip parenthetical stage directions
            if stripped.startswith('(') and stripped.endswith(')'):
                continue
            # Skip page numbers
            if stripped.isdigit():
                continue
            # Skip very short lines that might be formatting
            if len(stripped) < 2:
                continue
            # Add to current dialogue
            current_dialogue.append(stripped)
    
    # Save any remaining dialogue
    if current_character and current_dialogue:
        dialogue_text = ' '.join(current_dialogue).strip()
        if dialogue_text and len(dialogue_text) > 1:
            line_number += 1
            lines_data.append({
                "id": str(uuid.uuid4()),
                "character": current_character,
                "text": dialogue_text,
                "line_number": line_number,
                "is_user_line": False,
                "emotion": None,
                "audio_url": None
            })
    
    logging.info(f"Parsed {len(lines_data)} lines with {len(characters)} characters: {characters}")
    
    if not lines_data:
        logging.warning("No dialogue lines found in PDF")
        # Return empty scene rather than failing
    
    scene = Scene(
        id=str(uuid.uuid4()),
        name="Main Scene",
        lines=[Line(**l) for l in lines_data]
    )
    
    return [scene], list(characters)

def parse_script_text(script_text: str) -> tuple[List[Scene], List[str]]:
    """Parse pasted script text and extract scenes with dialogue.
    Supports formats like:
    - CHARACTER: dialogue
    - CHARACTER
      dialogue
    - CHARACTER (V.O.): dialogue
    """
    lines_data = []
    characters = set()
    current_character = None
    line_number = 0
    current_dialogue = []
    
    # Pattern for "CHARACTER: dialogue" format
    colon_pattern = re.compile(r'^([A-Za-z][A-Za-z\s\-\'\.]+?)(?:\s*\([^)]*\))?:\s*(.*)$')
    
    # Pattern for standalone character names
    char_pattern = re.compile(r'^([A-Z][A-Z\s\-\'\.]+?)(?:\s*\([^)]*\))?\s*$')
    
    skip_words = {'INT', 'EXT', 'FADE', 'CUT', 'SCENE', 'ACT', 'END', 'CONTINUED'}
    
    for line in script_text.split('\n'):
        stripped = line.strip()
        
        if not stripped:
            if current_character and current_dialogue:
                dialogue_text = ' '.join(current_dialogue).strip()
                if dialogue_text:
                    line_number += 1
                    lines_data.append({
                        "id": str(uuid.uuid4()),
                        "character": current_character,
                        "text": dialogue_text,
                        "line_number": line_number,
                        "is_user_line": False,
                        "emotion": None,
                        "audio_url": None
                    })
                current_dialogue = []
            continue
        
        # Try colon format first: CHARACTER: dialogue
        colon_match = colon_pattern.match(stripped)
        if colon_match:
            char_name = colon_match.group(1).strip()
            dialogue = colon_match.group(2).strip()
            
            upper_name = char_name.upper()
            if not any(sw in upper_name for sw in skip_words) and len(char_name) < 40:
                if current_character and current_dialogue:
                    dialogue_text = ' '.join(current_dialogue).strip()
                    if dialogue_text:
                        line_number += 1
                        lines_data.append({
                            "id": str(uuid.uuid4()),
                            "character": current_character,
                            "text": dialogue_text,
                            "line_number": line_number,
                            "is_user_line": False,
                            "emotion": None,
                            "audio_url": None
                        })
                    current_dialogue = []
                
                current_character = char_name.title()
                characters.add(current_character)
                if dialogue:
                    current_dialogue.append(dialogue)
                continue
        
        # Try standalone character name
        char_match = char_pattern.match(stripped)
        if char_match and len(stripped) < 40:
            potential_char = char_match.group(1).strip()
            if potential_char.isupper():
                upper_char = potential_char.upper()
                if not any(sw in upper_char for sw in skip_words):
                    if current_character and current_dialogue:
                        dialogue_text = ' '.join(current_dialogue).strip()
                        if dialogue_text:
                            line_number += 1
                            lines_data.append({
                                "id": str(uuid.uuid4()),
                                "character": current_character,
                                "text": dialogue_text,
                                "line_number": line_number,
                                "is_user_line": False,
                                "emotion": None,
                                "audio_url": None
                            })
                        current_dialogue = []
                    
                    current_character = potential_char.title()
                    characters.add(current_character)
                    continue
        
        # Accumulate dialogue
        if current_character:
            if stripped.startswith('(') and stripped.endswith(')'):
                continue
            if stripped.isdigit():
                continue
            current_dialogue.append(stripped)
    
    # Save remaining
    if current_character and current_dialogue:
        dialogue_text = ' '.join(current_dialogue).strip()
        if dialogue_text:
            line_number += 1
            lines_data.append({
                "id": str(uuid.uuid4()),
                "character": current_character,
                "text": dialogue_text,
                "line_number": line_number,
                "is_user_line": False,
                "emotion": None,
                "audio_url": None
            })
    
    scene = Scene(
        id=str(uuid.uuid4()),
        name="Main Scene",
        lines=[Line(**l) for l in lines_data]
    )
    
    return [scene], list(characters)

async def analyze_script_with_ai(scenes: List[Scene], characters: List[str]) -> tuple[List[CharacterAnalysis], List[Scene]]:
    """Use GPT-5.2 to analyze characters and emotions in the script."""
    if not EMERGENT_LLM_KEY:
        logging.warning("No EMERGENT_LLM_KEY - skipping AI analysis")
        return [], scenes
    
    # Prepare script text for analysis
    script_text = ""
    for scene in scenes:
        for line in scene.lines:
            script_text += f"{line.character}: {line.text}\n"
    
    # Analyze characters
    chat = LlmChat(
        api_key=EMERGENT_LLM_KEY,
        session_id=f"char-analysis-{uuid.uuid4()}",
        system_message="""You are a script analyst specializing in character and emotion analysis for actors. 
        Analyze scripts to identify character traits and emotional context of dialogue."""
    )
    chat.with_model("openai", "gpt-5.2")
    
    character_prompt = f"""Analyze these characters from the script and provide details for casting/voice selection.

Characters: {', '.join(characters)}

Script excerpt:
{script_text[:3000]}

For each character, determine:
1. Gender (male/female/unknown)
2. Age group (child/teen/adult/elderly)  
3. Voice type description (e.g., "deep authoritative male", "young energetic female", "raspy elderly")

Return ONLY valid JSON array:
[{{"name": "Character Name", "gender": "male", "age_group": "adult", "voice_type": "description"}}]"""

    try:
        char_response = await chat.send_message(UserMessage(text=character_prompt))
        
        # Parse character analysis
        json_match = re.search(r'\[[\s\S]*\]', char_response)
        if json_match:
            char_data = json.loads(json_match.group())
            character_analysis = [CharacterAnalysis(**c) for c in char_data]
        else:
            character_analysis = []
    except Exception as e:
        logging.error(f"Character analysis failed: {e}")
        character_analysis = []
    
    # Analyze emotions for each line
    emotion_chat = LlmChat(
        api_key=EMERGENT_LLM_KEY,
        session_id=f"emotion-analysis-{uuid.uuid4()}",
        system_message="""You are an acting coach analyzing script dialogue for emotional delivery.
        Identify the emotion, intensity, and any direction for how lines should be performed."""
    )
    emotion_chat.with_model("openai", "gpt-5.2")
    
    # Process lines in batches
    updated_scenes = []
    for scene in scenes:
        updated_lines = []
        
        # Batch lines for efficiency (max 20 at a time)
        batch_size = 20
        for i in range(0, len(scene.lines), batch_size):
            batch = scene.lines[i:i+batch_size]
            
            lines_text = "\n".join([f"{idx+1}. {l.character}: \"{l.text}\"" for idx, l in enumerate(batch)])
            
            emotion_prompt = f"""Analyze the emotional delivery for these dialogue lines:

{lines_text}

For each line, determine:
- emotion: one of [happy, sad, angry, fearful, surprised, disgusted, neutral, screaming, whispering, sarcastic, loving, desperate]
- intensity: low, medium, or high
- direction: brief acting note (optional)

Return ONLY valid JSON array with line numbers:
[{{"line": 1, "emotion": "angry", "intensity": "high", "direction": "building rage"}}]"""

            try:
                emotion_response = await emotion_chat.send_message(UserMessage(text=emotion_prompt))
                
                json_match = re.search(r'\[[\s\S]*\]', emotion_response)
                if json_match:
                    emotion_data = json.loads(json_match.group())
                    emotion_map = {e['line']: e for e in emotion_data}
                    
                    for idx, line in enumerate(batch):
                        if idx + 1 in emotion_map:
                            em = emotion_map[idx + 1]
                            line.emotion = LineEmotion(
                                emotion=em.get('emotion', 'neutral'),
                                intensity=em.get('intensity', 'medium'),
                                direction=em.get('direction')
                            )
                        updated_lines.append(line)
                else:
                    updated_lines.extend(batch)
            except Exception as e:
                logging.error(f"Emotion analysis failed for batch: {e}")
                updated_lines.extend(batch)
        
        updated_scenes.append(Scene(
            id=scene.id,
            name=scene.name,
            lines=updated_lines
        ))
    
    return character_analysis, updated_scenes

# ElevenLabs voice mapping based on character analysis
VOICE_MAPPING = {
    ("male", "adult"): "pNInz6obpgDQGcFmaJgB",  # Adam - deep male
    ("male", "child"): "jBpfuIE2acCO8z3wKNLl",  # Gigi - young
    ("male", "teen"): "EXAVITQu4vr4xnSDxMaL",  # Bella - versatile
    ("male", "elderly"): "VR6AewLTigWG4xSOukaG",  # Arnold - mature
    ("female", "adult"): "21m00Tcm4TlvDq8ikWAM",  # Rachel - female
    ("female", "child"): "jBpfuIE2acCO8z3wKNLl",  # Gigi - young
    ("female", "teen"): "EXAVITQu4vr4xnSDxMaL",  # Bella - young female
    ("female", "elderly"): "ThT5KcBeYPX3keUQqHPh",  # Dorothy - mature female
}

def get_voice_settings_for_emotion(emotion: Optional[LineEmotion]) -> VoiceSettings:
    """Get ElevenLabs voice settings based on emotion."""
    if not emotion:
        return VoiceSettings(stability=0.5, similarity_boost=0.75, style=0.5, use_speaker_boost=True)
    
    # Base settings for each emotion (stability, similarity_boost, style, use_speaker_boost)
    emotion_presets = {
        "happy": (0.4, 0.8, 0.7, True),
        "sad": (0.7, 0.6, 0.3, False),
        "angry": (0.3, 0.9, 0.9, True),
        "fearful": (0.3, 0.7, 0.6, True),
        "screaming": (0.2, 1.0, 1.0, True),
        "whispering": (0.8, 0.5, 0.2, False),
        "sarcastic": (0.5, 0.8, 0.8, True),
        "loving": (0.6, 0.7, 0.5, False),
        "desperate": (0.3, 0.85, 0.85, True),
        "surprised": (0.4, 0.8, 0.7, True),
        "disgusted": (0.5, 0.7, 0.6, True),
        "neutral": (0.5, 0.75, 0.5, True),
    }
    
    # Get base preset or default
    preset = emotion_presets.get(emotion.emotion, (0.5, 0.75, 0.5, True))
    stability, similarity_boost, style, use_speaker_boost = preset
    
    # Adjust for intensity (create new values, don't modify frozen object)
    if emotion.intensity == "high":
        style = min(1.0, style + 0.2)
        stability = max(0.1, stability - 0.1)
    elif emotion.intensity == "low":
        style = max(0.0, style - 0.2)
        stability = min(1.0, stability + 0.1)
    
    return VoiceSettings(
        stability=stability,
        similarity_boost=similarity_boost,
        style=style,
        use_speaker_boost=use_speaker_boost
    )

def get_voice_for_character(char_analysis: Optional[CharacterAnalysis]) -> str:
    """Get appropriate ElevenLabs voice ID for a character."""
    if not char_analysis:
        return "21m00Tcm4TlvDq8ikWAM"  # Default Rachel voice
    
    key = (char_analysis.gender.lower(), char_analysis.age_group.lower())
    return VOICE_MAPPING.get(key, "21m00Tcm4TlvDq8ikWAM")

# ============== AUTH ROUTES ==============

@api_router.post("/auth/register", response_model=TokenResponse)
async def register(user_data: UserCreate):
    existing = await db.users.find_one({"email": user_data.email})
    if existing:
        raise HTTPException(status_code=400, detail="Email already registered")
    
    user_id = str(uuid.uuid4())
    now = datetime.now(timezone.utc).isoformat()
    
    user_doc = {
        "id": user_id,
        "email": user_data.email,
        "name": user_data.name,
        "password": hash_password(user_data.password),
        "created_at": now
    }
    
    await db.users.insert_one(user_doc)
    
    token = create_token(user_id)
    user_response = UserResponse(
        id=user_id,
        email=user_data.email,
        name=user_data.name,
        created_at=now
    )
    
    return TokenResponse(access_token=token, user=user_response)

@api_router.post("/auth/login", response_model=TokenResponse)
async def login(credentials: UserLogin):
    user = await db.users.find_one({"email": credentials.email})
    if not user or not verify_password(credentials.password, user["password"]):
        raise HTTPException(status_code=401, detail="Invalid email or password")
    
    token = create_token(user["id"])
    user_response = UserResponse(
        id=user["id"],
        email=user["email"],
        name=user["name"],
        created_at=user["created_at"]
    )
    
    return TokenResponse(access_token=token, user=user_response)

@api_router.get("/auth/me", response_model=UserResponse)
async def get_me(current_user: dict = Depends(get_current_user)):
    return UserResponse(
        id=current_user["id"],
        email=current_user["email"],
        name=current_user["name"],
        created_at=current_user["created_at"]
    )

# ============== PROJECT ROUTES ==============

@api_router.get("/projects", response_model=List[ProjectResponse])
async def get_projects(current_user: dict = Depends(get_current_user)):
    projects = await db.projects.find(
        {"user_id": current_user["id"]},
        {"_id": 0}
    ).sort("created_at", -1).to_list(100)
    
    return [ProjectResponse(**p) for p in projects]

@api_router.post("/projects", response_model=ProjectResponse)
async def create_project(project_data: ProjectCreate, current_user: dict = Depends(get_current_user)):
    project_id = str(uuid.uuid4())
    now = datetime.now(timezone.utc).isoformat()
    
    project_doc = {
        "id": project_id,
        "user_id": current_user["id"],
        "title": project_data.title,
        "description": project_data.description or "",
        "scenes": [],
        "characters": [],
        "character_analysis": [],
        "user_character": None,
        "ai_analyzed": False,
        "created_at": now,
        "updated_at": now
    }
    
    await db.projects.insert_one(project_doc)
    return ProjectResponse(**project_doc)

@api_router.get("/projects/{project_id}", response_model=ProjectResponse)
async def get_project(project_id: str, current_user: dict = Depends(get_current_user)):
    project = await db.projects.find_one(
        {"id": project_id, "user_id": current_user["id"]},
        {"_id": 0}
    )
    if not project:
        raise HTTPException(status_code=404, detail="Project not found")
    
    return ProjectResponse(**project)

@api_router.put("/projects/{project_id}", response_model=ProjectResponse)
async def update_project(
    project_id: str,
    project_data: ProjectUpdate,
    current_user: dict = Depends(get_current_user)
):
    project = await db.projects.find_one({"id": project_id, "user_id": current_user["id"]})
    if not project:
        raise HTTPException(status_code=404, detail="Project not found")
    
    update_data = {"updated_at": datetime.now(timezone.utc).isoformat()}
    if project_data.title is not None:
        update_data["title"] = project_data.title
    if project_data.description is not None:
        update_data["description"] = project_data.description
    
    await db.projects.update_one({"id": project_id}, {"$set": update_data})
    
    updated = await db.projects.find_one({"id": project_id}, {"_id": 0})
    return ProjectResponse(**updated)

@api_router.delete("/projects/{project_id}")
async def delete_project(project_id: str, current_user: dict = Depends(get_current_user)):
    result = await db.projects.delete_one({"id": project_id, "user_id": current_user["id"]})
    if result.deleted_count == 0:
        raise HTTPException(status_code=404, detail="Project not found")
    
    return {"message": "Project deleted"}

# ============== PDF UPLOAD WITH AI ANALYSIS ==============

@api_router.post("/projects/{project_id}/upload-pdf", response_model=ProjectResponse)
async def upload_pdf(
    project_id: str,
    file: UploadFile = File(...),
    current_user: dict = Depends(get_current_user)
):
    project = await db.projects.find_one({"id": project_id, "user_id": current_user["id"]})
    if not project:
        raise HTTPException(status_code=404, detail="Project not found")
    
    if not file.filename.lower().endswith('.pdf'):
        raise HTTPException(status_code=400, detail="Only PDF files are allowed")
    
    content = await file.read()
    
    try:
        scenes, characters = parse_script_pdf(content)
    except Exception as e:
        logging.error(f"PDF parsing error: {e}")
        raise HTTPException(status_code=400, detail=f"Failed to parse PDF: {str(e)}")
    
    # Run AI analysis
    try:
        character_analysis, analyzed_scenes = await analyze_script_with_ai(scenes, characters)
        ai_analyzed = True
    except Exception as e:
        logging.error(f"AI analysis error: {e}")
        character_analysis = []
        analyzed_scenes = scenes
        ai_analyzed = False
    
    # Convert to dict for MongoDB
    scenes_data = [s.model_dump() for s in analyzed_scenes]
    char_analysis_data = [c.model_dump() for c in character_analysis]
    
    update_data = {
        "scenes": scenes_data,
        "characters": characters,
        "character_analysis": char_analysis_data,
        "ai_analyzed": ai_analyzed,
        "updated_at": datetime.now(timezone.utc).isoformat()
    }
    
    await db.projects.update_one({"id": project_id}, {"$set": update_data})
    
    updated = await db.projects.find_one({"id": project_id}, {"_id": 0})
    return ProjectResponse(**updated)

@api_router.post("/projects/{project_id}/paste-script", response_model=ProjectResponse)
async def paste_script(
    project_id: str,
    request: PasteScriptRequest,
    current_user: dict = Depends(get_current_user)
):
    """Parse pasted script text instead of PDF upload."""
    project = await db.projects.find_one({"id": project_id, "user_id": current_user["id"]})
    if not project:
        raise HTTPException(status_code=404, detail="Project not found")
    
    if not request.script_text.strip():
        raise HTTPException(status_code=400, detail="Script text cannot be empty")
    
    try:
        scenes, characters = parse_script_text(request.script_text)
    except Exception as e:
        logging.error(f"Script parsing error: {e}")
        raise HTTPException(status_code=400, detail=f"Failed to parse script: {str(e)}")
    
    if not characters:
        raise HTTPException(
            status_code=400, 
            detail="Could not detect any characters. Use format like 'CHARACTER: dialogue' or 'CHARACTER' on its own line followed by dialogue."
        )
    
    # Run AI analysis
    try:
        character_analysis, analyzed_scenes = await analyze_script_with_ai(scenes, characters)
        ai_analyzed = True
    except Exception as e:
        logging.error(f"AI analysis error: {e}")
        character_analysis = []
        analyzed_scenes = scenes
        ai_analyzed = False
    
    scenes_data = [s.model_dump() for s in analyzed_scenes]
    char_analysis_data = [c.model_dump() for c in character_analysis]
    
    update_data = {
        "scenes": scenes_data,
        "characters": characters,
        "character_analysis": char_analysis_data,
        "ai_analyzed": ai_analyzed,
        "updated_at": datetime.now(timezone.utc).isoformat()
    }
    
    await db.projects.update_one({"id": project_id}, {"$set": update_data})
    
    updated = await db.projects.find_one({"id": project_id}, {"_id": 0})
    return ProjectResponse(**updated)

# ============== USER CHARACTER ==============

@api_router.post("/projects/{project_id}/set-character", response_model=ProjectResponse)
async def set_user_character(
    project_id: str,
    request: SetUserCharacterRequest,
    current_user: dict = Depends(get_current_user)
):
    project = await db.projects.find_one({"id": project_id, "user_id": current_user["id"]})
    if not project:
        raise HTTPException(status_code=404, detail="Project not found")
    
    if request.character not in project.get("characters", []):
        raise HTTPException(status_code=400, detail="Character not found in project")
    
    scenes = project.get("scenes", [])
    for scene in scenes:
        for line in scene.get("lines", []):
            line["is_user_line"] = line["character"] == request.character
    
    await db.projects.update_one(
        {"id": project_id},
        {
            "$set": {
                "user_character": request.character,
                "scenes": scenes,
                "updated_at": datetime.now(timezone.utc).isoformat()
            }
        }
    )
    
    updated = await db.projects.find_one({"id": project_id}, {"_id": 0})
    return ProjectResponse(**updated)

# ============== READER DATA ==============

@api_router.get("/projects/{project_id}/reader-data", response_model=ReaderData)
async def get_reader_data(project_id: str, current_user: dict = Depends(get_current_user)):
    project = await db.projects.find_one(
        {"id": project_id, "user_id": current_user["id"]},
        {"_id": 0}
    )
    if not project:
        raise HTTPException(status_code=404, detail="Project not found")
    
    return ReaderData(
        project_id=project["id"],
        project_title=project["title"],
        user_character=project.get("user_character"),
        scenes=[Scene(**s) for s in project.get("scenes", [])],
        characters=project.get("characters", []),
        character_analysis=[CharacterAnalysis(**c) for c in project.get("character_analysis", [])]
    )

# ============== TTS GENERATION ==============

@api_router.post("/projects/{project_id}/generate-audio/{line_id}", response_model=TTSResponse)
async def generate_line_audio(
    project_id: str,
    line_id: str,
    current_user: dict = Depends(get_current_user)
):
    """Generate TTS audio for a specific line with emotional delivery."""
    if not eleven_client:
        raise HTTPException(status_code=503, detail="ElevenLabs not configured. Please add ELEVENLABS_API_KEY.")
    
    project = await db.projects.find_one({"id": project_id, "user_id": current_user["id"]})
    if not project:
        raise HTTPException(status_code=404, detail="Project not found")
    
    # Find the line
    target_line = None
    for scene in project.get("scenes", []):
        for line in scene.get("lines", []):
            if line["id"] == line_id:
                target_line = line
                break
        if target_line:
            break
    
    if not target_line:
        raise HTTPException(status_code=404, detail="Line not found")
    
    # Get character analysis for voice selection
    char_analysis = None
    for ca in project.get("character_analysis", []):
        if ca["name"] == target_line["character"]:
            char_analysis = CharacterAnalysis(**ca)
            break
    
    # Get voice and settings
    voice_id = get_voice_for_character(char_analysis)
    emotion = LineEmotion(**target_line["emotion"]) if target_line.get("emotion") else None
    voice_settings = get_voice_settings_for_emotion(emotion)
    
    try:
        # Generate audio
        audio_generator = eleven_client.text_to_speech.convert(
            text=target_line["text"],
            voice_id=voice_id,
            model_id="eleven_multilingual_v2",
            voice_settings=voice_settings
        )
        
        # Collect audio data
        audio_data = b""
        for chunk in audio_generator:
            audio_data += chunk
        
        # Convert to base64
        audio_b64 = base64.b64encode(audio_data).decode()
        audio_url = f"data:audio/mpeg;base64,{audio_b64}"
        
        # Update line with audio URL
        for scene in project.get("scenes", []):
            for line in scene.get("lines", []):
                if line["id"] == line_id:
                    line["audio_url"] = audio_url
                    break
        
        await db.projects.update_one(
            {"id": project_id},
            {"$set": {"scenes": project["scenes"], "updated_at": datetime.now(timezone.utc).isoformat()}}
        )
        
        return TTSResponse(audio_url=audio_url, line_id=line_id)
        
    except Exception as e:
        logging.error(f"TTS generation error: {e}")
        raise HTTPException(status_code=500, detail=f"Failed to generate audio: {str(e)}")

@api_router.post("/projects/{project_id}/generate-all-audio")
async def generate_all_cue_audio(
    project_id: str,
    current_user: dict = Depends(get_current_user)
):
    """Generate TTS audio for all non-user lines (cue lines)."""
    if not eleven_client:
        raise HTTPException(status_code=503, detail="ElevenLabs not configured")
    
    project = await db.projects.find_one({"id": project_id, "user_id": current_user["id"]})
    if not project:
        raise HTTPException(status_code=404, detail="Project not found")
    
    generated_count = 0
    errors = []
    
    for scene in project.get("scenes", []):
        for line in scene.get("lines", []):
            # Only generate for cue lines (not user lines)
            if line.get("is_user_line"):
                continue
            
            # Skip if already has audio
            if line.get("audio_url"):
                continue
            
            # Get character analysis
            char_analysis = None
            for ca in project.get("character_analysis", []):
                if ca["name"] == line["character"]:
                    char_analysis = CharacterAnalysis(**ca)
                    break
            
            voice_id = get_voice_for_character(char_analysis)
            emotion = LineEmotion(**line["emotion"]) if line.get("emotion") else None
            voice_settings = get_voice_settings_for_emotion(emotion)
            
            try:
                audio_generator = eleven_client.text_to_speech.convert(
                    text=line["text"],
                    voice_id=voice_id,
                    model_id="eleven_multilingual_v2",
                    voice_settings=voice_settings
                )
                
                audio_data = b""
                for chunk in audio_generator:
                    audio_data += chunk
                
                audio_b64 = base64.b64encode(audio_data).decode()
                line["audio_url"] = f"data:audio/mpeg;base64,{audio_b64}"
                generated_count += 1
                
            except Exception as e:
                errors.append(f"Line {line['id']}: {str(e)}")
    
    # Save updated project
    await db.projects.update_one(
        {"id": project_id},
        {"$set": {"scenes": project["scenes"], "updated_at": datetime.now(timezone.utc).isoformat()}}
    )
    
    return {
        "message": f"Generated audio for {generated_count} lines",
        "generated_count": generated_count,
        "errors": errors if errors else None
    }

# ============== TAKES MANAGEMENT ==============

@api_router.get("/projects/{project_id}/takes", response_model=List[TakeResponse])
async def get_takes(project_id: str, current_user: dict = Depends(get_current_user)):
    """Get all takes for a project."""
    project = await db.projects.find_one({"id": project_id, "user_id": current_user["id"]})
    if not project:
        raise HTTPException(status_code=404, detail="Project not found")
    
    takes = await db.takes.find(
        {"project_id": project_id, "user_id": current_user["id"]},
        {"_id": 0}
    ).sort("created_at", -1).to_list(100)
    
    return [TakeResponse(**t) for t in takes]

@api_router.post("/projects/{project_id}/takes", response_model=TakeResponse)
async def create_take(
    project_id: str,
    take_data: TakeCreate,
    current_user: dict = Depends(get_current_user)
):
    """Save a new take recording."""
    project = await db.projects.find_one({"id": project_id, "user_id": current_user["id"]})
    if not project:
        raise HTTPException(status_code=404, detail="Project not found")
    
    # Get take count for numbering
    take_count = await db.takes.count_documents({"project_id": project_id, "user_id": current_user["id"]})
    
    take_id = str(uuid.uuid4())
    now = datetime.now(timezone.utc).isoformat()
    
    # Store video as data URL
    video_url = take_data.video_data if take_data.video_data.startswith('data:') else f"data:video/webm;base64,{take_data.video_data}"
    
    take_doc = {
        "id": take_id,
        "project_id": project_id,
        "user_id": current_user["id"],
        "take_number": take_count + 1,
        "duration": take_data.duration,
        "notes": take_data.notes or "",
        "is_favorite": False,
        "video_url": video_url,
        "thumbnail_url": None,
        "created_at": now
    }
    
    await db.takes.insert_one(take_doc)
    return TakeResponse(**take_doc)

@api_router.get("/projects/{project_id}/takes/{take_id}", response_model=TakeResponse)
async def get_take(
    project_id: str,
    take_id: str,
    current_user: dict = Depends(get_current_user)
):
    """Get a specific take."""
    take = await db.takes.find_one(
        {"id": take_id, "project_id": project_id, "user_id": current_user["id"]},
        {"_id": 0}
    )
    if not take:
        raise HTTPException(status_code=404, detail="Take not found")
    
    return TakeResponse(**take)

@api_router.put("/projects/{project_id}/takes/{take_id}", response_model=TakeResponse)
async def update_take(
    project_id: str,
    take_id: str,
    take_data: TakeUpdate,
    current_user: dict = Depends(get_current_user)
):
    """Update take notes or favorite status."""
    take = await db.takes.find_one({"id": take_id, "project_id": project_id, "user_id": current_user["id"]})
    if not take:
        raise HTTPException(status_code=404, detail="Take not found")
    
    update_data = {}
    if take_data.notes is not None:
        update_data["notes"] = take_data.notes
    if take_data.is_favorite is not None:
        update_data["is_favorite"] = take_data.is_favorite
    
    if update_data:
        await db.takes.update_one({"id": take_id}, {"$set": update_data})
    
    updated = await db.takes.find_one({"id": take_id}, {"_id": 0})
    return TakeResponse(**updated)

@api_router.delete("/projects/{project_id}/takes/{take_id}")
async def delete_take(
    project_id: str,
    take_id: str,
    current_user: dict = Depends(get_current_user)
):
    """Delete a take."""
    result = await db.takes.delete_one(
        {"id": take_id, "project_id": project_id, "user_id": current_user["id"]}
    )
    if result.deleted_count == 0:
        raise HTTPException(status_code=404, detail="Take not found")
    
    return {"message": "Take deleted"}

@api_router.post("/projects/{project_id}/takes/{take_id}/convert")
async def convert_take_to_mp4(
    project_id: str,
    take_id: str,
    current_user: dict = Depends(get_current_user)
):
    """Convert a WebM take to MP4 format."""
    take = await db.takes.find_one(
        {"id": take_id, "project_id": project_id, "user_id": current_user["id"]},
        {"_id": 0}
    )
    if not take:
        raise HTTPException(status_code=404, detail="Take not found")
    
    # Extract base64 video data
    video_url = take["video_url"]
    if not video_url.startswith("data:"):
        raise HTTPException(status_code=400, detail="Invalid video format")
    
    try:
        # Parse data URL
        header, encoded = video_url.split(",", 1)
        video_bytes = base64.b64decode(encoded)
        
        # For now, just return the original - MP4 conversion would require FFmpeg
        # In production, you'd use moviepy or ffmpeg here
        # This is a placeholder that returns the original WebM
        
        return {
            "message": "Video ready for download",
            "format": "webm",
            "video_url": video_url,
            "note": "MP4 conversion available in production with FFmpeg"
        }
        
    except Exception as e:
        logging.error(f"Video conversion error: {e}")
        raise HTTPException(status_code=500, detail="Failed to process video")

# ============== MEMBERSHIP ==============

MEMBERSHIP_TIERS = {
    "free": MembershipTier(
        tier="free",
        cloud_storage_mb=0,
        features=["download_to_device", "5_takes_per_project", "basic_ai_analysis"]
    ),
    "pro": MembershipTier(
        tier="pro",
        cloud_storage_mb=5000,  # 5GB
        features=["unlimited_cloud_storage", "unlimited_takes", "advanced_ai_analysis", "direct_submission", "share_links", "priority_support"]
    )
}

@api_router.get("/membership/tiers")
async def get_membership_tiers():
    """Get available membership tiers."""
    return {"tiers": MEMBERSHIP_TIERS}

@api_router.get("/membership/status")
async def get_membership_status(current_user: dict = Depends(get_current_user)):
    """Get current user's membership status."""
    user = await db.users.find_one({"id": current_user["id"]}, {"_id": 0})
    
    membership = user.get("membership", {
        "tier": "free",
        "cloud_storage_used_mb": 0,
        "cloud_storage_limit_mb": 0,
        "expires_at": None
    })
    
    tier_info = MEMBERSHIP_TIERS.get(membership.get("tier", "free"))
    
    return {
        "membership": membership,
        "tier_info": tier_info,
        "cloud_configured": CLOUDINARY_CONFIGURED
    }

@api_router.post("/membership/upgrade")
async def upgrade_membership(
    tier: str = "pro",
    current_user: dict = Depends(get_current_user)
):
    """Upgrade to Pro membership (placeholder - integrate with Stripe for payments)."""
    if tier not in MEMBERSHIP_TIERS:
        raise HTTPException(status_code=400, detail="Invalid membership tier")
    
    # In production, this would verify payment via Stripe
    # For now, just upgrade the user
    tier_info = MEMBERSHIP_TIERS[tier]
    
    membership = {
        "tier": tier,
        "cloud_storage_used_mb": 0,
        "cloud_storage_limit_mb": tier_info.cloud_storage_mb,
        "expires_at": (datetime.now(timezone.utc) + timedelta(days=30)).isoformat()
    }
    
    await db.users.update_one(
        {"id": current_user["id"]},
        {"$set": {"membership": membership}}
    )
    
    return {"message": f"Upgraded to {tier} membership", "membership": membership}

# ============== CLOUD STORAGE (PRO FEATURE) ==============

@api_router.get("/cloudinary/signature", response_model=CloudUploadSignature)
async def get_cloudinary_signature(
    resource_type: str = Query("video", enum=["image", "video"]),
    current_user: dict = Depends(get_current_user)
):
    """Get signed upload params for Cloudinary (Pro members only)."""
    if not CLOUDINARY_CONFIGURED:
        raise HTTPException(status_code=503, detail="Cloud storage not configured")
    
    # Check membership
    user = await db.users.find_one({"id": current_user["id"]}, {"_id": 0})
    membership = user.get("membership", {"tier": "free"})
    
    if membership.get("tier") != "pro":
        raise HTTPException(status_code=403, detail="Cloud storage requires Pro membership")
    
    folder = f"users/{current_user['id']}/takes"
    timestamp = int(time.time())
    
    params = {
        "timestamp": timestamp,
        "folder": folder,
        "resource_type": resource_type
    }
    
    signature = cloudinary.utils.api_sign_request(
        params,
        os.environ.get("CLOUDINARY_API_SECRET")
    )
    
    return CloudUploadSignature(
        signature=signature,
        timestamp=timestamp,
        cloud_name=os.environ.get("CLOUDINARY_CLOUD_NAME"),
        api_key=os.environ.get("CLOUDINARY_API_KEY"),
        folder=folder,
        resource_type=resource_type
    )

@api_router.post("/projects/{project_id}/takes/{take_id}/upload-cloud")
async def upload_take_to_cloud(
    project_id: str,
    take_id: str,
    cloud_url: str,
    cloud_public_id: str,
    current_user: dict = Depends(get_current_user)
):
    """Update take with cloud storage URL after upload."""
    take = await db.takes.find_one(
        {"id": take_id, "project_id": project_id, "user_id": current_user["id"]}
    )
    if not take:
        raise HTTPException(status_code=404, detail="Take not found")
    
    await db.takes.update_one(
        {"id": take_id},
        {"$set": {
            "cloud_url": cloud_url,
            "cloud_public_id": cloud_public_id,
            "storage_type": "cloud"
        }}
    )
    
    return {"message": "Take uploaded to cloud", "cloud_url": cloud_url}

# ============== SHARE/SUBMISSION ==============

@api_router.post("/projects/{project_id}/takes/{take_id}/share", response_model=ShareResponse)
async def create_share_link(
    project_id: str,
    take_id: str,
    share_data: ShareCreate,
    current_user: dict = Depends(get_current_user)
):
    """Create a shareable link for a take."""
    take = await db.takes.find_one(
        {"id": take_id, "project_id": project_id, "user_id": current_user["id"]}
    )
    if not take:
        raise HTTPException(status_code=404, detail="Take not found")
    
    project = await db.projects.find_one({"id": project_id}, {"_id": 0})
    
    share_id = str(uuid.uuid4())
    share_token = str(uuid.uuid4()).replace("-", "")[:16]
    now = datetime.now(timezone.utc)
    expires_at = now + timedelta(hours=share_data.expires_hours)
    
    # Get base URL for share link - use APP_URL for production deployment
    base_url = os.environ.get("FRONTEND_URL") or os.environ.get("APP_URL", "")
    
    share_doc = {
        "id": share_id,
        "take_id": take_id,
        "project_id": project_id,
        "user_id": current_user["id"],
        "share_token": share_token,
        "share_url": f"{base_url}/shared/{share_token}",
        "recipient_email": share_data.recipient_email,
        "recipient_name": share_data.recipient_name,
        "message": share_data.message,
        "project_title": project.get("title", "Audition Tape"),
        "views": 0,
        "expires_at": expires_at.isoformat(),
        "created_at": now.isoformat()
    }
    
    await db.shares.insert_one(share_doc)
    
    return ShareResponse(**share_doc)

@api_router.get("/shared/{share_token}")
async def get_shared_take(share_token: str):
    """Get a shared take by token (public endpoint)."""
    share = await db.shares.find_one({"share_token": share_token}, {"_id": 0})
    if not share:
        raise HTTPException(status_code=404, detail="Share link not found")
    
    # Check expiration
    expires_at = datetime.fromisoformat(share["expires_at"].replace("Z", "+00:00"))
    if datetime.now(timezone.utc) > expires_at:
        raise HTTPException(status_code=410, detail="Share link has expired")
    
    # Increment views
    await db.shares.update_one(
        {"share_token": share_token},
        {"$inc": {"views": 1}}
    )
    
    # Get the take
    take = await db.takes.find_one({"id": share["take_id"]}, {"_id": 0})
    if not take:
        raise HTTPException(status_code=404, detail="Take not found")
    
    return {
        "project_title": share.get("project_title", "Audition Tape"),
        "recipient_name": share.get("recipient_name"),
        "message": share.get("message"),
        "take": {
            "take_number": take["take_number"],
            "duration": take["duration"],
            "video_url": take.get("cloud_url") or take.get("video_url"),
            "notes": take.get("notes")
        },
        "views": share["views"] + 1,
        "expires_at": share["expires_at"]
    }

@api_router.get("/projects/{project_id}/takes/{take_id}/shares", response_model=List[ShareResponse])
async def get_take_shares(
    project_id: str,
    take_id: str,
    current_user: dict = Depends(get_current_user)
):
    """Get all share links for a take."""
    shares = await db.shares.find(
        {"take_id": take_id, "user_id": current_user["id"]},
        {"_id": 0}
    ).sort("created_at", -1).to_list(50)
    
    return [ShareResponse(**s) for s in shares]

@api_router.delete("/shares/{share_id}")
async def delete_share(share_id: str, current_user: dict = Depends(get_current_user)):
    """Delete a share link."""
    result = await db.shares.delete_one({"id": share_id, "user_id": current_user["id"]})
    if result.deleted_count == 0:
        raise HTTPException(status_code=404, detail="Share not found")
    
    return {"message": "Share link deleted"}

@api_router.post("/projects/{project_id}/takes/{take_id}/submit", response_model=DirectSubmissionResponse)
async def direct_submission(
    project_id: str,
    take_id: str,
    submission: DirectSubmissionRequest,
    current_user: dict = Depends(get_current_user)
):
    """Create a share link and send it via email to a casting director/agent."""
    take = await db.takes.find_one(
        {"id": take_id, "project_id": project_id, "user_id": current_user["id"]}
    )
    if not take:
        raise HTTPException(status_code=404, detail="Take not found")
    
    project = await db.projects.find_one({"id": project_id}, {"_id": 0})
    user = await db.users.find_one({"id": current_user["id"]}, {"_id": 0})
    
    # Create share link
    share_id = str(uuid.uuid4())
    share_token = str(uuid.uuid4()).replace("-", "")[:16]
    now = datetime.now(timezone.utc)
    expires_at = now + timedelta(hours=72)
    
    # Get base URL for share link - use APP_URL for production deployment
    base_url = os.environ.get("FRONTEND_URL") or os.environ.get("APP_URL", "")
    share_url = f"{base_url}/shared/{share_token}"
    
    share_doc = {
        "id": share_id,
        "take_id": take_id,
        "project_id": project_id,
        "user_id": current_user["id"],
        "share_token": share_token,
        "share_url": share_url,
        "recipient_email": submission.recipient_email,
        "recipient_name": submission.recipient_name,
        "message": submission.message,
        "project_title": project.get("title", "Audition Tape"),
        "views": 0,
        "expires_at": expires_at.isoformat(),
        "created_at": now.isoformat(),
        "email_sent": False
    }
    
    await db.shares.insert_one(share_doc)
    
    # Send email via Resend
    email_sent = False
    if RESEND_CONFIGURED:
        try:
            actor_name = user.get("name", "An Actor")
            project_title = project.get("title", "Self-Tape Audition")
            
            html_content = f"""
            <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
                <div style="background: linear-gradient(135deg, #9333ea 0%, #ec4899 100%); padding: 30px; border-radius: 12px 12px 0 0;">
                    <h1 style="color: white; margin: 0; font-size: 24px;">CuePartner</h1>
                    <p style="color: rgba(255,255,255,0.9); margin: 10px 0 0 0;">Self-Tape Submission</p>
                </div>
                
                <div style="background: #1a1a1a; padding: 30px; border-radius: 0 0 12px 12px; color: #ffffff;">
                    <p style="font-size: 18px; margin: 0 0 20px 0;">
                        Hi {submission.recipient_name},
                    </p>
                    
                    <p style="color: #a1a1aa; line-height: 1.6;">
                        <strong style="color: #ffffff;">{actor_name}</strong> has sent you a self-tape audition 
                        for <strong style="color: #c084fc;">"{project_title}"</strong>.
                    </p>
                    
                    {f'<div style="background: #262626; padding: 15px; border-radius: 8px; margin: 20px 0; border-left: 3px solid #9333ea;"><p style="color: #a1a1aa; margin: 0; font-style: italic;">"{submission.message}"</p></div>' if submission.message else ''}
                    
                    <div style="text-align: center; margin: 30px 0;">
                        <a href="{share_url}" style="background: linear-gradient(135deg, #9333ea 0%, #ec4899 100%); color: white; padding: 14px 32px; border-radius: 8px; text-decoration: none; font-weight: bold; display: inline-block;">
                            Watch Self-Tape
                        </a>
                    </div>
                    
                    <p style="color: #71717a; font-size: 12px; text-align: center; margin-top: 30px;">
                        This link will expire in 72 hours.
                    </p>
                </div>
                
                <p style="color: #52525b; font-size: 11px; text-align: center; margin-top: 20px;">
                    Sent via CuePartner - Voice-powered rehearsal for actors
                </p>
            </div>
            """
            
            params = {
                "from": SENDER_EMAIL,
                "to": [submission.recipient_email],
                "subject": f"Self-Tape Submission from {actor_name} - {project_title}",
                "html": html_content
            }
            
            # Run sync SDK in thread to keep FastAPI non-blocking
            await asyncio.to_thread(resend.Emails.send, params)
            email_sent = True
            
            # Update share doc with email sent status
            await db.shares.update_one(
                {"id": share_id},
                {"$set": {"email_sent": True}}
            )
            
            logging.info(f"Email sent successfully to {submission.recipient_email}")
            
        except Exception as e:
            logging.error(f"Failed to send email: {str(e)}")
            # Continue even if email fails - share link is still created
    
    return DirectSubmissionResponse(
        status="success",
        message=f"Self-tape submitted to {submission.recipient_name}" + (" via email" if email_sent else " (link created)"),
        share_url=share_url,
        email_sent=email_sent
    )

@api_router.get("/email/status")
async def get_email_status():
    """Check if email sending is configured."""
    return {
        "configured": RESEND_CONFIGURED,
        "sender_email": SENDER_EMAIL if RESEND_CONFIGURED else None
    }

# ============== HEALTH CHECK ==============

@api_router.get("/")
async def root():
    return {"message": "CuePartner API", "version": "2.0.0"}

@api_router.get("/health")
async def health_check():
    return {
        "status": "healthy",
        "timestamp": datetime.now(timezone.utc).isoformat(),
        "elevenlabs_configured": eleven_client is not None,
        "ai_configured": EMERGENT_LLM_KEY is not None,
        "cloud_configured": CLOUDINARY_CONFIGURED,
        "email_configured": RESEND_CONFIGURED
    }

# Include the router in the main app
app.include_router(api_router)

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)

@app.on_event("shutdown")
async def shutdown_db_client():
    client.close()
