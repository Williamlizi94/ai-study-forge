from __future__ import annotations

from fastapi.testclient import TestClient


SAMPLE_SOURCE_TEXT = (
    "Lecture 12 multiclass classification notes. "
    "This material explains classifiers, nearest neighbors, training examples, "
    "decision boundaries, and review questions for exam preparation."
)


def auth_headers(token: str) -> dict[str, str]:
    return {"Authorization": f"Bearer {token}"}


def register_user(
    client: TestClient,
    email: str,
    password: str = "password123",
) -> tuple[str, dict]:
    response = client.post(
        "/api/auth/register",
        json={"email": email, "password": password},
    )
    assert response.status_code == 200, response.text
    payload = response.json()
    return payload["token"], payload["user"]


def create_study_session(
    client: TestClient,
    token: str,
    title: str,
    source_text: str = SAMPLE_SOURCE_TEXT,
) -> dict:
    response = client.post(
        "/api/study/sessions",
        json={"title": title, "source_text": source_text},
        headers=auth_headers(token),
    )
    assert response.status_code == 200, response.text
    return response.json()
