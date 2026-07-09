from __future__ import annotations

from tests.helpers import SAMPLE_SOURCE_TEXT, auth_headers, create_study_session, register_user


def test_auth_status_requires_accounts_and_protects_session_routes(test_client):
    response = test_client.get("/api/auth/status")
    assert response.status_code == 200
    payload = response.json()
    assert payload["auth_required"] is True
    assert payload["auth_mode"] == "account"
    assert payload["google_auth_enabled"] is False

    response = test_client.get("/api/study/sessions")
    assert response.status_code == 401


def test_document_parse_accepts_text_upload(test_client):
    token, _user = register_user(test_client, "parser@example.com")
    response = test_client.post(
        "/api/study/documents/parse",
        files={
            "file": (
                "lecture-notes.txt",
                SAMPLE_SOURCE_TEXT.encode("utf-8"),
                "text/plain",
            )
        },
        headers=auth_headers(token),
    )
    assert response.status_code == 200, response.text
    payload = response.json()
    assert payload["title"] == "lecture notes"
    assert payload["source_text"] == SAMPLE_SOURCE_TEXT
    assert payload["character_count"] == len(SAMPLE_SOURCE_TEXT)


def test_sessions_are_isolated_by_account(test_client):
    token_a, user_a = register_user(test_client, "student-a@example.com")
    token_b, user_b = register_user(test_client, "student-b@example.com")
    assert user_a["id"] != user_b["id"]

    session_a = create_study_session(test_client, token_a, "Student A Notes")
    session_b = create_study_session(test_client, token_b, "Student B Notes")

    list_a = test_client.get("/api/study/sessions", headers=auth_headers(token_a))
    list_b = test_client.get("/api/study/sessions", headers=auth_headers(token_b))
    assert list_a.status_code == 200
    assert list_b.status_code == 200
    assert [item["id"] for item in list_a.json()] == [session_a["id"]]
    assert [item["id"] for item in list_b.json()] == [session_b["id"]]

    response = test_client.get(
        f"/api/study/sessions/{session_b['id']}",
        headers=auth_headers(token_a),
    )
    assert response.status_code == 404

    response = test_client.delete(
        f"/api/study/sessions/{session_b['id']}",
        headers=auth_headers(token_a),
    )
    assert response.status_code == 404

    response = test_client.delete("/api/study/sessions", headers=auth_headers(token_a))
    assert response.status_code == 200
    assert response.json()["deleted"] == 1

    list_a = test_client.get("/api/study/sessions", headers=auth_headers(token_a)).json()
    list_b = test_client.get("/api/study/sessions", headers=auth_headers(token_b)).json()
    assert list_a == []
    assert [item["id"] for item in list_b] == [session_b["id"]]


def test_favorites_are_owner_scoped(test_client):
    token_a, _ = register_user(test_client, "favorite-a@example.com")
    token_b, _ = register_user(test_client, "favorite-b@example.com")
    session_a = create_study_session(test_client, token_a, "Favorite Candidate")
    session_b = create_study_session(test_client, token_b, "Other User Notes")

    response = test_client.post(
        f"/api/study/sessions/{session_a['id']}/favorite",
        json={"is_favorite": True},
        headers=auth_headers(token_a),
    )
    assert response.status_code == 200, response.text
    assert response.json()["is_favorite"] is True

    response = test_client.post(
        f"/api/study/sessions/{session_a['id']}/favorite",
        json={"is_favorite": False},
        headers=auth_headers(token_b),
    )
    assert response.status_code == 404

    list_a = test_client.get("/api/study/sessions", headers=auth_headers(token_a)).json()
    list_b = test_client.get("/api/study/sessions", headers=auth_headers(token_b)).json()
    assert list_a[0]["id"] == session_a["id"]
    assert list_a[0]["is_favorite"] is True
    assert list_b[0]["id"] == session_b["id"]
    assert list_b[0]["is_favorite"] is False


def test_mock_generation_and_mistake_flow(test_client):
    token, _ = register_user(test_client, "study-flow@example.com")
    session = create_study_session(test_client, token, "Exam Review Source")
    headers = auth_headers(token)
    session_id = session["id"]

    summary = test_client.post(f"/api/study/sessions/{session_id}/summary", headers=headers)
    assert summary.status_code == 200, summary.text
    assert "Mock Summary" in summary.json()["session"]["summary"]

    cheat_sheet = test_client.post(
        f"/api/study/sessions/{session_id}/cheat-sheet",
        headers=headers,
    )
    assert cheat_sheet.status_code == 200, cheat_sheet.text
    assert "Mock Cheat Sheet" in cheat_sheet.json()["session"]["cheat_sheet"]

    flashcards = test_client.post(
        f"/api/study/sessions/{session_id}/flashcards",
        headers=headers,
    )
    assert flashcards.status_code == 200, flashcards.text
    assert len(flashcards.json()["session"]["flashcards"]) >= 1

    quiz = test_client.post(f"/api/study/sessions/{session_id}/quiz", headers=headers)
    assert quiz.status_code == 200, quiz.text
    questions = quiz.json()["session"]["quiz"]
    assert len(questions) >= 1
    first_question = questions[0]
    assert first_question["answer"] in first_question["choices"]

    wrong_answer = next(
        choice for choice in first_question["choices"] if choice != first_question["answer"]
    )
    mistakes = test_client.post(
        f"/api/study/sessions/{session_id}/quiz/mistakes",
        json={"answers": [{"question_index": 0, "selected_answer": wrong_answer}]},
        headers=headers,
    )
    assert mistakes.status_code == 200, mistakes.text
    review = mistakes.json()["review"]
    assert review["total"] == len(questions)
    assert review["correct"] == 0
    assert len(review["incorrect"]) == 1
    assert review["incorrect"][0]["selected_answer"] == wrong_answer
    assert review["incorrect"][0]["correct_answer"] == first_question["answer"]
    assert mistakes.json()["session"]["quiz_review"]

    chat = test_client.post(
        f"/api/study/sessions/{session_id}/chat",
        json={"question": "What should I review first?"},
        headers=headers,
    )
    assert chat.status_code == 200, chat.text
    assert chat.json()["answer"]
    assert len(chat.json()["session"]["chat_messages"]) == 2
