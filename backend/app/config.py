# app/config.py
import os
from pathlib import Path
from dotenv import load_dotenv

load_dotenv(Path(__file__).resolve().parent.parent / ".env")

class Settings:
    DASHSCOPE_API_KEY: str = os.getenv("DASHSCOPE_API_KEY")
    DASHSCOPE_BASE_URL: str = os.getenv("DASHSCOPE_BASE_URL", "")
    ALIBABA_CLOUD_ACCESS_KEY_ID: str = os.getenv("ALIBABA_CLOUD_ACCESS_KEY_ID")
    ALIBABA_CLOUD_ACCESS_KEY_SECRET: str = os.getenv("ALIBABA_CLOUD_ACCESS_KEY_SECRET")
    OSS_BUCKET_NAME: str = os.getenv("OSS_BUCKET_NAME")
    OSS_ENDPOINT: str = os.getenv("OSS_ENDPOINT")
    LOCAL_STORAGE_DIR: str = os.getenv("LOCAL_STORAGE_DIR", "storage")
    AUTHORITY_PHONE: str = os.getenv("AUTHORITY_PHONE", "+923001234567")
    WEATHER_POLL_INTERVAL_SECONDS: int = int(os.getenv("WEATHER_POLL_INTERVAL_SECONDS", "600"))

    @property
    def oss_configured(self) -> bool:
        """True when all OSS credentials are present."""
        return all([
            self.ALIBABA_CLOUD_ACCESS_KEY_ID,
            self.ALIBABA_CLOUD_ACCESS_KEY_SECRET,
            self.OSS_BUCKET_NAME,
            self.OSS_ENDPOINT,
        ])

settings = Settings()
