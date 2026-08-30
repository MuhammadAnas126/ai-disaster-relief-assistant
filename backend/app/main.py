# app/main.py
import logging

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.routers import monitor

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s | %(levelname)s | %(name)s | %(message)s",
)

app = FastAPI(
    title="Sentinel AI Backend",
    description="Real-time multimodal disaster relief monitoring system",
    version="0.1.0"
)

# CORS (frontend will typically run on a separate origin)
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Include routers
app.include_router(monitor.router, prefix="/api/v1/monitor", tags=["Monitoring"])

@app.get("/")
async def root():
    return {"message": "Sentinel AI is online. Ready to save lives."}