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

## Update (Feb 20, 2026 - Session 6)
### Direct Submission, Membership & Cloud Storage

**New Features:**

1. **Direct Submission / Sharing**
   - Create shareable links for takes
   - Add recipient name, email, message
   - Links expire after 72 hours
   - Track view count
   - Public shared view page at /shared/:token
   - Copy link to clipboard

2. **Membership Tiers**
   - **Free Tier:**
     - Download to device
     - 5 takes per project
     - Basic AI analysis
   - **Pro Tier ($9.99/mo):**
     - Unlimited cloud storage (5GB)
     - Unlimited takes
     - Direct submission to casting
     - Shareable links
     - Priority support
     - Advanced AI analysis

3. **Cloud Storage (Pro)**
   - Cloudinary integration (placeholder - needs API keys)
   - Signed upload URLs for secure uploads
   - Track storage usage

4. **Settings Page Enhanced**
   - Membership status display
   - Pro features list
   - Upgrade button
   - Storage usage meter (Pro)
   - Cloud configuration status

**API Endpoints:**
- GET /api/membership/tiers
- GET /api/membership/status
- POST /api/membership/upgrade
- GET /api/cloudinary/signature (Pro)
- POST /api/projects/{id}/takes/{id}/upload-cloud
- POST /api/projects/{id}/takes/{id}/share
- GET /api/shared/{token} (public)
- GET /api/projects/{id}/takes/{id}/shares
- DELETE /api/shares/{id}

**Components:**
- SharedView.jsx - Public shared video page
- Updated Settings.jsx - Membership info
- Updated Recording.jsx - Share dialog

## Update (Feb 21, 2026 - Session 7)
### Critical Bug Fix: AI Voice Generation

**Issue Fixed:**
- "Generate AI Voices" feature was failing with 500 Internal Server Error
- Root cause: ElevenLabs `VoiceSettings` is a frozen Pydantic model
- The code was attempting to modify `base_settings.style` and `base_settings.stability` directly
- Pydantic v2 frozen models don't allow attribute modification after creation

**Fix Applied:**
- Refactored `get_voice_settings_for_emotion()` function in `backend/server.py`
- Changed from modifying existing VoiceSettings object to creating new one with adjusted values
- Uses tuples for presets instead of pre-created frozen objects
- Properly calculates intensity-adjusted values before constructing VoiceSettings

**Testing:**
- Verified fix with curl: Generated audio for 4 cue lines successfully
- Verified in UI: Audio players now appear for cue lines (Sarah's lines)
- Full flow works: Upload PDF → Select character → Generate AI Voices → Rehearse

**Status:** ✅ FIXED AND VERIFIED

## Update (Feb 21, 2026 - Session 7 Continued)
### Video Download & Direct Submission Features

**New Features Implemented:**

1. **Save to Phone / Video Download**
   - Prominent "Save" button with phone icon on takes list
   - "Save to Phone" button on single take view
   - Downloads video as WebM file to device
   - Works with existing take storage

2. **Direct Submission to Casting**
   - "Send via Email" button in share dialog
   - Recipient name and email fields (required for email)
   - Optional message field
   - Creates share link and sends via Resend email
   - Beautiful HTML email template with CuePartner branding
   - Fallback to "Just Link" if email not configured

**API Endpoints Added:**
- `POST /api/projects/{project_id}/takes/{take_id}/submit` - Direct submission with email
- `GET /api/email/status` - Check if email is configured

**Backend Integration:**
- Resend email service integration
- Async non-blocking email sending
- HTML email templates with inline CSS
- Share link tracking (email_sent status)

**UI Updates:**
- Share dialog redesigned with two options: "Send via Email" (primary) and "Just Link" (secondary)
- Takes list now shows Mail icon instead of Share2 for clarity
- "Save" button highlighted in green
- Single take view has prominent "Save to Phone" and "Send to Casting" buttons

**Status:** ✅ IMPLEMENTED AND TESTED

## Update (Feb 21, 2026 - Session 7 Continued - Part 2)
### Reader/Teleprompter UX Improvements

**Issues Fixed:**

1. **Auto-Advance After Cue Audio**
   - When AI reads a cue line, it automatically advances to the next line after audio ends
   - No more manual tapping "Next" after every cue line

2. **Improved Voice Detection**
   - Better fuzzy matching algorithm for speech recognition
   - More reliable detection when actor speaks their lines
   - 40% word match threshold or 3+ matching words

3. **Better PDF Parsing**
   - Improved character name detection (handles multi-word names, titles)
   - Better handling of multi-line dialogue
   - Skips more stage directions and technical terms
   - Accumulates dialogue correctly across line breaks

4. **Enhanced Reader UI**
   - Clear status indicator ("Your turn - Listening..." / "Playing...")
   - Animated status dot showing current state
   - Larger mic button with scale animation when active
   - Debug transcript display when enabled

5. **Deployment Fixes**
   - CORS set to "*" for production
   - Root-level `/health` endpoint added
   - Hardcoded preview URLs removed

**How Rehearsal Works Now:**
1. Start Reader from project page
2. Tap the mic button to begin
3. When it's your line (purple highlight), speak it
4. Voice detection recognizes your line and advances
5. When it's a cue line (other character), AI audio plays
6. After audio ends, automatically advances to next line
7. Repeat until script is complete

## Pending Tasks

### P2 - Future
1. **Stripe Integration**: Payment processing for Pro membership
2. **Backend Refactoring**: Break down monolithic server.py into modules
3. **PostgreSQL Migration**: Optional migration to Supabase if requested
4. **Domain Verification**: Verify custom domain in Resend for production emails

## Update (Feb 23, 2026 - Session 8)
### Critical Bug Fix: PDF Upload Silent Failure

**Issue Fixed:**
- PDF script upload was failing silently, showing "0 Lines, 0 Characters" especially on mobile
- Users couldn't proceed with scripts that appeared to upload successfully but had no content

**Root Cause:**
- When PDF parsing couldn't detect dialogue, it was returning empty arrays silently instead of throwing an error
- Users received a "success" response but with no usable data

**Fix Applied:**
1. **Backend Improvements:**
   - Added proper error handling when no dialogue is detected
   - Returns 400 error with helpful message: "Could not detect dialogue in PDF. Try 'Paste Script' instead."
   - Added detailed logging for PDF uploads (filename, content_type, size, bytes received)
   - Validates file content is not empty before processing

2. **Frontend Improvements:**
   - Added client-side validation for empty files
   - Shows file info in console for debugging
   - Checks response for 0 lines/characters and shows appropriate warning
   - Resets file input after upload to allow re-uploading same file
   - Extended toast duration for error messages (8 seconds)

3. **Multiple Parsing Strategies:**
   - Standard screenplay format (CHARACTER on own line, dialogue below)
   - Colon format (CHARACTER: dialogue on same line)
   - All-caps character detection fallback

**Testing:**
- Created comprehensive test suite in `/app/backend/tests/test_pdf_upload.py`
- 11/11 tests passing (screenplay format, colon format, error handling, character selection)
- Verified on desktop and mobile viewports
- Both PDF upload and "Paste Script" alternatives working correctly

**Status:** ✅ FIXED AND VERIFIED

## Known Issues
- **Membership System**: UI-only, no payment integration (MOCKED)
- **Resend Test Mode**: Currently can only send emails to verified email. Verify domain for production use.

## Pending Tasks

### P1 - Upcoming
1. **Stripe Integration**: Payment processing for Pro membership

### P2 - Future
2. **Backend Refactoring**: Break down monolithic server.py into modules
3. **PostgreSQL Migration**: Optional migration to Supabase if requested
4. **Domain Verification**: Verify custom domain in Resend for production emails
