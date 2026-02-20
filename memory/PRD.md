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
