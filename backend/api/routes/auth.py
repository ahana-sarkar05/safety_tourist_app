"""
api/routes/auth.py — POST /api/auth/signup, /api/auth/login, /api/auth/logout, GET /api/auth/me

Users are stored in the SQLite database (users + sessions tables).
Passwords are hashed with bcrypt. Sessions use a random secure token (32 bytes hex).
"""
from __future__ import annotations

import hashlib
import logging
import os
import secrets
from datetime import datetime, timedelta, timezone

import bcrypt
from fastapi import APIRouter, Header, HTTPException
from pydantic import BaseModel, Field

from api.db import get_db

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api/auth")

# Session lasts 30 days by default
SESSION_DAYS = int(os.getenv("SESSION_DAYS", "30"))


# ── Schemas ───────────────────────────────────────────────────────────────────

class SignupRequest(BaseModel):
    fullName:    str = Field(min_length=2, max_length=100)
    nationality: str = Field(default="", max_length=60)
    email:       str = Field(min_length=5, max_length=200)
    password:    str = Field(min_length=8, max_length=128)


class LoginRequest(BaseModel):
    email:    str
    password: str


# ── Helpers ───────────────────────────────────────────────────────────────────

def _hash_password(plain: str) -> str:
    return bcrypt.hashpw(plain.encode(), bcrypt.gensalt(rounds=12)).decode()


def _check_password(plain: str, hashed: str) -> bool:
    try:
        return bcrypt.checkpw(plain.encode(), hashed.encode())
    except Exception:
        return False


def _make_tourist_id(email: str) -> str:
    """Deterministic Tourist-ID derived from email SHA-256."""
    digest = hashlib.sha256(email.strip().lower().encode("utf-8")).hexdigest()
    h = int(digest[:6], 16)
    return f"TOURIST-2026-{h:06X}"


def _create_session(user_id: int) -> str:
    """Insert a session row and return the token."""
    db = get_db()
    token = secrets.token_hex(32)
    expires = (datetime.now(timezone.utc) + timedelta(days=SESSION_DAYS)).isoformat()
    db.execute(
        "INSERT INTO sessions (token, user_id, expires_at) VALUES (?,?,?)",
        (token, user_id, expires),
    )
    db.commit()
    return token


def _get_user_from_token(token: str) -> dict | None:
    """Return the user row if the token is valid and not expired, else None."""
    db = get_db()
    now = datetime.now(timezone.utc).isoformat()
    row = db.execute(
        """SELECT u.id, u.tourist_id, u.email, u.full_name, u.nationality,
                  u.phone, u.status, u.created_at
           FROM sessions s
           JOIN users u ON u.id = s.user_id
           WHERE s.token = ? AND s.expires_at > ?""",
        (token, now),
    ).fetchone()
    return dict(row) if row else None


def _profile_dict(user: dict) -> dict:
    return {
        "touristId":    user["tourist_id"],
        "fullName":     user["full_name"],
        "nationality":  user["nationality"],
        "phone":        user["phone"],
        "registeredAt": user["created_at"],
        "status":       user["status"],
    }


def _extract_token(authorization: str | None) -> str:
    if not authorization or not authorization.startswith("Bearer "):
        raise HTTPException(401, "Missing or invalid Authorization header")
    return authorization.removeprefix("Bearer ").strip()


# ── Routes ────────────────────────────────────────────────────────────────────

@router.post("/signup", status_code=201)
def signup(body: SignupRequest):
    db = get_db()

    # Check duplicate email
    existing = db.execute(
        "SELECT id FROM users WHERE email = ?", (body.email.strip().lower(),)
    ).fetchone()
    if existing:
        raise HTTPException(409, "An account with this email already exists.")

    tourist_id   = _make_tourist_id(body.email)
    password_hash = _hash_password(body.password)

    try:
        cursor = db.execute(
            """INSERT INTO users (tourist_id, email, password_hash, full_name, nationality)
               VALUES (?,?,?,?,?)""",
            (
                tourist_id,
                body.email.strip().lower(),
                password_hash,
                body.fullName.strip(),
                body.nationality.strip(),
            ),
        )
        db.commit()
        user_id = cursor.lastrowid
    except Exception as exc:
        logger.error("Signup DB error: %s", exc)
        raise HTTPException(500, "Could not create account. Please try again.")

    token = _create_session(user_id)

    # Fetch back for profile
    user = db.execute(
        "SELECT id, tourist_id, email, full_name, nationality, phone, status, created_at FROM users WHERE id=?",
        (user_id,),
    ).fetchone()

    logger.info("New user signed up: %s (%s)", body.email, tourist_id)
    return {
        "token":   token,
        "email":   body.email.strip().lower(),
        "profile": _profile_dict(dict(user)),
    }


@router.post("/login")
def login(body: LoginRequest):
    db = get_db()

    user = db.execute(
        """SELECT id, tourist_id, email, password_hash, full_name,
                  nationality, phone, status, created_at
           FROM users WHERE email = ?""",
        (body.email.strip().lower(),),
    ).fetchone()

    if not user or not _check_password(body.password, user["password_hash"]):
        raise HTTPException(401, "Incorrect email or password.")

    token = _create_session(user["id"])

    logger.info("User logged in: %s", body.email)
    return {
        "token":   token,
        "email":   user["email"],
        "profile": _profile_dict(dict(user)),
    }


@router.post("/logout")
def logout(authorization: str | None = Header(None)):
    token = _extract_token(authorization)
    db = get_db()
    db.execute("DELETE FROM sessions WHERE token = ?", (token,))
    db.commit()
    return {"status": "ok"}


@router.get("/me")
def me(authorization: str | None = Header(None)):
    token = _extract_token(authorization)
    user = _get_user_from_token(token)
    if not user:
        raise HTTPException(401, "Session expired or invalid. Please log in again.")
    return {"profile": _profile_dict(user)}
