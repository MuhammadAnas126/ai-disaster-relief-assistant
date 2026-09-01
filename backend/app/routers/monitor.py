from fastapi import APIRouter, UploadFile, File, HTTPException
from app.services import triage_store
from app.services.ai_service import ai_service
import base64

router = APIRouter()

@router.post("/frame")
async def analyze_victim_frame(file: UploadFile = File(...)):
    """
    Receives a camera frame, converts to base64, and analyzes it with Qwen-VL.
    """
    if not file.content_type.startswith("image/"):
        raise HTTPException(status_code=400, detail="File must be an image")

    try:
        # Read the file content
        file_content = await file.read()
        
        # Convert to base64
        image_base64 = base64.b64encode(file_content).decode('utf-8')

        # Send to AI Service for analysis
        ai_result = await ai_service.analyze_victim_image(image_base64)

        # Archive successful findings so the Admin AI Assistant can
        # aggregate visual triage across all victim submissions.
        if ai_result.get("success") and isinstance(ai_result.get("data"), dict):
            triage_store.record_finding(ai_result["data"])

        # Return the result
        return {
            "success": True,
            "ai_analysis": ai_result
        }

    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@router.get("/health")
async def health_check():
    return {"status": "Sentinel Backend is healthy and ready!"}