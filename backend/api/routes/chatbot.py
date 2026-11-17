"""
api/routes/chatbot.py — AI Travel & Safety Assistant Router.
Serves SafeTrip Buddy conversational AI for the tourist mobile app and web frontend.
Supports Google Gemini when GEMINI_API_KEY is available, with an intelligent
built-in Pan-India tourist safety knowledge engine fallback.
"""
from __future__ import annotations

import logging
import os
import re
import sqlite3
from pathlib import Path
from typing import Optional

from fastapi import APIRouter, HTTPException
from fastapi.responses import PlainTextResponse
from pydantic import BaseModel

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/api", tags=["chatbot"])

DB_PATH = Path(__file__).resolve().parents[2] / "data" / "chat_history.db"


def _get_db():
    DB_PATH.parent.mkdir(parents=True, exist_ok=True)
    conn = sqlite3.connect(str(DB_PATH), check_same_thread=False)
    conn.execute(
        """
        CREATE TABLE IF NOT EXISTS chat_messages (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            client_id TEXT NOT NULL,
            chat_id TEXT NOT NULL,
            role TEXT NOT NULL,
            content TEXT NOT NULL,
            created_at TEXT DEFAULT CURRENT_TIMESTAMP
        )
        """
    )
    conn.commit()
    return conn


def _save_message(client_id: str, chat_id: str, role: str, content: str):
    conn = _get_db()
    conn.execute(
        "INSERT INTO chat_messages (client_id, chat_id, role, content) VALUES (?, ?, ?, ?)",
        (client_id, chat_id, role, content),
    )
    conn.commit()


def _load_messages(client_id: str, chat_id: str):
    conn = _get_db()
    rows = conn.execute(
        "SELECT role, content FROM chat_messages WHERE client_id = ? AND chat_id = ? ORDER BY id",
        (client_id, chat_id),
    ).fetchall()
    return [{"role": r[0], "content": r[1]} for r in rows]


class ChatRequest(BaseModel):
    client_id: str
    chat_id: str
    message: str
    latitude: Optional[float] = None
    longitude: Optional[float] = None


SYSTEM_PROMPT = """You are "SafeTrip Buddy", an AI travel companion for tourists in India.
You help with:
- Recommending attractions, food, hotels and activities
- Building day-by-day itineraries that respect user's days, budget in INR and interests
- Safety tips: areas/times to be careful about, scams, weather, transport
- Emergency guidance: 112 (Police/National Emergency), 108 (Ambulance), 1091 (Women Helpline)
Rules:
- Be friendly, practical, and use concise bullet points.
- Keep replies under 140 words unless the user requests a detailed itinerary.
- Prioritize tourist safety and verified guidance.
"""


def _generate_local_reply(
    message: str,
    latitude: Optional[float],
    longitude: Optional[float],
) -> str:
    """Intelligent rule-based Pan-India tourist travel assistant response."""
    msg = message.strip().lower()

    # 1. Emergency, danger, lost, SOS
    if any(k in msg for k in ["sos", "danger", "lost", "help", "emergency", "police", "hospital", "attack", "stolen", "hurt", "accident"]):
        loc_str = f"Your GPS position is ({latitude:.4f}, {longitude:.4f})." if latitude and longitude else "Turn on GPS for precise tracking."
        return (
            "🚨 **Emergency & Safety Priority**:\n"
            "• **Immediate Action**: Press the red **SOS Button** on the app home screen to broadcast your location to emergency contacts.\n"
            "• **Helpline 112**: Call **112** for immediate Pan-India Police & Emergency dispatch.\n"
            "• **Ambulance**: Dial **108** for medical emergencies.\n"
            "• **Women Helpline**: Dial **1091**.\n"
            f"• **Location**: {loc_str}\n"
            "• Move toward well-lit public areas, hotel receptions, or security booths."
        )

    # 2. Itinerary & Trip Planning
    if any(k in msg for k in ["itinerary", "plan", "days", "schedule", "trip to", "tour"]):
        city_hint = "Kochi / Kerala"
        if "delhi" in msg:
            city_hint = "Delhi"
        elif "agra" in msg or "taj" in msg:
            city_hint = "Agra"
        elif "jaipur" in msg or "rajasthan" in msg:
            city_hint = "Jaipur"
        elif "mumbai" in msg:
            city_hint = "Mumbai"
        elif "goa" in msg:
            city_hint = "Goa"
        elif "varanasi" in msg:
            city_hint = "Varanasi"

        if city_hint == "Delhi":
            return (
                "🗺️ **2-Day Delhi Safe Itinerary (Est. ₹2,500/day)**:\n"
                "• **Day 1**: India Gate & Kartavya Path (morning, free) → Humayun's Tomb (₹50) → Qutub Minar (₹50) → Evening food at Dilli Haat (₹500).\n"
                "• **Day 2**: Red Fort (₹50) → Chandni Chowk heritage walk → Lodhi Art District & Garden (peaceful evening walk).\n"
                "• **Safety Tip**: Use the Delhi Metro (Pink/Yellow line) for safe, air-conditioned transit. Avoid unlicensed touts near railway stations."
            )
        elif city_hint == "Agra":
            return (
                "🗺️ **1-Day Agra Heritage Itinerary (Est. ₹2,000)**:\n"
                "• **Sunrise**: Taj Mahal East Gate (book tickets online at asi.nic.in to skip queues, ₹50 Indian / ₹1100 Foreigner).\n"
                "• **Midday**: Agra Fort & Mehtab Bagh river view.\n"
                "• **Safety Tip**: Enter via verified security gates. Only use ASI-licensed tour guides carrying government ID badges."
            )
        elif city_hint == "Jaipur":
            return (
                "🗺️ **2-Day Jaipur Royal Heritage (Est. ₹3,000/day)**:\n"
                "• **Day 1**: Amber Fort (morning jeep ride) → Jal Mahal view → City Palace & Jantar Mantar (astronomy park).\n"
                "• **Day 2**: Hawa Mahal facade photo → Albert Hall Museum → Bapu Bazaar shopping (handicrafts & textiles).\n"
                "• **Safety Tip**: Agree on auto-rickshaw fares beforehand or use Ola/Uber for transparent metered rides."
            )
        elif city_hint == "Goa":
            return (
                "🗺️ **2-Day Goa Coastal & Heritage (Est. ₹3,500/day)**:\n"
                "• **Day 1**: Old Goa Churches (Basilica of Bom Jesus) → Fontainhas Latin Quarter walk → Sunset at Miramar Beach.\n"
                "• **Day 2**: Palolem / Agonda South Goa beaches (calm waters) → Cabo de Rama Fort.\n"
                "• **Safety Tip**: Follow beach lifeguard red-flag advisories strictly; do not swim after dusk or during high tide warnings."
            )
        else:
            return (
                "🗺️ **2-Day Fort Kochi & Kerala Itinerary (Est. ₹2,200/day)**:\n"
                "• **Day 1**: Historic Fort Kochi promenade → Chinese Fishing Nets → St. Francis Church → Kathakali Dance Center (₹400, 5 PM).\n"
                "• **Day 2**: Mattancherry Palace & Jew Town spice bazaar → Marine Drive Kochi Water Metro cruise (₹20).\n"
                "• **Safety Tip**: The heritage zone has active Tourist Police booths every 300m. Keep hydrated during afternoon humidity."
            )

    # 3. Scams & Precautions
    if any(k in msg for k in ["scam", "safe", "danger", "crime", "precaution", "caution", "theft", "night"]):
        return (
            "🛡️ **Pan-India Tourist Safety & Scam Prevention**:\n"
            "• **Transit**: Use app-based cabs (Uber/Ola) or prepaid police-managed taxi booths at airports/railways.\n"
            "• **Shopping**: In tourist markets (Paharganj, Johari Bazaar, Jew Town), standard fair prices are usually 40-50% of the initial quote.\n"
            "• **SIM & Connectivity**: Get an eSIM or official Vi/Airtel/Jio SIM at airport counters with passport verification.\n"
            "• **Night Safety**: Major city centers and tourist corridors are well-lit and safe till 10 PM. For late-night transit, travel with company or hotel-arranged transport."
        )

    # 4. Food & Water Hygiene
    if any(k in msg for k in ["food", "eat", "water", "restaurant", "drink", "dish"]):
        return (
            "🍲 **Food & Hygiene Recommendations**:\n"
            "• **Drinking Water**: Stick to sealed packaged mineral water (Bisleri, Kinley, Aquafina) or verified RO-filtered water.\n"
            "• **Street Food**: Eat freshly cooked, piping hot items from bustling stalls with high local patronage (e.g. fresh dosas, samosas, momos).\n"
            "• **Must-Try**: Masala Dosa, Malabar Biryani, Butter Chicken, Dal Makhani, Filter Coffee, and Fresh Coconut Water."
        )

    # 5. Tourist ID & Blockchain verification
    if any(k in msg for k in ["blockchain", "identity", "id", "did", "tamper", "card", "permit"]):
        return (
            "⛓️ **Digital Tourist Identity & Blockchain Hub**:\n"
            "• Your profile is anchored with a W3C Decentralized Identifier (**DID**) on the consortium ledger.\n"
            "• Local credentials are verified against the on-chain SHA-256 fingerprint in real-time.\n"
            "• Tap the **Tourist ID** tab to view your holographic card, test the tamper simulator, or anchor emergency permits."
        )

    # 6. Default greeting / general query
    loc_mention = f" I see you're currently near GPS ({latitude:.2f}, {longitude:.2f})." if latitude and longitude else ""
    return (
        f"Hello! I'm **SafeTrip Buddy**, your AI travel companion for India.{loc_mention}\n\n"
        "Here's what I can help you with:\n"
        "• 📍 **Itineraries**: Ask for custom day-by-day travel plans for any Indian city.\n"
        "• 🛡️ **Safety & Precautions**: Get real-time advice on night transit, safe zones, and scam warnings.\n"
        "• 🚨 **Emergency Aid**: Instant access to police (112), medical (108), and tourist assistance.\n"
        "• 🍲 **Food & Culture**: Safe street food picks, cultural etiquette, and top landmarks."
    )


@router.get("/history/{client_id}/{chat_id}")
def get_history(client_id: str, chat_id: str):
    messages = _load_messages(client_id, chat_id)
    return {"messages": messages}


@router.get("/chats/{client_id}")
def list_chats(client_id: str):
    conn = _get_db()
    rows = conn.execute(
        """
        SELECT m.chat_id,
               MAX(m.id) AS last_id,
               (SELECT content FROM chat_messages m2
                 WHERE m2.client_id = m.client_id AND m2.chat_id = m.chat_id
                   AND m2.role = 'user' ORDER BY m2.id LIMIT 1) AS title
        FROM chat_messages m
        WHERE m.client_id = ?
        GROUP BY m.chat_id
        ORDER BY last_id DESC
        """,
        (client_id,),
    ).fetchall()
    chats = []
    for chat_id, _, title in rows:
        title = (title or "New Chat").strip().replace("\n", " ")
        chats.append({"chat_id": chat_id, "title": title[:40]})
    return chats


@router.delete("/chats/{client_id}/{chat_id}")
def delete_chat(client_id: str, chat_id: str):
    conn = _get_db()
    conn.execute(
        "DELETE FROM chat_messages WHERE client_id = ? AND chat_id = ?",
        (client_id, chat_id),
    )
    conn.commit()
    return {"ok": True}


@router.post("/chat")
def chat(req: ChatRequest):
    if not req.message.strip():
        raise HTTPException(status_code=400, detail="Message cannot be empty")

    reply = None
    api_key = os.getenv("GEMINI_API_KEY")

    # If GEMINI_API_KEY is present, attempt Gemini model generation
    if api_key:
        try:
            from google import genai
            from google.genai import types

            client = genai.Client(api_key=api_key)
            model_name = os.getenv("GEMINI_MODEL", "gemini-2.5-flash")

            history_msgs = _load_messages(req.client_id, req.chat_id)
            contents = []
            for h in history_msgs:
                role = "user" if h["role"] == "user" else "model"
                contents.append(types.Content(role=role, parts=[types.Part(text=h["content"])]))

            prompt_text = req.message
            if req.latitude is not None and req.longitude is not None:
                prompt_text += f"\n\n[User's current GPS location: {req.latitude}, {req.longitude}]"
            contents.append(types.Content(role="user", parts=[types.Part(text=prompt_text)]))

            config = types.GenerateContentConfig(
                system_instruction=SYSTEM_PROMPT,
                temperature=0.7,
                max_output_tokens=1500,
            )
            response = client.models.generate_content(
                model=model_name,
                contents=contents,
                config=config,
            )
            if response and response.text:
                reply = response.text.strip()
        except Exception as exc:
            logger.warning("Gemini generation failed: %s, falling back to local expert engine", exc)

    # Fallback to intelligent local expert assistant
    if not reply:
        reply = _generate_local_reply(req.message, req.latitude, req.longitude)

    # Save messages to database
    _save_message(req.client_id, req.chat_id, "user", req.message)
    _save_message(req.client_id, req.chat_id, "assistant", reply)

    return PlainTextResponse(reply)
