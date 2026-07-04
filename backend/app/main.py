from __future__ import annotations

import json
import secrets
import urllib.parse
import urllib.request
from pathlib import Path
from typing import Any

from fastapi import Depends, FastAPI, File, Form, HTTPException, Request, UploadFile
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse, RedirectResponse
from fastapi.staticfiles import StaticFiles
from openai import APIConnectionError, AuthenticationError, BadRequestError, NotFoundError
from openai import PermissionDeniedError, RateLimitError

from backend.app.ai_service import AIConfigurationError, ai_service
from backend.app.auth import (
    auth_mode,
    auth_required,
    create_access_token,
    create_oauth_state,
    hash_password,
    normalize_email,
    require_access,
    verify_oauth_state,
    verify_access_password,
    verify_password,
)
from backend.app.config import BASE_DIR, settings
from backend.app.database import (
    append_chat_messages,
    create_feedback,
    create_session,
    create_user,
    delete_all_sessions,
    delete_session,
    DuplicateUserError,
    get_session,
    get_or_create_google_user,
    get_user_by_email,
    record_ai_usage,
    init_db,
    list_sessions,
    update_cheat_sheet,
    update_diagnostic,
    update_diagnostic_review,
    update_flashcards,
    update_quiz,
    update_quiz_review,
    update_summary,
    update_targeted_practice,
    update_targeted_practice_review,
    UsageLimitError,
)
from backend.app.document_parser import DocumentParseError, extract_text_from_document
from backend.app.schemas import (
    AuthLoginRequest,
    AuthLoginResponse,
    AuthRegisterRequest,
    AuthStatus,
    AuthUser,
    CheatSheetResponse,
    ChatRequest,
    ChatResponse,
    DiagnosticResponse,
    DiagnosticReviewIssue,
    DiagnosticReviewRequest,
    DiagnosticReviewResponse,
    DiagnosticReviewResult,
    FeedbackRequest,
    FeedbackResponse,
    FlashcardsResponse,
    ParsedDocumentResponse,
    QuizResponse,
    QuizReviewIssue,
    QuizReviewRequest,
    QuizReviewResponse,
    QuizReviewResult,
    StudySession,
    StudySessionCreate,
    StudySessionListItem,
    SummaryResponse,
    TargetedPracticeResponse,
    TargetedPracticeReviewIssue,
    TargetedPracticeReviewRequest,
    TargetedPracticeReviewResponse,
    TargetedPracticeReviewResult,
)


app = FastAPI(title="AI Study Assistant", version="0.1.0")
GOOGLE_OAUTH_STATE_COOKIE = "ai_study_google_oauth_state"

app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

FRONTEND_DIR = BASE_DIR / "frontend"
FRONTEND_DIST_DIR = FRONTEND_DIR / "dist"
FRONTEND_ASSETS_DIR = FRONTEND_DIST_DIR / "assets"
if FRONTEND_ASSETS_DIR.exists():
    app.mount("/assets", StaticFiles(directory=FRONTEND_ASSETS_DIR), name="assets")


@app.on_event("startup")
def on_startup() -> None:
    init_db()


@app.get("/")
def index() -> FileResponse:
    index_path = FRONTEND_DIST_DIR / "index.html"
    if not index_path.exists():
        raise HTTPException(status_code=404, detail="Frontend build is not available")
    return FileResponse(index_path)


@app.get("/api/health")
def health() -> dict[str, str]:
    return {"status": "ok"}


@app.get("/api/auth/status", response_model=AuthStatus)
def api_auth_status() -> AuthStatus:
    return AuthStatus(
        auth_required=auth_required(),
        auth_mode=auth_mode(),
        google_auth_enabled=settings.google_oauth_enabled,
        per_user_daily_ai_limit=settings.per_user_daily_ai_limit,
        global_daily_ai_limit=settings.global_daily_ai_limit,
    )


@app.post("/api/auth/login", response_model=AuthLoginResponse)
def api_auth_login(payload: AuthLoginRequest) -> AuthLoginResponse:
    if auth_mode() == "account":
        email = normalize_email(payload.email or "")
        if not email:
            raise HTTPException(status_code=422, detail="Email is required.")
        user = get_user_by_email(email)
        if user is None or not verify_password(payload.password, user["password_hash"]):
            raise HTTPException(status_code=401, detail="Invalid email or password.")
        return _auth_response_for_user(user)

    verify_access_password(payload.password)
    return AuthLoginResponse(token=create_access_token())


@app.post("/api/auth/register", response_model=AuthLoginResponse)
def api_auth_register(payload: AuthRegisterRequest) -> AuthLoginResponse:
    if auth_mode() != "account":
        raise HTTPException(status_code=404, detail="User accounts are not enabled.")

    email = normalize_email(payload.email)
    if "@" not in email or "." not in email.rsplit("@", 1)[-1]:
        raise HTTPException(status_code=422, detail="Enter a valid email address.")
    try:
        user = create_user(email=email, password_hash=hash_password(payload.password))
    except DuplicateUserError as exc:
        raise HTTPException(status_code=409, detail="Email is already registered.") from exc
    return _auth_response_for_user(user)


@app.get("/api/auth/google/start")
def api_auth_google_start(request: Request) -> RedirectResponse:
    if auth_mode() != "account":
        raise HTTPException(status_code=404, detail="User accounts are not enabled.")
    if not settings.google_oauth_enabled:
        raise HTTPException(status_code=503, detail="Google sign-in is not configured.")

    state = create_oauth_state()
    params = urllib.parse.urlencode(
        {
            "client_id": settings.google_client_id,
            "redirect_uri": _google_redirect_uri(request),
            "response_type": "code",
            "scope": "openid email profile",
            "state": state,
            "prompt": "select_account",
        }
    )
    response = RedirectResponse(f"https://accounts.google.com/o/oauth2/v2/auth?{params}")
    response.set_cookie(
        GOOGLE_OAUTH_STATE_COOKIE,
        state,
        httponly=True,
        max_age=600,
        samesite="lax",
        secure=_google_oauth_cookie_secure(request),
    )
    return response


@app.get("/api/auth/google/callback")
def api_auth_google_callback(
    request: Request,
    code: str | None = None,
    state: str | None = None,
    error: str | None = None,
) -> RedirectResponse:
    if error:
        return _clear_google_oauth_cookie(_auth_redirect_error("Google sign-in was cancelled."))

    try:
        if auth_mode() != "account":
            raise HTTPException(status_code=404, detail="User accounts are not enabled.")
        if not settings.google_oauth_enabled:
            raise HTTPException(status_code=503, detail="Google sign-in is not configured.")
        if not code or not state:
            raise HTTPException(status_code=422, detail="Google sign-in response is incomplete.")

        state_cookie = request.cookies.get(GOOGLE_OAUTH_STATE_COOKIE)
        if not state_cookie or not secrets.compare_digest(state, state_cookie):
            raise HTTPException(status_code=401, detail="Invalid Google sign-in state.")
        verify_oauth_state(state)
        token_payload = _exchange_google_code(code, _google_redirect_uri(request))
        access_token = str(token_payload.get("access_token") or "")
        if not access_token:
            raise HTTPException(status_code=502, detail="Google did not return an access token.")

        userinfo = _fetch_google_userinfo(access_token)
        email = normalize_email(str(userinfo.get("email") or ""))
        google_sub = str(userinfo.get("sub") or "").strip()
        email_verified = userinfo.get("email_verified")
        if isinstance(email_verified, str):
            email_verified = email_verified.lower() == "true"
        if not email or "@" not in email or not google_sub or not email_verified:
            raise HTTPException(status_code=401, detail="Google account email could not be verified.")

        user = get_or_create_google_user(email=email, google_sub=google_sub)
        return _clear_google_oauth_cookie(_auth_redirect_success(_auth_response_for_user(user)))
    except HTTPException as exc:
        return _clear_google_oauth_cookie(_auth_redirect_error(str(exc.detail)))
    except Exception:
        return _clear_google_oauth_cookie(_auth_redirect_error("Google sign-in failed. Try again."))


@app.post("/api/feedback", response_model=FeedbackResponse)
def api_create_feedback(
    payload: FeedbackRequest,
    visitor_id: str = Depends(require_access),
) -> FeedbackResponse:
    create_feedback(owner_id=visitor_id, message=payload.message.strip())
    return FeedbackResponse(saved=True)


@app.get("/api/study/sessions", response_model=list[StudySessionListItem])
def api_list_sessions(visitor_id: str = Depends(require_access)) -> list[dict]:
    return list_sessions(owner_id=visitor_id)


@app.delete("/api/study/sessions")
def api_delete_all_sessions(visitor_id: str = Depends(require_access)) -> dict[str, int]:
    return {"deleted": delete_all_sessions(owner_id=visitor_id)}


@app.post("/api/study/sessions", response_model=StudySession)
def api_create_session(
    payload: StudySessionCreate,
    visitor_id: str = Depends(require_access),
) -> StudySession:
    source_text = payload.source_text.strip()
    _validate_source_length(source_text)
    title = payload.title.strip() if payload.title else _make_title(source_text)
    return create_session(source_text=source_text, title=title, owner_id=visitor_id)


@app.post("/api/study/documents/parse", response_model=ParsedDocumentResponse)
async def api_parse_document(
    file: UploadFile = File(...),
    _visitor_id: str = Depends(require_access),
) -> ParsedDocumentResponse:
    source_text = await _extract_upload_text(file)
    title = _title_from_filename(file.filename) or _make_title(source_text)
    return ParsedDocumentResponse(
        title=title,
        source_text=source_text,
        character_count=len(source_text),
    )


@app.post("/api/study/sessions/upload", response_model=StudySession)
async def api_upload_session(
    file: UploadFile = File(...),
    title: str | None = Form(default=None),
    visitor_id: str = Depends(require_access),
) -> StudySession:
    source_text = await _extract_upload_text(file)
    session_title = title.strip() if title and title.strip() else _title_from_filename(file.filename)
    if not session_title:
        session_title = _make_title(source_text)
    return create_session(source_text=source_text, title=session_title, owner_id=visitor_id)


@app.get("/api/study/sessions/{session_id}", response_model=StudySession)
def api_get_session(
    session_id: str,
    visitor_id: str = Depends(require_access),
) -> StudySession:
    session = get_session(session_id, owner_id=visitor_id)
    if session is None:
        raise HTTPException(status_code=404, detail="Study session not found")
    return session


@app.delete("/api/study/sessions/{session_id}")
def api_delete_session(
    session_id: str,
    visitor_id: str = Depends(require_access),
) -> dict[str, bool]:
    if not delete_session(session_id, owner_id=visitor_id):
        raise HTTPException(status_code=404, detail="Study session not found")
    return {"deleted": True}


@app.post("/api/study/sessions/{session_id}/summary", response_model=SummaryResponse)
def api_generate_summary(
    session_id: str,
    visitor_id: str = Depends(require_access),
) -> SummaryResponse:
    session = _require_session(session_id, visitor_id)
    _record_ai_request(visitor_id)
    try:
        summary = ai_service.generate_summary(session.source_text)
        updated = update_summary(session.id, summary)
    except AIConfigurationError as exc:
        raise HTTPException(status_code=503, detail=str(exc)) from exc
    except (
        APIConnectionError,
        AuthenticationError,
        BadRequestError,
        NotFoundError,
        PermissionDeniedError,
        RateLimitError,
    ) as exc:
        _raise_openai_error(exc)
    except Exception as exc:
        raise HTTPException(status_code=502, detail="Failed to generate summary") from exc
    return SummaryResponse(session=updated)


@app.post("/api/study/sessions/{session_id}/cheat-sheet", response_model=CheatSheetResponse)
def api_generate_cheat_sheet(
    session_id: str,
    visitor_id: str = Depends(require_access),
) -> CheatSheetResponse:
    session = _require_session(session_id, visitor_id)
    _record_ai_request(visitor_id)
    try:
        cheat_sheet = ai_service.generate_cheat_sheet(session.source_text)
        updated = update_cheat_sheet(session.id, cheat_sheet)
    except AIConfigurationError as exc:
        raise HTTPException(status_code=503, detail=str(exc)) from exc
    except (
        APIConnectionError,
        AuthenticationError,
        BadRequestError,
        NotFoundError,
        PermissionDeniedError,
        RateLimitError,
    ) as exc:
        _raise_openai_error(exc)
    except Exception as exc:
        raise HTTPException(status_code=502, detail="Failed to generate cheat sheet") from exc
    return CheatSheetResponse(session=updated)


@app.post("/api/study/sessions/{session_id}/flashcards", response_model=FlashcardsResponse)
def api_generate_flashcards(
    session_id: str,
    visitor_id: str = Depends(require_access),
) -> FlashcardsResponse:
    session = _require_session(session_id, visitor_id)
    _record_ai_request(visitor_id)
    try:
        flashcards = ai_service.generate_flashcards(session.source_text)
        updated = update_flashcards(session.id, flashcards)
    except AIConfigurationError as exc:
        raise HTTPException(status_code=503, detail=str(exc)) from exc
    except (
        APIConnectionError,
        AuthenticationError,
        BadRequestError,
        NotFoundError,
        PermissionDeniedError,
        RateLimitError,
    ) as exc:
        _raise_openai_error(exc)
    except ValueError as exc:
        raise HTTPException(status_code=502, detail=str(exc)) from exc
    except Exception as exc:
        raise HTTPException(status_code=502, detail="Failed to generate flashcards") from exc
    return FlashcardsResponse(session=updated)


@app.post("/api/study/sessions/{session_id}/quiz", response_model=QuizResponse)
def api_generate_quiz(
    session_id: str,
    visitor_id: str = Depends(require_access),
) -> QuizResponse:
    session = _require_session(session_id, visitor_id)
    _record_ai_request(visitor_id)
    try:
        questions = ai_service.generate_quiz(session.source_text)
        updated = update_quiz(session.id, questions)
    except AIConfigurationError as exc:
        raise HTTPException(status_code=503, detail=str(exc)) from exc
    except (
        APIConnectionError,
        AuthenticationError,
        BadRequestError,
        NotFoundError,
        PermissionDeniedError,
        RateLimitError,
    ) as exc:
        _raise_openai_error(exc)
    except ValueError as exc:
        raise HTTPException(status_code=502, detail=str(exc)) from exc
    except Exception as exc:
        raise HTTPException(status_code=502, detail="Failed to generate quiz") from exc
    return QuizResponse(session=updated)


@app.post("/api/study/sessions/{session_id}/quiz/review", response_model=QuizReviewResponse)
def api_review_quiz(
    session_id: str,
    payload: QuizReviewRequest,
    visitor_id: str = Depends(require_access),
) -> QuizReviewResponse:
    session = _require_session(session_id, visitor_id)
    if not session.quiz:
        raise HTTPException(status_code=400, detail="Generate a quiz before reviewing answers")

    selected_by_index = {
        answer.question_index: answer.selected_answer.strip() for answer in payload.answers
    }
    incorrect: list[QuizReviewIssue] = []
    correct = 0

    for index, question in enumerate(session.quiz):
        selected_answer = selected_by_index.get(index, "")
        if selected_answer and _same_answer(selected_answer, question.answer):
            correct += 1
        else:
            incorrect.append(
                QuizReviewIssue(
                    question=question.question,
                    selected_answer=selected_answer or "No answer selected",
                    correct_answer=question.answer,
                    explanation=question.explanation,
                )
            )

    _record_ai_request(visitor_id)
    try:
        tutor_explanation = ai_service.explain_quiz_mistakes(
            session.source_text,
            [issue.model_dump() for issue in incorrect],
        )
    except AIConfigurationError as exc:
        raise HTTPException(status_code=503, detail=str(exc)) from exc
    except (
        APIConnectionError,
        AuthenticationError,
        BadRequestError,
        NotFoundError,
        PermissionDeniedError,
        RateLimitError,
    ) as exc:
        _raise_openai_error(exc)
    except Exception as exc:
        raise HTTPException(status_code=502, detail="Failed to review quiz answers") from exc

    review = QuizReviewResult(
        total=len(session.quiz),
        correct=correct,
        incorrect=incorrect,
        tutor_explanation=tutor_explanation,
    )
    updated = update_quiz_review(session.id, review.model_dump_json())
    return QuizReviewResponse(session=updated, review=review)


@app.post("/api/study/sessions/{session_id}/quiz/mistakes", response_model=QuizReviewResponse)
def api_save_quiz_mistakes(
    session_id: str,
    payload: QuizReviewRequest,
    visitor_id: str = Depends(require_access),
) -> QuizReviewResponse:
    session = _require_session(session_id, visitor_id)
    if not session.quiz:
        raise HTTPException(status_code=400, detail="Generate a quiz before saving mistakes")

    selected_by_index = {
        answer.question_index: answer.selected_answer.strip() for answer in payload.answers
    }
    incorrect: list[QuizReviewIssue] = []
    correct = 0

    for index, question in enumerate(session.quiz):
        selected_answer = selected_by_index.get(index, "")
        if not selected_answer:
            continue
        if _same_answer(selected_answer, question.answer):
            correct += 1
        else:
            incorrect.append(
                QuizReviewIssue(
                    question=question.question,
                    selected_answer=selected_answer,
                    correct_answer=question.answer,
                    explanation=question.explanation,
                )
            )

    review = QuizReviewResult(
        total=len(session.quiz),
        correct=correct,
        incorrect=incorrect,
        tutor_explanation="",
    )
    updated = update_quiz_review(session.id, review.model_dump_json())
    return QuizReviewResponse(session=updated, review=review)


@app.post("/api/study/sessions/{session_id}/diagnostic", response_model=DiagnosticResponse)
def api_generate_diagnostic(
    session_id: str,
    visitor_id: str = Depends(require_access),
) -> DiagnosticResponse:
    session = _require_session(session_id, visitor_id)
    _record_ai_request(visitor_id)
    try:
        questions = ai_service.generate_diagnostic(session.source_text)
        updated = update_diagnostic(session.id, questions)
    except AIConfigurationError as exc:
        raise HTTPException(status_code=503, detail=str(exc)) from exc
    except (
        APIConnectionError,
        AuthenticationError,
        BadRequestError,
        NotFoundError,
        PermissionDeniedError,
        RateLimitError,
    ) as exc:
        _raise_openai_error(exc)
    except ValueError as exc:
        raise HTTPException(status_code=502, detail=str(exc)) from exc
    except Exception as exc:
        raise HTTPException(status_code=502, detail="Failed to generate diagnostic test") from exc
    return DiagnosticResponse(session=updated)


@app.post(
    "/api/study/sessions/{session_id}/diagnostic/review",
    response_model=DiagnosticReviewResponse,
)
def api_review_diagnostic(
    session_id: str,
    payload: DiagnosticReviewRequest,
    visitor_id: str = Depends(require_access),
) -> DiagnosticReviewResponse:
    session = _require_session(session_id, visitor_id)
    if not session.diagnostic:
        raise HTTPException(
            status_code=400,
            detail="Generate a diagnostic test before reviewing answers",
        )

    selected_by_index = {
        answer.question_index: answer.selected_answer.strip() for answer in payload.answers
    }
    incorrect: list[DiagnosticReviewIssue] = []
    correct_topics: list[str] = []
    weak_topics: list[str] = []
    correct = 0

    for index, question in enumerate(session.diagnostic):
        selected_answer = selected_by_index.get(index, "")
        if selected_answer and _same_answer(selected_answer, question.answer):
            correct += 1
            correct_topics.append(question.topic)
        else:
            weak_topics.append(question.topic)
            incorrect.append(
                DiagnosticReviewIssue(
                    topic=question.topic,
                    question=question.question,
                    selected_answer=selected_answer or "No answer selected",
                    correct_answer=question.answer,
                    explanation=question.explanation,
                )
            )

    total = len(session.diagnostic)
    score_percent = round((correct / total) * 100) if total else 0

    _record_ai_request(visitor_id)
    try:
        report = ai_service.generate_diagnostic_report(
            source_text=session.source_text,
            incorrect_items=[issue.model_dump() for issue in incorrect],
            correct_topics=_unique_topics(correct_topics),
            weak_topics=_unique_topics(weak_topics),
            score_percent=score_percent,
        )
    except AIConfigurationError as exc:
        raise HTTPException(status_code=503, detail=str(exc)) from exc
    except (
        APIConnectionError,
        AuthenticationError,
        BadRequestError,
        NotFoundError,
        PermissionDeniedError,
        RateLimitError,
    ) as exc:
        _raise_openai_error(exc)
    except ValueError as exc:
        raise HTTPException(status_code=502, detail=str(exc)) from exc
    except Exception as exc:
        raise HTTPException(status_code=502, detail="Failed to review diagnostic answers") from exc

    review = DiagnosticReviewResult(
        total=total,
        correct=correct,
        score_percent=score_percent,
        strengths=report.get("strengths", []),
        weak_topics=report.get("weak_topics", _unique_topics(weak_topics)),
        priority_review=report.get("priority_review", []),
        incorrect=incorrect,
        tutor_explanation=report.get("tutor_explanation", "").strip()
        or "Review the missed topics and generate a practice quiz after studying them.",
    )
    updated = update_diagnostic_review(session.id, review.model_dump_json())
    return DiagnosticReviewResponse(session=updated, review=review)


@app.post(
    "/api/study/sessions/{session_id}/targeted-practice",
    response_model=TargetedPracticeResponse,
)
def api_generate_targeted_practice(
    session_id: str,
    visitor_id: str = Depends(require_access),
) -> TargetedPracticeResponse:
    session = _require_session(session_id, visitor_id)
    weak_topics = _weak_topics_for_session(session)
    _record_ai_request(visitor_id)
    try:
        questions = ai_service.generate_targeted_practice(session.source_text, weak_topics)
        updated = update_targeted_practice(session.id, questions)
    except AIConfigurationError as exc:
        raise HTTPException(status_code=503, detail=str(exc)) from exc
    except (
        APIConnectionError,
        AuthenticationError,
        BadRequestError,
        NotFoundError,
        PermissionDeniedError,
        RateLimitError,
    ) as exc:
        _raise_openai_error(exc)
    except ValueError as exc:
        raise HTTPException(status_code=502, detail=str(exc)) from exc
    except Exception as exc:
        raise HTTPException(status_code=502, detail="Failed to generate targeted practice") from exc
    return TargetedPracticeResponse(session=updated)


@app.post(
    "/api/study/sessions/{session_id}/targeted-practice/review",
    response_model=TargetedPracticeReviewResponse,
)
def api_review_targeted_practice(
    session_id: str,
    payload: TargetedPracticeReviewRequest,
    visitor_id: str = Depends(require_access),
) -> TargetedPracticeReviewResponse:
    session = _require_session(session_id, visitor_id)
    if not session.targeted_practice:
        raise HTTPException(
            status_code=400,
            detail="Generate targeted practice before checking mastery",
        )

    selected_by_index = {
        answer.question_index: answer.selected_answer.strip() for answer in payload.answers
    }
    incorrect: list[TargetedPracticeReviewIssue] = []
    topic_totals: dict[str, int] = {}
    topic_correct: dict[str, int] = {}
    correct = 0

    for index, question in enumerate(session.targeted_practice):
        topic = question.topic.strip() or "General"
        topic_totals[topic] = topic_totals.get(topic, 0) + 1
        selected_answer = selected_by_index.get(index, "")
        if selected_answer and _same_answer(selected_answer, question.answer):
            correct += 1
            topic_correct[topic] = topic_correct.get(topic, 0) + 1
        else:
            incorrect.append(
                TargetedPracticeReviewIssue(
                    topic=topic,
                    question=question.question,
                    selected_answer=selected_answer or "No answer selected",
                    correct_answer=question.answer,
                    explanation=question.explanation,
                    study_tip=question.study_tip,
                )
            )

    total = len(session.targeted_practice)
    score_percent = round((correct / total) * 100) if total else 0
    mastered_topics = [
        topic for topic, count in topic_totals.items() if topic_correct.get(topic, 0) == count
    ]
    still_weak_topics = [
        topic for topic, count in topic_totals.items() if topic_correct.get(topic, 0) < count
    ]
    next_steps = _targeted_next_steps(still_weak_topics, score_percent)

    review = TargetedPracticeReviewResult(
        total=total,
        correct=correct,
        score_percent=score_percent,
        mastered_topics=mastered_topics,
        still_weak_topics=still_weak_topics,
        next_steps=next_steps,
        incorrect=incorrect,
    )
    updated = update_targeted_practice_review(session.id, review.model_dump_json())
    return TargetedPracticeReviewResponse(session=updated, review=review)


@app.post("/api/study/sessions/{session_id}/chat", response_model=ChatResponse)
def api_chat(
    session_id: str,
    payload: ChatRequest,
    visitor_id: str = Depends(require_access),
) -> ChatResponse:
    session = _require_session(session_id, visitor_id)
    question = payload.question.strip()
    _record_ai_request(visitor_id)
    try:
        answer = ai_service.answer_question(
            source_text=session.source_text,
            question=question,
            chat_messages=session.chat_messages,
            summary=session.summary,
        )
        updated = append_chat_messages(
            session.id,
            [
                {"role": "user", "content": question},
                {"role": "assistant", "content": answer},
            ],
        )
    except AIConfigurationError as exc:
        raise HTTPException(status_code=503, detail=str(exc)) from exc
    except (
        APIConnectionError,
        AuthenticationError,
        BadRequestError,
        NotFoundError,
        PermissionDeniedError,
        RateLimitError,
    ) as exc:
        _raise_openai_error(exc)
    except Exception as exc:
        raise HTTPException(status_code=502, detail="Failed to answer question") from exc
    return ChatResponse(session=updated, answer=answer)


def _require_session(session_id: str, owner_id: str) -> StudySession:
    session = get_session(session_id, owner_id=owner_id)
    if session is None:
        raise HTTPException(status_code=404, detail="Study session not found")
    return session


def _auth_response_for_user(user: dict[str, str]) -> AuthLoginResponse:
    auth_user = AuthUser(id=user["id"], email=user["email"], plan=user["plan"])
    return AuthLoginResponse(
        token=create_access_token(visitor_id=user["id"], email=user["email"]),
        user=auth_user,
    )


def _google_redirect_uri(request: Request) -> str:
    if settings.google_redirect_uri:
        return settings.google_redirect_uri
    return str(request.url_for("api_auth_google_callback"))


def _google_oauth_cookie_secure(request: Request) -> bool:
    if settings.google_redirect_uri:
        return settings.google_redirect_uri.startswith("https://")
    return request.url.scheme == "https"


def _exchange_google_code(code: str, redirect_uri: str) -> dict[str, Any]:
    payload = urllib.parse.urlencode(
        {
            "client_id": settings.google_client_id,
            "client_secret": settings.google_client_secret,
            "code": code,
            "grant_type": "authorization_code",
            "redirect_uri": redirect_uri,
        }
    ).encode("utf-8")
    request = urllib.request.Request(
        "https://oauth2.googleapis.com/token",
        data=payload,
        headers={
            "Accept": "application/json",
            "Content-Type": "application/x-www-form-urlencoded",
        },
        method="POST",
    )
    return _read_json_response(request)


def _fetch_google_userinfo(access_token: str) -> dict[str, Any]:
    request = urllib.request.Request(
        "https://openidconnect.googleapis.com/v1/userinfo",
        headers={
            "Accept": "application/json",
            "Authorization": f"Bearer {access_token}",
        },
    )
    return _read_json_response(request)


def _read_json_response(request: urllib.request.Request) -> dict[str, Any]:
    with urllib.request.urlopen(request, timeout=12) as response:
        return json.loads(response.read().decode("utf-8"))


def _auth_redirect_success(auth_response: AuthLoginResponse) -> RedirectResponse:
    token = urllib.parse.quote(auth_response.token, safe="")
    email = urllib.parse.quote(auth_response.user.email if auth_response.user else "", safe="")
    return RedirectResponse(f"/#auth_token={token}&auth_email={email}", status_code=303)


def _auth_redirect_error(message: str) -> RedirectResponse:
    encoded_message = urllib.parse.quote(message, safe="")
    return RedirectResponse(f"/#auth_error={encoded_message}", status_code=303)


def _clear_google_oauth_cookie(response: RedirectResponse) -> RedirectResponse:
    response.delete_cookie(GOOGLE_OAUTH_STATE_COOKIE)
    return response


def _record_ai_request(visitor_id: str) -> None:
    if settings.mock_ai:
        return
    try:
        record_ai_usage(visitor_id)
    except UsageLimitError as exc:
        raise HTTPException(status_code=429, detail=str(exc)) from exc


def _validate_source_length(source_text: str) -> None:
    if len(source_text) > settings.max_source_chars:
        raise HTTPException(
            status_code=413,
            detail=f"Study material is too long. Limit is {settings.max_source_chars} characters.",
        )


async def _extract_upload_text(file: UploadFile) -> str:
    content = await file.read()
    if len(content) > settings.max_upload_bytes:
        max_mb = settings.max_upload_bytes // (1024 * 1024)
        raise HTTPException(
            status_code=413,
            detail=f"File is too large. Limit is {max_mb} MB.",
        )

    try:
        source_text = extract_text_from_document(file.filename or "", content)
    except DocumentParseError as exc:
        raise HTTPException(status_code=422, detail=str(exc)) from exc

    _validate_source_length(source_text)
    return source_text


def _make_title(source_text: str) -> str:
    first_line = next((line.strip() for line in source_text.splitlines() if line.strip()), "")
    words = first_line.split()
    title = " ".join(words[:10]).strip()
    if len(title) > 90:
        title = f"{title[:87]}..."
    return title or "Untitled Study Session"


def _title_from_filename(filename: str | None) -> str:
    if not filename:
        return ""
    title = Path(filename).stem.replace("_", " ").replace("-", " ").strip()
    return title[:120]


def _same_answer(selected_answer: str, correct_answer: str) -> bool:
    return selected_answer.strip().casefold() == correct_answer.strip().casefold()


def _unique_topics(topics: list[str]) -> list[str]:
    unique: list[str] = []
    seen: set[str] = set()
    for topic in topics:
        clean = topic.strip()
        key = clean.casefold()
        if clean and key not in seen:
            unique.append(clean)
            seen.add(key)
    return unique


def _weak_topics_for_session(session: StudySession) -> list[str]:
    review = _parse_json_object(session.diagnostic_review)
    topics = review.get("weak_topics", [])
    if isinstance(topics, list):
        weak_topics = _unique_topics([str(topic) for topic in topics])
        if weak_topics:
            return weak_topics

    incorrect = review.get("incorrect", [])
    if isinstance(incorrect, list):
        missed_topics = [
            str(item.get("topic", ""))
            for item in incorrect
            if isinstance(item, dict) and item.get("topic")
        ]
        weak_topics = _unique_topics(missed_topics)
        if weak_topics:
            return weak_topics

    diagnostic_topics = _unique_topics([question.topic for question in session.diagnostic])
    if diagnostic_topics:
        return diagnostic_topics[:4]

    return ["Most exam-relevant weak spots from this material"]


def _targeted_next_steps(still_weak_topics: list[str], score_percent: int) -> list[str]:
    if not still_weak_topics:
        return [
            "This drill is mastered. Generate a practice quiz to test the material from a new angle.",
            "Explain each solved question out loud without looking at the answer choices.",
        ]

    steps = [
        f"Review {topic}: redo the missed question, then write the method in one sentence."
        for topic in still_weak_topics[:4]
    ]
    if score_percent < 70:
        steps.append("Regenerate targeted practice after review and aim for at least 80%.")
    else:
        steps.append("Move to a mixed practice quiz after one more quick pass on the weak topics.")
    return steps


def _parse_json_object(value: str | None) -> dict:
    if not value:
        return {}
    try:
        payload = json.loads(value)
    except json.JSONDecodeError:
        return {}
    return payload if isinstance(payload, dict) else {}


def _raise_openai_error(exc: Exception) -> None:
    code = getattr(exc, "code", None)
    status_code = getattr(exc, "status_code", 502) or 502

    if isinstance(exc, RateLimitError) and code == "insufficient_quota":
        detail = (
            "OpenAI API quota is insufficient. Check billing, project budget, "
            "or available credits for this API key."
        )
        raise HTTPException(status_code=429, detail=detail) from exc

    if isinstance(exc, AuthenticationError):
        raise HTTPException(status_code=401, detail="OpenAI API key is invalid or expired.") from exc

    if isinstance(exc, PermissionDeniedError):
        raise HTTPException(
            status_code=403,
            detail="OpenAI API key does not have permission for this request.",
        ) from exc

    if isinstance(exc, NotFoundError):
        raise HTTPException(
            status_code=404,
            detail="Configured OpenAI model was not found or is not available to this account.",
        ) from exc

    if isinstance(exc, APIConnectionError):
        raise HTTPException(
            status_code=502,
            detail="Could not connect to OpenAI API. Check network access and try again.",
        ) from exc

    raise HTTPException(status_code=status_code, detail="OpenAI API request failed.") from exc
