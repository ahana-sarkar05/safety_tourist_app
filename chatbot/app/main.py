import os
import sqlite3
import time
from typing import Optional

from dotenv import load_dotenv
from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import StreamingResponse
from fastapi.staticfiles import StaticFiles
from google import genai
from google.genai import types
from pydantic import BaseModel

from app.prompts import SYSTEM_PROMPT

load_dotenv()

API_KEY = os.getenv("GEMINI_API_KEY")
MODEL = os.getenv("GEMINI_MODEL", "gemini-3.8-flash")
FAST_MODE = os.getenv("FAST_MODE", "true").lower() == "true"

if not API_KEY:
    raise RuntimeError("GEMINI_API_KEY is missing. Add it to your .env file.")

client = genai.Client(api_key=API_KEY)
app = FastAPI(title="SafeTrip Buddy Chatbot")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)

# ---------------- Database (saved in chatbot/chat_history.db) ----------------
DB_PATH = os.path.join(
    os.path.dirname(os.path.dirname(os.path.abspath(__file__))), "chat_history.db"
)


def init_db():
    conn = sqlite3.connect(DB_PATH)
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
    conn.close()


def save_message(client_id: str, chat_id: str, role: str, content: str):
    conn = sqlite3.connect(DB_PATH)
    conn.execute(
        "INSERT INTO chat_messages (client_id, chat_id, role, content) VALUES (?, ?, ?, ?)",
        (client_id, chat_id, role, content),
    )
    conn.commit()
    conn.close()


def load_messages(client_id: str, chat_id: str):
    conn = sqlite3.connect(DB_PATH)
    rows = conn.execute(
        "SELECT role, content FROM chat_messages "
        "WHERE client_id = ? AND chat_id = ? ORDER BY id",
        (client_id, chat_id),
    ).fetchall()
    conn.close()
    return [{"role": r[0], "content": r[1]} for r in rows]


def list_chats(client_id: str):
    conn = sqlite3.connect(DB_PATH)
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
    conn.close()
    chats = []
    for chat_id, _, title in rows:
        title = (title or "New chat").strip().replace("\n", " ")
        chats.append({"chat_id": chat_id, "title": title[:40]})
    return chats


def delete_chat(client_id: str, chat_id: str):
    conn = sqlite3.connect(DB_PATH)
    conn.execute(
        "DELETE FROM chat_messages WHERE client_id = ? AND chat_id = ?",
        (client_id, chat_id),
    )
    conn.commit()
    conn.close()


init_db()

# ---------------- Chat sessions ----------------
sessions = {}
fast_enabled = FAST_MODE


class ChatRequest(BaseModel):
    client_id: str
    chat_id: str
    message: str
    latitude: Optional[float] = None
    longitude: Optional[float] = None


def make_config():
    settings = dict(
        system_instruction=SYSTEM_PROMPT,
        temperature=0.7,
        max_output_tokens=1500,
    )
    if fast_enabled:
        settings["thinking_config"] = types.ThinkingConfig(thinking_budget=0)
    return types.GenerateContentConfig(**settings)


def get_chat(client_id: str, chat_id: str):
    key = f"{client_id}:{chat_id}"
    if key not in sessions:
        # Rebuild the AI's memory from saved messages
        history = [
            types.Content(role=m["role"], parts=[types.Part(text=m["content"])])
            for m in load_messages(client_id, chat_id)
        ]
        sessions[key] = client.chats.create(
            model=MODEL,
            config=make_config(),
            history=history,
        )
    return sessions[key]


@app.post("/api/chat")
def chat(req: ChatRequest):
    if not req.message.strip():
        raise HTTPException(status_code=400, detail="Message cannot be empty")

    text = req.message
    if req.latitude is not None and req.longitude is not None:
        text += f"\n\n[User's current GPS location: {req.latitude}, {req.longitude}]"

    def generate():
        global fast_enabled
        full = ""
        last_error = None

        for attempt in range(3):
            try:
                for chunk in get_chat(req.client_id, req.chat_id).send_message_stream(text):
                    if chunk.text:
                        full += chunk.text
                        yield chunk.text
                if full:
                    save_message(req.client_id, req.chat_id, "user", req.message)
                    save_message(req.client_id, req.chat_id, "model", full)
                return
            except Exception as e:
                print(f"[Gemini error, attempt {attempt + 1}] {e}")
                if full:
                    return
                last_error = e
                msg = str(e).lower()

                if fast_enabled and "thinking" in msg:
                    fast_enabled = False
                    sessions.clear()
                    continue

                if "503" in msg or "429" in msg:
                    time.sleep(1.5 * (attempt + 1))
                    continue
                break

        yield f"Error: AI error: {last_error}"

    return StreamingResponse(generate(), media_type="text/plain")


@app.get("/api/chats/{client_id}")
def get_chats(client_id: str):
    return {"chats": list_chats(client_id)}


@app.get("/api/history/{client_id}/{chat_id}")
def history(client_id: str, chat_id: str):
    return {"messages": load_messages(client_id, chat_id)}


@app.delete("/api/chats/{client_id}/{chat_id}")
def remove_chat(client_id: str, chat_id: str):
    sessions.pop(f"{client_id}:{chat_id}", None)
    delete_chat(client_id, chat_id)
    return {"status": "deleted"}


@app.get("/api/health")
def health():
    return {"status": "ok"}


# Serve the chat page at "/" (keep this LAST)
app.mount("/", StaticFiles(directory="static", html=True), name="static")