# app/config.py
import os
import logging
from pathlib import Path
from dotenv import load_dotenv

load_dotenv(Path(__file__).resolve().parent.parent / ".env")

logger = logging.getLogger(__name__)
OPENAI_COMPATIBLE_DASHSCOPE_URL = "https://dashscope-intl.aliyuncs.com/compatible-mode/v1"


def _resolve_dashscope_base_url() -> str:
    configured_url = os.getenv("DASHSCOPE_BASE_URL", "").strip().rstrip("/")
    if not configured_url:
        return OPENAI_COMPATIBLE_DASHSCOPE_URL

    # Workspace MaaS URLs do not expose the OpenAI-compatible
    # /chat/completions route used by the application.
    if ".maas.aliyuncs.com" in configured_url:
        logger.warning(
            "Ignoring legacy DASHSCOPE_BASE_URL; using the OpenAI-compatible international endpoint"
        )
        return OPENAI_COMPATIBLE_DASHSCOPE_URL

    return configured_url


class Settings:
    DASHSCOPE_API_KEY: str = os.getenv("DASHSCOPE_API_KEY")
    DASHSCOPE_BASE_URL: str = _resolve_dashscope_base_url()
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
