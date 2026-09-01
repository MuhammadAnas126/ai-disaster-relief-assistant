# app/routers/chatbot.py
import logging
from fastapi import APIRouter, HTTPException
from pydantic import BaseModel
from app.services.ai_service import ai_service

logger = logging.getLogger(__name__)

router = APIRouter()


class ChatRequest(BaseModel):
    message: str
    history: list[dict] | None = None
    context: dict | None = None


class ChatResponse(BaseModel):
    reply: str


# Signals that a conversation may involve a life-threatening situation.
# Matches are logged at WARNING so operators reviewing logs can follow up.
CRISIS_SIGNALS = (
    "trapped", "پھنس",
    "can't breathe", "cannot breathe", "not breathing",
    "unconscious", "bleeding heavily", "severe bleeding",
    "drowning", "heart attack", "stroke",
    "suicide", "خودکشی",
)


def _flag_crisis_signals(message: str, context: dict | None) -> None:
    """
    Flag possible life-threatening conversations for human review.
    Runs on every message; flags are visible in server logs.
    """
    lowered = message.lower()
    signals = [s for s in CRISIS_SIGNALS if s in lowered or s in message]
    if context and context.get("trapped") in ("yes", "partial"):
        signals.append("trapped (from case report)")
    if signals:
        logger.warning(
            "CHATBOT REVIEW FLAG - possible life-threatening situation. "
            "Signals: %s | Message: %r | Context: %s",
            ", ".join(signals),
            message[:200],
            context,
        )


@router.post("/message", response_model=ChatResponse)
async def chat_message(body: ChatRequest):
    """
    Send a message to the Qwen-Max-powered disaster relief chatbot.
    Pass conversation history for multi-turn context, and optional case
    context (situation, location, trapped status) for personalized guidance.
    """
    if not body.message.strip():
        raise HTTPException(status_code=400, detail="Message cannot be empty")

    _flag_crisis_signals(body.message, body.context)

    try:
        result = await ai_service.chat(body.message, body.history, body.context)

        if result.get("success"):
            return ChatResponse(reply=result["reply"])
        else:
            logger.error("Chatbot AI call failed: %s", result.get("error"))
            return ChatResponse(
                reply=(
                    "I'm having trouble connecting right now. If this is a "
                    "life-threatening emergency, call Rescue 1122 immediately. "
                    "Stay somewhere safe and try again in a moment."
                )
            )

    except Exception:
        logger.exception("Chatbot error")
        return ChatResponse(
            reply=(
                "Something went wrong on my side. If this is a life-threatening "
                "emergency, call Rescue 1122 immediately. Please try again."
            )
        )
