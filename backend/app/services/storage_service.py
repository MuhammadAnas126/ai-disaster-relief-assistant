import uuid

import oss2

from app.config import settings


class StorageService:
    def __init__(self):
        self.auth = None
        self.bucket = None

        if not settings.oss_configured:
            return

        # Initialize Alibaba Cloud OSS Auth
        self.auth = oss2.Auth(
            settings.ALIBABA_CLOUD_ACCESS_KEY_ID,
            settings.ALIBABA_CLOUD_ACCESS_KEY_SECRET,
        )
        # Initialize the Bucket
        self.bucket = oss2.Bucket(
            self.auth,
            settings.OSS_ENDPOINT,
            settings.OSS_BUCKET_NAME,
        )

    async def upload_image(self, file_content: bytes, original_filename: str) -> str:
        """
        Uploads an image to OSS and returns the public URL.
        """
        if self.bucket is None:
            raise RuntimeError(
                "OSS is not configured. Set ALIBABA_CLOUD_ACCESS_KEY_ID, "
                "ALIBABA_CLOUD_ACCESS_KEY_SECRET, OSS_BUCKET_NAME, and OSS_ENDPOINT "
                "before uploading images."
            )

        # Generate a unique filename to prevent overwriting
        file_extension = original_filename.split('.')[-1]
        unique_filename = f"sentinel_frames/{uuid.uuid4()}.{file_extension}"

        try:
            # Upload the file to the bucket
            self.bucket.put_object(unique_filename, file_content)

            # Construct and return the URL
            # Note: For a hackathon, you might need to make the bucket public-read
            # or generate a signed URL. Here is a signed URL for security:
            url = self.bucket.sign_url('GET', unique_filename, 3600)  # Valid for 1 hour
            return url

        except Exception as e:
            raise Exception(f"OSS Upload failed: {str(e)}")


# Create a singleton instance to reuse connections
storage_service = StorageService()
