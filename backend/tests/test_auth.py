"""
backend/tests/test_auth.py — Unit tests for Trevora auth logic (signup, login, logout, me).
"""
import uuid
import pytest
from fastapi import HTTPException
from api.routes import auth


def test_signup_and_login_flow():
    unique_email = f"user_{uuid.uuid4().hex[:6]}@trevora.app"
    req = auth.SignupRequest(
        fullName="Trevora Traveler",
        nationality="Indian",
        email=unique_email,
        password="Password123"
    )
    res = auth.signup(req)
    assert "token" in res
    assert res["profile"]["fullName"] == "Trevora Traveler"
    assert res["profile"]["touristId"].startswith("TOURIST-2026-")

    # Login with the newly created credentials
    login_req = auth.LoginRequest(email=unique_email, password="Password123")
    login_res = auth.login(login_req)
    assert "token" in login_res
    assert login_res["email"] == unique_email


def test_login_invalid_password():
    req = auth.LoginRequest(email="nonexistent.user@trevora.app", password="WrongPassword999")
    with pytest.raises(HTTPException) as exc:
        auth.login(req)
    assert exc.value.status_code == 401


def test_signup_duplicate_check():
    unique_email = f"user_{uuid.uuid4().hex[:6]}@trevora.app"
    req = auth.SignupRequest(
        fullName="Trevora Traveler",
        nationality="Indian",
        email=unique_email,
        password="Password123"
    )
    auth.signup(req)

    # Duplicate signup should raise 409
    with pytest.raises(HTTPException) as exc:
        auth.signup(req)
    assert exc.value.status_code == 409


def test_me_endpoint_with_valid_token():
    unique_email = f"user_{uuid.uuid4().hex[:6]}@trevora.app"
    req = auth.SignupRequest(
        fullName="Token Tester",
        nationality="Indian",
        email=unique_email,
        password="Password123"
    )
    signup_res = auth.signup(req)
    token = signup_res["token"]

    me_res = auth.me(authorization=f"Bearer {token}")
    assert "profile" in me_res
    assert me_res["profile"]["fullName"] == "Token Tester"


def test_me_endpoint_invalid_token():
    with pytest.raises(HTTPException) as exc:
        auth.me(authorization="Bearer invalid_token_xyz")
    assert exc.value.status_code == 401
