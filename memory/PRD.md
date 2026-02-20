# CuePartner - Voice-Powered Cue Reader & Teleprompter

## Original Problem Statement
Build a website for CuePartner - a voice-powered cue reader and teleprompter for actors with:
- Landing page matching getcuepartner.com design
- User authentication (login/signup)
- Dashboard for managing projects
- PDF script upload and parsing
- Voice-tracked teleprompter/reader
- Responsive design for desktop and mobile

## Tech Stack
- **Frontend**: React 19 with Tailwind CSS, Radix UI components
- **Backend**: FastAPI with Python
- **Database**: MongoDB (adapted from original PostgreSQL requirement)
- **Voice**: Web Speech API for voice tracking

## User Personas
1. **Actors**: Upload scripts, select characters, rehearse with voice-tracked teleprompter
2. **Voice Actors**: Listed in marketplace (static demo data)

## Core Requirements
- [x] Dark theme landing page with purple/pink gradient accents
- [x] JWT-based authentication
- [x] Project CRUD operations
- [x] PDF script upload and parsing
- [x] Character detection and selection
- [x] Voice-tracked reader with fuzzy matching
- [x] Responsive design (mobile/tablet/desktop)

## What's Been Implemented (Feb 20, 2026)
1. **Landing Page**: Hero section, features grid, 4-step process, voice library showcase, CTA
2. **Authentication**: Login/Signup with JWT tokens
3. **Dashboard**: Project list with create/delete functionality
4. **Project Detail**: PDF upload, character selection, script preview
5. **Reader**: Voice-tracked teleprompter with Web Speech API, fuzzy matching, settings panel

## API Endpoints
- POST /api/auth/register - User registration
- POST /api/auth/login - User login
- GET /api/auth/me - Current user info
- GET /api/projects - List user projects
- POST /api/projects - Create project
- GET /api/projects/{id} - Get project details
- PUT /api/projects/{id} - Update project
- DELETE /api/projects/{id} - Delete project
- POST /api/projects/{id}/upload-pdf - Upload and parse script
- POST /api/projects/{id}/set-character - Set user character
- GET /api/projects/{id}/reader-data - Get teleprompter data

## Demo Credentials
- actor@demo.com / actor123

## Prioritized Backlog
### P0 (Done)
- ✅ Core authentication
- ✅ Project management
- ✅ PDF parsing
- ✅ Voice reader

### P1 (Future)
- Text-to-speech for cue lines (using TTS API)
- Multiple scenes support in reader
- Recording functionality
- Export recordings

### P2 (Backlog)
- Voice marketplace integration
- Payment processing for voice actors
- Casting call browsing
- Social sharing

## Next Tasks
1. Add TTS for partner lines (OpenAI TTS or Web Speech Synthesis)
2. Implement recording feature with camera/audio
3. Add voice actor marketplace with actual audio samples

## Update (Feb 20, 2026 - Session 2)
### Mobile App-Like Navigation Added
- Added bottom navigation bar for mobile (visible only on authenticated pages)
- Bottom nav hidden on Reader page (Reader has its own control bar)
- App-like sticky headers with blur effect
- Safe area support for iOS devices
- Smooth scrolling optimized for mobile
- Responsive typography and spacing

### Components Updated
- MobileNav.jsx - New bottom navigation component
- Dashboard.jsx - App-like header, mobile-optimized layout
- ProjectDetail.jsx - Compact mobile header
- Reader.jsx - Full-screen experience with own controls
- index.css - Mobile app styles (safe areas, smooth scroll)

## Update (Feb 20, 2026 - Session 3)
### AI-Powered Script Analysis & Emotional TTS Added

**New Features:**
1. **GPT-5.2 Script Analysis** (via Emergent LLM key)
   - Detects character gender (male/female)
   - Detects character age group (child/teen/adult/elderly)
   - Analyzes emotion for every line (happy, sad, angry, screaming, whispering, etc.)
   - Determines intensity (low/medium/high)

2. **ElevenLabs Emotional TTS**
   - Generates AI voice for cue lines with matching emotion
   - Voice settings adjust based on emotion (stability, style, boost)
   - Voice selection based on character analysis (gender + age)
   - Supports: angry, sad, happy, screaming, whispering, sarcastic, loving, desperate

3. **Simplified User Flow**
   - Step 1: Upload PDF → AI analyzes automatically
   - Step 2: Tap to select your character
   - Step 3: Generate AI Voices (one button)
   - Step 4: Start Rehearsal with auto-playing cue audio

4. **Reader Enhancements**
   - Auto-play cue line audio
   - Mute/unmute toggle
   - Audio playback controls

**API Endpoints Added:**
- POST /api/projects/{id}/generate-audio/{line_id} - Generate single line TTS
- POST /api/projects/{id}/generate-all-audio - Generate all cue line TTS

**Integrations:**
- OpenAI GPT-5.2 via Emergent LLM key
- ElevenLabs TTS API (user's key)

## Update (Feb 20, 2026 - Session 4)
### Voice Preview & Self-Tape Recording Added

**New Features:**

1. **Voice Preview**
   - Speaker icon next to each character card
   - Click to hear a sample of that character's AI voice
   - Uses ElevenLabs to generate sample from first line
   - Play/pause controls

2. **Self-Tape Recording**
   - Full recording studio at /record/:id
   - Camera preview with mirror mode
   - Microphone controls
   - 3-2-1 countdown before recording
   - Recording timer display
   - Pause/resume recording
   - Script sidebar shows during recording
   - Auto-advance lines with cue audio playback
   - Download recording as WebM file
   - Retake option
   - Settings: camera on/off, mic on/off, auto-play cues, show slate

3. **UI Improvements**
   - Character cards now single column with voice preview
   - Shows voice_type from AI analysis
   - "Record Self-Tape" button on project detail
   - Bottom nav hidden during recording

**Routes:**
- /record/:id - Self-tape recording studio

**Components:**
- Recording.jsx - Full recording feature
- Updated ProjectDetail.jsx - Voice preview + record button

## Update (Feb 20, 2026 - Session 5)
### Take Management & Video Features

**New Features:**

1. **Take Management**
   - Save multiple recording takes
   - Add notes to each take
   - Mark favorites (star icon)
   - View all takes in a list
   - Delete unwanted takes
   - Download individual takes

2. **Take Comparison**
   - Select 2 takes to compare
   - Side-by-side video playback
   - Easy selection with numbered circles
   - Compare button appears when 2 selected

3. **Enhanced Recording Flow**
   - Shows take count in header
   - "X takes" button to view all takes
   - Save dialog with notes option
   - Take number shown on slate

4. **Video Storage**
   - Takes stored in MongoDB as base64
   - WebM format (browser native)
   - MP4 conversion endpoint (placeholder for FFmpeg)

**API Endpoints:**
- GET /api/projects/{id}/takes - List all takes
- POST /api/projects/{id}/takes - Save new take
- GET /api/projects/{id}/takes/{take_id} - Get take
- PUT /api/projects/{id}/takes/{take_id} - Update notes/favorite
- DELETE /api/projects/{id}/takes/{take_id} - Delete take
- POST /api/projects/{id}/takes/{take_id}/convert - Convert to MP4 (future)

**Models:**
- TakeCreate, TakeResponse, TakeUpdate
