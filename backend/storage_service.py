# app/services/storage_service.py
import logging
import uuid
from datetime import datetime, timezone
from pathlib import Path

import oss2

from app.config import settings

logger = logging.getLogger(__name__)

ALLOWED_EXTENSIONS = {".jpg", ".jpeg", ".png", ".webp", ".bmp"}
MAX_FILE_SIZE = 10 * 1024 * 1024  # 10 MB


class StorageError(Exception):
    """Raised when a file cannot be stored."""


class StorageService:
    """
    Stores captured camera frames / evidence files.

    Uploads to Alibaba Cloud OSS when credentials are configured, otherwise
    falls back to a local directory so the system works out of the box.
    """

    def __init__(self):
        self._bucket = None
        if settings.oss_configured:
            try:
                auth = oss2.Auth(
                    settings.ALIBABA_CLOUD_ACCESS_KEY_ID,
                    settings.ALIBABA_CLOUD_ACCESS_KEY_SECRET,
                )
                self._bucket = oss2.Bucket(auth, settings.OSS_ENDPOINT, settings.OSS_BUCKET_NAME)
                logger.info("OSS storage enabled (bucket=%s)", settings.OSS_BUCKET_NAME)
            except Exception as e:
                logger.warning("OSS init failed, falling back to local storage: %s", e)
        else:
            logger.info("OSS not configured; using local storage directory")

        self._local_dir = Path(settings.LOCAL_STORAGE_DIR)

    @staticmethod
    def _validate(file_bytes: bytes, filename: str) -> str:
        """Validate upload and return a sanitized extension."""
        if not file_bytes:
            raise StorageError("Empty file")
        if len(file_bytes) > MAX_FILE_SIZE:
            raise StorageError(f"File exceeds {MAX_FILE_SIZE // (1024 * 1024)}MB limit")
        ext = Path(filename or "").suffix.lower()
        if ext not in ALLOWED_EXTENSIONS:
            raise StorageError(f"Unsupported file type: {ext or 'unknown'}")
        return ext

    @staticmethod
    def _build_object_key(ext: str) -> str:
        now = datetime.now(timezone.utc)
        date_part = now.strftime("%Y/%m/%d")
        return f"monitor/{date_part}/{uuid.uuid4().hex}{ext}"

    def save_image(self, file_bytes: bytes, filename: str) -> dict:
        """
        Persist an image and return its access URL plus storage backend used.
        """
        ext = self._validate(file_bytes, filename)
        object_key = self._build_object_key(ext)

        if self._bucket is not None:
            try:
                self._bucket.put_object(object_key, file_bytes)
                url = f"https://{settings.OSS_BUCKET_NAME}.{settings.OSS_ENDPOINT.replace('https://', '')}/{object_key}"
                return {"success": True, "url": url, "backend": "oss", "object_key": object_key}
            except Exception as e:
                logger.error("OSS upload failed, falling back to local: %s", e)

        # Local fallback
        local_path = self._local_dir / object_key
        local_path.parent.mkdir(parents=True, exist_ok=True)
        local_path.write_bytes(file_bytes)
        return {
            "success": True,
            "url": f"file:///{local_path.resolve().as_posix()}",
            "backend": "local",
            "object_key": object_key,
        }


storage_service = StorageService()
