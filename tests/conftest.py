from __future__ import annotations

import sys
from collections.abc import Iterator

import pytest
from fastapi.testclient import TestClient


@pytest.fixture()
def test_client(tmp_path, monkeypatch) -> Iterator[TestClient]:
    db_path = tmp_path / "study_assistant_test.db"

    monkeypatch.setenv("APP_ENV", "test")
    monkeypatch.setenv("DATABASE_PATH", str(db_path))
    monkeypatch.setenv("DATABASE_URL", "")
    monkeypatch.setenv("REQUIRE_USER_ACCOUNTS", "true")
    monkeypatch.setenv("ACCESS_PASSWORD", "")
    monkeypatch.setenv("AUTH_TOKEN_SECRET", "test-secret-with-enough-length-123456")
    monkeypatch.setenv("MOCK_AI", "true")
    monkeypatch.setenv("OPENAI_API_KEY", "test-key")
    monkeypatch.setenv("OPENAI_MODEL", "test-model")
    monkeypatch.setenv("PER_USER_DAILY_AI_LIMIT", "20")
    monkeypatch.setenv("GLOBAL_DAILY_AI_LIMIT", "100")
    monkeypatch.setenv("GOOGLE_CLIENT_ID", "")
    monkeypatch.setenv("GOOGLE_CLIENT_SECRET", "")
    monkeypatch.setenv("GOOGLE_REDIRECT_URI", "")

    for module_name in list(sys.modules):
        if module_name.startswith("backend.app."):
            sys.modules.pop(module_name, None)

    from backend.app.main import app

    with TestClient(app) as client:
        yield client
