from __future__ import annotations

import base64
import binascii
import hashlib
import hmac
import json
import secrets
import time
import uuid
from typing import Any

from fastapi import Header, HTTPException

from backend.app.config import settings


LOCAL_DEV_VISITOR_ID = "local-dev"
PASSWORD_HASH_ALGORITHM = "pbkdf2_sha256"
PASSWORD_HASH_ITERATIONS = 260_000
OAUTH_STATE_TTL_SECONDS = 10 * 60


def auth_required() -> bool:
    return auth_mode() != "none"


def auth_mode() -> str:
    if settings.require_user_accounts:
        return "account"
    if settings.access_password:
        return "beta"
    return "none"


def create_access_token(visitor_id: str | None = None, email: str | None = None) -> str:
    now = int(time.time())
    payload = {
        "visitor_id": visitor_id or str(uuid.uuid4()),
        "issued_at": now,
        "expires_at": now + settings.auth_token_ttl_days * 24 * 60 * 60,
    }
    if email:
        payload["email"] = email
    body = _base64url_encode(
        json.dumps(payload, separators=(",", ":"), sort_keys=True).encode("utf-8")
    )
    signature = _signature(body)
    return f"{body}.{signature}"


def create_oauth_state() -> str:
    now = int(time.time())
    body = _base64url_encode(
        json.dumps(
            {
                "nonce": secrets.token_urlsafe(18),
                "issued_at": now,
                "expires_at": now + OAUTH_STATE_TTL_SECONDS,
            },
            separators=(",", ":"),
            sort_keys=True,
        ).encode("utf-8")
    )
    return f"{body}.{_signature(body)}"


def verify_oauth_state(state: str) -> None:
    try:
        body, signature = state.split(".", 1)
    except ValueError as exc:
        raise HTTPException(status_code=401, detail="Invalid Google sign-in state.") from exc

    if not secrets.compare_digest(signature, _signature(body)):
        raise HTTPException(status_code=401, detail="Invalid Google sign-in state.")

    try:
        payload = json.loads(_base64url_decode(body).decode("utf-8"))
    except (ValueError, UnicodeDecodeError) as exc:
        raise HTTPException(status_code=401, detail="Invalid Google sign-in state.") from exc

    if int(payload.get("expires_at", 0)) < int(time.time()):
        raise HTTPException(status_code=401, detail="Google sign-in state expired.")


def require_access(authorization: str | None = Header(default=None)) -> str:
    if not auth_required():
        return LOCAL_DEV_VISITOR_ID

    if not authorization or not authorization.startswith("Bearer "):
        raise HTTPException(status_code=401, detail="Access password is required.")

    token = authorization.removeprefix("Bearer ").strip()
    payload = verify_access_token(token)
    if auth_mode() == "account" and not payload.get("email"):
        raise HTTPException(status_code=401, detail="Account login is required.")
    return str(payload["visitor_id"])


def verify_access_password(password: str) -> None:
    if auth_mode() != "beta":
        return
    if not secrets.compare_digest(password, settings.access_password):
        raise HTTPException(status_code=401, detail="Invalid access password.")


def verify_access_token(token: str) -> dict[str, Any]:
    try:
        body, signature = token.split(".", 1)
    except ValueError as exc:
        raise HTTPException(status_code=401, detail="Invalid access token.") from exc

    expected_signature = _signature(body)
    if not secrets.compare_digest(signature, expected_signature):
        raise HTTPException(status_code=401, detail="Invalid access token.")

    try:
        payload = json.loads(_base64url_decode(body).decode("utf-8"))
    except (ValueError, UnicodeDecodeError) as exc:
        raise HTTPException(status_code=401, detail="Invalid access token.") from exc

    expires_at = int(payload.get("expires_at", 0))
    visitor_id = payload.get("visitor_id")
    if not visitor_id or expires_at < int(time.time()):
        raise HTTPException(status_code=401, detail="Access token expired.")
    return payload


def normalize_email(email: str) -> str:
    return email.strip().lower()


def hash_password(password: str) -> str:
    salt = secrets.token_bytes(16)
    digest = hashlib.pbkdf2_hmac(
        "sha256",
        password.encode("utf-8"),
        salt,
        PASSWORD_HASH_ITERATIONS,
    )
    return (
        f"{PASSWORD_HASH_ALGORITHM}${PASSWORD_HASH_ITERATIONS}$"
        f"{binascii.hexlify(salt).decode('ascii')}$"
        f"{binascii.hexlify(digest).decode('ascii')}"
    )


def verify_password(password: str, password_hash: str) -> bool:
    try:
        algorithm, iterations_text, salt_hex, digest_hex = password_hash.split("$", 3)
        iterations = int(iterations_text)
        salt = binascii.unhexlify(salt_hex.encode("ascii"))
        expected = binascii.unhexlify(digest_hex.encode("ascii"))
    except (ValueError, binascii.Error):
        return False
    if algorithm != PASSWORD_HASH_ALGORITHM:
        return False
    actual = hashlib.pbkdf2_hmac(
        "sha256",
        password.encode("utf-8"),
        salt,
        iterations,
    )
    return secrets.compare_digest(actual, expected)


def _signature(body: str) -> str:
    secret = settings.auth_token_secret or settings.access_password or "local-development-secret"
    digest = hmac.new(secret.encode("utf-8"), body.encode("utf-8"), hashlib.sha256).digest()
    return _base64url_encode(digest)


def _base64url_encode(value: bytes) -> str:
    return base64.urlsafe_b64encode(value).decode("ascii").rstrip("=")


def _base64url_decode(value: str) -> bytes:
    padded = value + "=" * (-len(value) % 4)
    return base64.urlsafe_b64decode(padded.encode("ascii"))
