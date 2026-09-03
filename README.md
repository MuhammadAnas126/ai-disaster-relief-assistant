# Sentinel AI Disaster Relief Assistant

## Description

Sentinel AI is a disaster-relief platform that helps victims report emergencies and enables responders to monitor incidents, evidence, alerts, and live updates.

## Features

- Emergency case registration and incident reporting
- Photo and video evidence uploads
- AI-powered incident and image analysis
- Live video sharing and real-time updates
- Incident map and response dashboard
- Responder check-ins and alerts
- English and Urdu AI assistant
- Optional local or Alibaba Cloud OSS media storage

## Technologies

- **Frontend:** Next.js, React, TypeScript, Tailwind CSS, Leaflet, Socket.IO
- **Backend:** Python, FastAPI, Uvicorn, Python Socket.IO
- **AI and storage:** DashScope and optional Alibaba Cloud OSS

## Setup

### Backend

```bash
cd backend
python -m venv .venv
```

Windows PowerShell:

```powershell
.\.venv\Scripts\Activate.ps1
pip install -r requirements.txt
uvicorn app.main:app --reload --port 8000
```

### Frontend

In a second terminal:

```bash
cd frontend
npm install
copy .env.example .env.local
npm run dev
```

Open `http://localhost:3000`.

## Environment Variables

Backend variables are stored in `backend/.env`:

```env
DASHSCOPE_API_KEY=your_api_key
LOCAL_STORAGE_DIR=storage
```

Frontend defaults are provided in `frontend/.env.example`:

```env
NEXT_PUBLIC_API_URL=http://localhost:8000/api
NEXT_PUBLIC_SOCKET_URL=http://localhost:8000
NEXT_PUBLIC_WS_URL=ws://localhost:8000/api/livestream/analyze
```

Alibaba Cloud OSS variables are optional. Do not commit credentials or environment files.

## License

No license has been specified yet.
