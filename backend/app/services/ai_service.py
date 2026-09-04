# app/services/ai_service.py
import json
import logging
import re

import dashscope
from dashscope import Generation, MultiModalConversation
from app.config import settings

logger = logging.getLogger(__name__)

QWEN_FLASH_FALLBACK_MODEL = "qwen3.8-flash-next"

# Initialize DashScope only when a key is configured.
dashscope.api_key = settings.DASHSCOPE_API_KEY or ""
if settings.DASHSCOPE_BASE_URL:
    dashscope.base_http_api_url = settings.DASHSCOPE_BASE_URL


def _repair_json_literals(raw_text: str) -> str:
    """
    Escape raw control characters (newlines, tabs, carriage returns) that
    appear inside JSON string literals — the most common way LLMs emit
    invalid "strict" JSON. Structural whitespace between tokens is kept.
    """
    out = []
    in_str = False
    escaped = False
    for ch in raw_text:
        if escaped:
            out.append(ch)
            escaped = False
            continue
        if ch == "\\" and in_str:
            out.append(ch)
            escaped = True
            continue
        if ch == '"':
            in_str = not in_str
            out.append(ch)
            continue
        if in_str and ch == "\n":
            out.append("\\n")
        elif in_str and ch == "\r":
            out.append("\\r")
        elif in_str and ch == "\t":
            out.append("\\t")
        else:
            out.append(ch)
    return "".join(out)


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
        # LLMs often emit raw newlines inside string literals — repair and retry.
        try:
            return json.loads(_repair_json_literals(candidate))
        except json.JSONDecodeError:
            # Best-effort: flag unparseable output but keep the raw text
            return {"parse_error": True, "raw": raw_text}

def _build_chat_system_prompt(context: dict | None = None) -> str:
    """
    System prompt for the disaster relief chatbot. Tuned for high-stress use
    and built around Muhafiz's four core workflows — instant survival &
    first-aid, guided SOS case filing, emergency hotline guidance, and
    bilingual EN/UR support — with hard safety guardrails and personalization
    from the user's submitted case context.
    """
    context_block = "No case details have been submitted yet."
    if context:
        lines = []
        if context.get("situation"):
            lines.append(f"- Reported situation: {str(context['situation'])[:300]}")
        if context.get("location"):
            lines.append(f"- Reported location: {context['location']}")
        if context.get("trapped"):
            lines.append(f"- People trapped: {context['trapped']}")
        if context.get("peopleAffected") is not None:
            lines.append(f"- People affected: {context['peopleAffected']}")
        if context.get("submitted"):
            lines.append("- Their case has already been submitted to responders.")
        if lines:
            context_block = "\n".join(lines)

    prompt = (
        "You are Muhafiz, a disaster relief assistant for people affected by "
        "floods, earthquakes, building collapses, fires, and other emergencies "
        "in Pakistan. You talk to victims, their families, and relief workers.\n\n"
        "YOUR FOUR CORE WORKFLOWS\n"
        "1. INSTANT SURVIVAL & FIRST-AID. When the user describes a high-stress "
        "scenario — flash flood, earthquake, fire, building collapse, severe "
        "bleeding, someone not breathing — lead with exactly 3-4 short, "
        "actionable steps (flash flood safety, basic CPR steps, drop-cover-"
        "hold for earthquakes, firm pressure for severe bleeding). Start each "
        "step with a verb. No long preamble before the steps.\n"
        "2. GUIDED SOS CASE FILING. Let the user describe their emergency in "
        "plain text. Whenever they express an urgent need for rescue or help, "
        "write your normal user-facing reply FIRST (acknowledgment, steps, or "
        "hotlines — the same kind you always give), and then append one final "
        "line in EXACTLY this format (it powers a 1-tap SOS button that "
        "pre-fills the case form). NEVER reply with only the marker line — "
        "the marker is invisible to the user, so a reply without text before "
        "it shows as a blank message:\n"
        "SOS_OFFER: {\"description\": \"<one-line situation summary>\", "
        "\"location\": \"<place name>\", \"peopleAffected\": <number or null>, "
        "\"trapped\": \"yes|partial|no\"}\n"
        "Extraction rules — fill every field from what the user actually said:\n"
        "- description: one line covering the hazard, place, and people "
        "involved, written in the SAME language the user wrote in (English "
        "or Urdu — never translate it).\n"
        "- location: the address the user stated, copied as completely as "
        "they gave it — city, area, landmark, and house or street number "
        "all together (\"I am in Karachi\", \"I'm trapped in a house in "
        "Lahore near Model Town house no 1130\" → \"house no 1130 near "
        "Model Town, Lahore\", \"میں کراچی میں ہوں\") — an empty string "
        "when they named none. Never drop the house or street number: the "
        "address is pinned onto the map, and rescuers use it.\n"
        "- peopleAffected: the count they mentioned (\"5 people are trapped\", "
        "\"5 لوگ پھنسے ہوئے ہیں\") — null when they mentioned none.\n"
        "- trapped: \"yes\" when people are stuck or trapped, \"partial\" when "
        "partially stuck or unclear, \"no\" otherwise.\n"
        "- Emit the JSON on a single line, no markdown fences, and include "
        "every field even when empty.\n"
        "When trapped is yes or partial, also ask one short follow-up "
        "question about who is trapped and where exactly; if their location "
        "is vague, ask for the nearest landmark or house number — the answer "
        "refines the next SOS_OFFER.\n"
        "Offer it even when you have just given first-aid steps, but never "
        "for general questions (hotlines, preparedness, supplies).\n"
        "3. EMERGENCY HOTLINE GUIDANCE. When asked for emergency numbers or "
        "rescue protocols, share these verified helplines for Pakistan: "
        "Rescue 1122 (national emergency: ambulance, rescue, fire), Edhi "
        "Ambulance 115, Fire Brigade 16, Police 15. Tell the caller to state "
        "their location first. These are the only numbers you may share.\n"
        "4. BILINGUAL SUPPORT (EN/UR). Detect the language of every message. "
        "If the user writes in Urdu script (e.g. \"مدد چاہیے\", \"پانی بڑھ رہا "
        "ہے\") or Roman Urdu, reply fully in Urdu immediately — never ask "
        "which language they prefer, never offer a language menu, and never "
        "switch languages unless the user does.\n\n"
        "VOICE AND TONE\n"
        "- Calm, warm, and reassuring. Never alarmist.\n"
        "- Short sentences. Keep replies under 120 words.\n"
        "- Plain text only. No markdown, no asterisks, no bold symbols — the "
        "chat renders raw text.\n"
        "- If the user sounds scared or hurt, open with one short line of "
        "acknowledgment before any advice.\n\n"
        "HOW TO ANSWER\n"
        "- Lead with the most important action.\n"
        "- Use simple numbered steps (1. 2. 3.) or short dash bullets when "
        "giving several instructions.\n"
        "- Cover: shelter, basic first aid, evacuation, water and food safety, "
        "staying visible to rescuers, and emotional support.\n\n"
        "SAFETY RULES (never break these)\n"
        "- If anything sounds life-threatening, the very first line of your "
        "reply must be: Call Rescue 1122 now.\n"
        "- Basic first aid only — pressure for bleeding, cool water for burns, "
        "keep the injured still and warm. Never diagnose, never prescribe "
        "medicine, never advise beyond basic first aid.\n"
        "- Never suggest risky actions: entering damaged buildings, crossing "
        "moving floodwater, touching fallen power lines. If the user plans "
        "something dangerous, say it plainly and give the safer option.\n"
        "- You are an information assistant only. Never claim rescuers are on "
        "the way or that you have contacted anyone.\n"
        "- If you lack specific local information (shelter addresses, road "
        "status, active alerts), say so clearly and give general safe guidance "
        "instead. Never invent shelters, routes, or phone numbers — the only "
        "numbers you may share are the verified helplines listed above.\n\n"
        f"USER CONTEXT (from their emergency report, if any)\n{context_block}\n\n"
        "Personalize your answers with this context: floods mean water safety "
        "and higher ground first; trapped people mean noise at intervals, dust "
        "protection, and battery conservation; a submitted case means you can "
        "reassure them responders already have their details."
    )

    if context and context.get("language") == "ur":
        prompt += (
            "\n\nThe user has selected Urdu for this chat. Reply in Urdu "
            "unless they write in another language."
        )

    return prompt


def _generation_call_with_fallback(primary_model: str, **kwargs):
    """Call a text model, retrying once with the configured Qwen Flash fallback."""
    response = Generation.call(model=primary_model, **kwargs)
    if response.status_code == 200 or primary_model == QWEN_FLASH_FALLBACK_MODEL:
        return response

    logger.warning(
        "Text model %s failed (%s); retrying with %s",
        primary_model,
        getattr(response, "message", "unknown error"),
        QWEN_FLASH_FALLBACK_MODEL,
    )
    return Generation.call(model=QWEN_FLASH_FALLBACK_MODEL, **kwargs)


# Marker line the chat model appends when a user needs rescue. It is parsed
# out of the visible reply and returned separately so the frontend can render
# its 1-tap SOS action card with the extracted case fields.
_SOS_OFFER_RE = re.compile(r"SOS_OFFER:\s*(.+)", re.DOTALL)


def _extract_sos_offer(reply_text: str) -> tuple[str, dict | None]:
    """
    Split an "SOS_OFFER: {json}" marker line out of a chat reply, leaving clean
    prose for the chat bubble and the raw extracted case fields. Returns a
    minimal {"description": ...} payload when the model wrote plain text
    instead of JSON, so a malformed offer still pre-fills the form.
    """
    match = _SOS_OFFER_RE.search(reply_text)
    if not match:
        return reply_text, None

    raw_payload = match.group(1).strip()
    cleaned = (reply_text[:match.start()] + reply_text[match.end():]).strip()
    # Tidy the whitespace the removed marker line leaves behind.
    cleaned = re.sub(r"[ \t]+\n", "\n", cleaned)
    cleaned = re.sub(r"\n{3,}", "\n\n", cleaned).strip()

    parsed = _parse_json_block(raw_payload)
    if parsed.get("parse_error"):
        # Model wrote plain text or broken JSON instead of the contract —
        # salvage a description so the SOS card still pre-fills the form.
        desc_match = re.search(r'"description"\s*:\s*"([^"]+)"', raw_payload)
        fallback = (desc_match.group(1) if desc_match else raw_payload).strip("`").strip()
        if fallback:
            return cleaned, {"description": fallback}
        return cleaned, None
    return cleaned, parsed


# "lat, lng" pairs reported in the case context (e.g. "24.8607, 67.0011").
_COORDS_RE = re.compile(
    r"\s*(-?\d+(?:\.\d+)?)\s*,\s*(-?\d+(?:\.\d+)?)\s*"
)


def _build_sos_prefill(data: dict, context: dict | None) -> dict | None:
    """
    Normalize the model's SOS_OFFER fields into a prefill the Register Your
    Case form can trust: a required one-line description (in the user's own
    language), an optional place name, people count, and trapped status. GPS
    coordinates ride along when the case context carries them; otherwise the
    named location is kept as the label.
    """
    description = str(data.get("description") or "").strip()
    if not description:
        return None

    prefill: dict = {"description": description}

    location = str(data.get("location") or "").strip()
    if location:
        prefill["location"] = location

    people = data.get("peopleAffected")
    if isinstance(people, bool):
        people = None
    elif isinstance(people, str):
        digits = re.search(r"\d+", people)
        people = int(digits.group(0)) if digits else None
    elif isinstance(people, float):
        people = int(people)
    if isinstance(people, int) and people >= 0:
        prefill["peopleAffected"] = people

    trapped = str(data.get("trapped") or "").strip().lower()
    if trapped in ("yes", "partial", "no"):
        prefill["trapped"] = trapped

    # Context coordinates win over a named place for the map pin — the place
    # name still travels as the human-readable label.
    if context and context.get("location"):
        coords = _COORDS_RE.fullmatch(str(context["location"]))
        if coords:
            prefill["lat"] = float(coords.group(1))
            prefill["lng"] = float(coords.group(2))

    return prefill


def _build_admin_system_prompt(snapshot: dict, context: dict | None = None) -> str:
    """
    System prompt for the Admin AI Assistant. Grounded in a live operations
    snapshot so every answer reflects full system data.
    """
    prompt = (
        "You are Muhafiz, the full-access AI Operations Command Co-Pilot for dispatch administrators "
        "in Pakistan. You talk to administrators and dispatchers only — never to victims.\n\n"
        "YOU HAVE ACCESS TO ALL SYSTEM DATA:\n"
        "1. Complete incident records (SOS cases, status, trapped counts, descriptions, GPS coordinates).\n"
        "2. All broadcast alert history.\n"
        "3. Live evidence gallery submissions and Qwen-VL visual triage findings.\n\n"
        "YOUR FOUR JOBS\n"
        "1. Natural language case querying. Answer questions about incoming victim reports (SOS cases) "
        "using the OPERATIONS SNAPSHOT below.\n"
        "2. Broadcast drafting. When asked to draft, write, or generate a broadcast or emergency alert, "
        "fill the \"broadcast\" field: choose the level (info, warning, or critical) and write one message "
        "in BOTH English and Urdu, labeled \"English:\" and \"Urdu:\" on separate lines.\n"
        "3. Executive situation summaries. Synthesize the snapshot into concise, action-oriented bullets.\n"
        "4. Visual triage aggregation. Interpret the \"visualTriage\" and \"evidenceGallery\" sections.\n\n"
        "LOCATION & COORDINATE RULES (STRICT):\n"
        "- NEVER output or mention generic system label placeholders like 'Reported location' or 'Unknown'.\n"
        "- Never claim coordinates are unavailable when an incident exists in the snapshot.\n"
        "- When asked about any specific incident (e.g. 'demolished house' or 'inc-6'), search all_records in the snapshot "
        "and answer directly with the incident title, location label, and exact coordinates.\n\n"
        "RESPONSE FORMAT\n"
        "- Normal answers: reply in plain text only — no JSON, no markdown.\n"
        "- ONLY when asked to draft, write, or generate a broadcast or alert, reply with STRICT JSON:\n"
        "{\"reply\": \"<one-line confirmation>\", \"broadcast\": {\"level\": \"info|warning|critical\", \"message\": \"English: ...\\nUrdu: ...\"}}\n\n"
        "RULES (never break these)\n"
        "- Ground every number and every case in the OPERATIONS SNAPSHOT.\n"
        "- Plain text replies: numbered lists (1. 2. 3.) and dashes are fine; no markdown symbols, no asterisks.\n"
        "- Be concise and operational: lead with the answer, then key details.\n"
        "- Never claim rescuers were dispatched or that anyone was contacted.\n\n"
        "OPERATIONS SNAPSHOT (live data, generated just now)\n"
        + json.dumps(snapshot, indent=2, default=str)
    )

    if context and context.get("language") == "ur":
        prompt += (
            "\n\nThe admin has selected Urdu for this chat. Write the \"reply\" "
            "in Urdu unless they write in another language."
        )

    return prompt

class AIService:
    @staticmethod
    async def score_incidents(incidents: list[dict]) -> dict:
        """Use Qwen Turbo to assign each incident an operational priority score."""
        if not incidents:
            return {}

        prompt = (
            "You are an emergency dispatch prioritization model. Score each incident "
            "from 0 to 100 using people affected, trapped status, severity score, "
            "structural damage, and incident description. Trapped people are the "
            "strongest signal. Larger trapped populations must always receive a "
            "higher score than smaller trapped populations when other factors are "
            "similar: 1,000 trapped must rank above 700 trapped. Never let a disaster "
            "type such as flood outrank an earthquake solely because of its type. "
            "Return STRICT JSON only in "
            "this format: {\"scores\": [{\"id\": \"incident id\", \"score\": 0}]}. "
            "Include exactly one score for every incident.\n\n"
            f"INCIDENTS\n{json.dumps(incidents, default=str)}"
        )

        try:
            response = _generation_call_with_fallback(
                "qwen-turbo",
                messages=[{"role": "user", "content": prompt}],
                result_format="message",
            )
            if response.status_code != 200:
                logger.warning("Qwen Turbo priority scoring failed: %s", response.message)
                return {}

            parsed = _parse_json_block(response.output.choices[0].message.content)
            result = {}
            incident_by_id = {str(incident.get("id", "")): incident for incident in incidents}
            for item in parsed.get("scores", []):
                incident_id = str(item.get("id", ""))
                score = item.get("score")
                if incident_id and isinstance(score, (int, float)):
                    model_score = max(0, min(100, round(score)))
                    source = incident_by_id.get(incident_id, {})
                    people_affected = max(0, int(source.get("peopleAffected", 0) or 0))
                    trapped = str(source.get("trapped", "no")).lower()
                    # Keep model judgment while enforcing a transparent urgency floor.
                    evidence_score = min(100, round(people_affected * 0.05))
                    if trapped == "yes":
                        evidence_score = min(100, evidence_score + 40)
                    elif trapped == "partial":
                        evidence_score = min(100, evidence_score + 25)
                    result[incident_id] = round(model_score * 0.6 + evidence_score * 0.4)
            return result
        except Exception as exc:
            logger.warning("Qwen Turbo priority scoring unavailable: %s", exc)
            return {}

    @staticmethod
    async def analyze_victim_image(image_url: str) -> dict:
        """
        Uses Qwen-VL to analyze a frame from the camera. Accepts a public
        image URL or a raw base64 payload — DashScope requires base64 input
        as a data URI, so it is wrapped here.
        """
        image_ref = image_url
        if not image_url.startswith(("http://", "https://", "data:")):
            image_ref = f"data:image/jpeg;base64,{image_url}"

        messages = [
            {
                "role": "user",
                "content": [
                    {"image": image_ref},
                    {"text": "You are an emergency rescue AI. Analyze this image. Is the primary human subject standing, sitting, or collapsed/lying flat on the ground? Are there visible signs of injury or structural collapse? Also classify the disaster type shown. Output STRICT JSON only: {'status': 'standing|sitting|collapsed', 'disaster_type': 'flood|earthquake|fire|building_collapse|landslide|storm|other', 'confidence': 0.0-1.0, 'hazards': []}"}
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
            response = _generation_call_with_fallback(
                'qwen-max',
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


    @staticmethod
    async def chat(
        message: str,
        history: list[dict] | None = None,
        context: dict | None = None,
    ) -> dict:
        """
        Conversational Qwen-Max chatbot for disaster relief assistance.
        Accepts a message, optional conversation history, and optional context
        from the user's submitted emergency case (disaster type, location,
        trapped status) so guidance can be personalized. When the model flags
        an urgent rescue need it appends an "SOS_OFFER:" JSON line — extracted
        and normalized here into a description / location / peopleAffected /
        trapped prefill (plus context GPS coordinates when available) and
        returned as "sos" so the frontend can render its 1-tap SOS action
        card.
        """
        system_prompt = _build_chat_system_prompt(context)

        messages = [{"role": "system", "content": system_prompt}]
        if history:
            for msg in history:
                role = msg.get("role", "user")
                if role in ("user", "assistant"):
                    messages.append({"role": role, "content": msg.get("content", "")})
        messages.append({"role": "user", "content": message})

        try:
            response = _generation_call_with_fallback(
                'qwen-max',
                messages=messages,
                result_format='message',
            )

            if response.status_code == 200:
                reply_text = response.output.choices[0].message.content
                reply_text, sos_data = _extract_sos_offer(reply_text)
                sos = _build_sos_prefill(sos_data, context) if sos_data else None
                return {"success": True, "reply": reply_text, "sos": sos}
            else:
                return {"success": False, "error": response.message}

        except Exception as e:
            return {"success": False, "error": str(e)}

    @staticmethod
    async def admin_chat(
        message: str,
        snapshot: dict,
        history: list[dict] | None = None,
        context: dict | None = None,
    ) -> dict:
        """
        Qwen-Max chat for the Admin AI Assistant. Grounded in a live
        operations snapshot (incidents, alerts, visual triage). Normal answers
        come back as plain text; only broadcast drafting returns strict JSON,
        from which an optional broadcast draft ({level, message}) is extracted
        for the frontend's alert form.
        """
        system_prompt = _build_admin_system_prompt(snapshot, context)

        messages = [{"role": "system", "content": system_prompt}]
        if history:
            for msg in history:
                role = msg.get("role", "user")
                if role in ("user", "assistant"):
                    messages.append({"role": role, "content": msg.get("content", "")})
        messages.append({"role": "user", "content": message})

        try:
            response = _generation_call_with_fallback(
                'qwen-max',
                messages=messages,
                result_format='message',
            )

            if response.status_code != 200:
                return {"success": False, "error": response.message}

            raw_text = response.output.choices[0].message.content.strip()
            parsed = _parse_json_block(raw_text)

            reply = raw_text
            broadcast = None
            if not parsed.get("parse_error"):
                # Model followed the JSON contract (broadcast drafting).
                candidate = parsed.get("broadcast")
                if isinstance(candidate, dict):
                    level = str(candidate.get("level", "warning")).lower()
                    if level not in ("info", "warning", "critical"):
                        level = "warning"
                    text = str(candidate.get("message", "")).strip()
                    if text:
                        broadcast = {"level": level, "message": text}
                json_reply = str(parsed.get("reply", "")).strip()
                if json_reply:
                    reply = json_reply

            return {"success": True, "reply": reply, "broadcast": broadcast}

        except Exception as e:
            return {"success": False, "error": str(e)}


ai_service = AIService()