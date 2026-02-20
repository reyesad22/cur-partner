from fastapi import FastAPI, APIRouter, HTTPException, Depends, UploadFile, File, status
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from dotenv import load_dotenv
from starlette.middleware.cors import CORSMiddleware
from motor.motor_asyncio import AsyncIOMotorClient
import os
import logging
import re
from pathlib import Path
from pydantic import BaseModel, Field, ConfigDict, EmailStr
from typing import List, Optional
import uuid
from datetime import datetime, timezone, timedelta
import jwt
import bcrypt
from PyPDF2 import PdfReader
import io

ROOT_DIR = Path(__file__).parent
load_dotenv(ROOT_DIR / '.env')

# MongoDB connection
mongo_url = os.environ['MONGO_URL']
client = AsyncIOMotorClient(mongo_url)
db = client[os.environ['DB_NAME']]

# JWT Configuration
JWT_SECRET = os.environ.get('JWT_SECRET', 'cuepartner-secret-key-change-in-production')
JWT_ALGORITHM = "HS256"
JWT_EXPIRATION_HOURS = 24

# Create the main app
app = FastAPI(title="CuePartner API", version="1.0.0")

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

class Line(BaseModel):
    model_config = ConfigDict(extra="ignore")
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    character: str
    text: str
    line_number: int
    is_user_line: bool = False

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
    user_character: Optional[str] = None
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
        full_text += page.extract_text() + "\n"
    
    # Parse the script
    lines_data = []
    characters = set()
    current_character = None
    line_number = 0
    
    # Common patterns for script formats
    # CHARACTER NAME (in caps, possibly with parenthetical)
    character_pattern = re.compile(r'^([A-Z][A-Z\s\-\'\.]+?)(?:\s*\([^)]*\))?\s*$')
    # Dialogue is typically indented or follows character name
    
    text_lines = full_text.split('\n')
    
    for i, line in enumerate(text_lines):
        stripped = line.strip()
        if not stripped:
            continue
        
        # Check if this is a character name
        char_match = character_pattern.match(stripped)
        if char_match and len(stripped) < 40 and stripped.isupper():
            potential_char = char_match.group(1).strip()
            # Exclude common non-character lines
            if potential_char not in ['INT', 'EXT', 'FADE', 'CUT', 'SCENE', 'ACT', 'END', 'CONTINUED', 'CONT', 'THE END']:
                current_character = potential_char.title()
                characters.add(current_character)
                continue
        
        # If we have a current character, this line is their dialogue
        if current_character and stripped:
            # Skip stage directions in parentheses only
            if stripped.startswith('(') and stripped.endswith(')'):
                continue
            
            line_number += 1
            lines_data.append({
                "id": str(uuid.uuid4()),
                "character": current_character,
                "text": stripped,
                "line_number": line_number,
                "is_user_line": False
            })
            current_character = None
    
    # Create a single scene with all lines
    scene = Scene(
        id=str(uuid.uuid4()),
        name="Main Scene",
        lines=[Line(**l) for l in lines_data]
    )
    
    return [scene], list(characters)

# ============== AUTH ROUTES ==============

@api_router.post("/auth/register", response_model=TokenResponse)
async def register(user_data: UserCreate):
    # Check if user exists
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
        "user_character": None,
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

# ============== PDF UPLOAD ==============

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
    
    # Convert scenes to dict for MongoDB
    scenes_data = [s.model_dump() for s in scenes]
    
    update_data = {
        "scenes": scenes_data,
        "characters": characters,
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
    
    # Update user_character and mark lines
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
        characters=project.get("characters", [])
    )

# ============== HEALTH CHECK ==============

@api_router.get("/")
async def root():
    return {"message": "CuePartner API", "version": "1.0.0"}

@api_router.get("/health")
async def health_check():
    return {"status": "healthy", "timestamp": datetime.now(timezone.utc).isoformat()}

# Include the router in the main app
app.include_router(api_router)

app.add_middleware(
    CORSMiddleware,
    allow_credentials=True,
    allow_origins=os.environ.get('CORS_ORIGINS', '*').split(','),
    allow_methods=["*"],
    allow_headers=["*"],
)

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)

@app.on_event("shutdown")
async def shutdown_db_client():
    client.close()
