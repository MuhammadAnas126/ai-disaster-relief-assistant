# app/services/ai_service.py
import json
import logging
import re

import dashscope
from dashscope import Generation, MultiModalConversation
from app.config import settings

logger = logging.getLogger(__name__)

# Initialize DashScope
dashscope.api_key = settings.DASHSCOPE_API_KEY


def _parse_json_block(raw_text: str) -> dict:
    """
    Extract a JSON object from model output that may be wrapped in prose
    or markdown code fences.
    """
    # Strip ```json ... ``` fences if present
    fenced = re.search(r"```(?:json)?\s*(\{.*?\})\s*```", raw_text, re.DOTALL)
    candidate = fenced.group(1) if fenced else None
    if candidate is None:
        # Fall back to the first {...} span in the text
        span = re.search(r"\{.*\}", raw_text, re.DOTALL)
        candidate = span.group(0) if span else raw_text
    try:
        return json.loads(candidate)
    except json.JSONDecodeError:
        # Best-effort: flag unparseable output but keep the raw text
        return {"parse_error": True, "raw": raw_text}

class AIService:
    @staticmethod
    async def analyze_victim_image(image_url: str) -> dict:
        """
        Uses Qwen-VL to analyze a frame from the camera.
        """
        messages = [
            {
                "role": "user",
                "content": [
                    {"image": image_url},
                    {"text": "You are an emergency rescue AI. Analyze this image. Is the primary human subject standing, sitting, or collapsed/lying flat on the ground? Are there visible signs of injury or structural collapse? Output STRICT JSON only: {'status': 'standing|sitting|collapsed', 'confidence': 0.0-1.0, 'hazards': []}"}
                ]
            }
        ]
        
        try:
            response = MultiModalConversation.call(
                model='qwen-vl-max', # or qwen-vl-plus
                messages=messages,
                result_format='message'
            )
            
            if response.status_code == 200:
                raw_text = response.output.choices[0].message.content[0]["text"]
                return {"success": True, "data": _parse_json_block(raw_text)}
            else:
                return {"success": False, "error": response.message}
                
        except Exception as e:
            return {"success": False, "error": str(e)}

    @staticmethod
    async def analyze_audio_transcript(transcript: str) -> dict:
        """
        Uses Qwen-Max to analyze audio transcript for distress.
        """
        system_prompt = (
            "You are an emergency rescue AI listening to audio transcripts from a "
            "disaster zone. Determine whether the speaker is in distress: crying for "
            "help, screaming, reporting injuries or being trapped, or describing "
            "urgent hazards. Output STRICT JSON only: "
            "{\"is_distress\": true|false, \"severity\": \"none|low|medium|critical\", "
            "\"confidence\": 0.0-1.0, \"reason\": \"short explanation\"}"
        )

        try:
            response = Generation.call(
                model='qwen-max',
                messages=[
                    {"role": "system", "content": system_prompt},
                    {"role": "user", "content": transcript},
                ],
                result_format='message',
            )

            if response.status_code == 200:
                raw_text = response.output.choices[0].message.content
                return {"success": True, "data": _parse_json_block(raw_text)}
            else:
                return {"success": False, "error": response.message}

        except Exception as e:
            return {"success": False, "error": str(e)}