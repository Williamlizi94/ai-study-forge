from __future__ import annotations

from pydantic import BaseModel, Field


class StudySessionCreate(BaseModel):
    source_text: str = Field(..., min_length=50, max_length=100000)
    title: str | None = Field(default=None, max_length=120)


class AuthStatus(BaseModel):
    auth_required: bool
    auth_mode: str
    google_auth_enabled: bool = False
    per_user_daily_ai_limit: int
    global_daily_ai_limit: int


class AuthLoginRequest(BaseModel):
    email: str | None = Field(default=None, max_length=254)
    password: str = Field(..., min_length=1, max_length=200)


class AuthRegisterRequest(BaseModel):
    email: str = Field(..., min_length=3, max_length=254)
    password: str = Field(..., min_length=8, max_length=200)


class AuthUser(BaseModel):
    id: str
    email: str
    plan: str


class AuthLoginResponse(BaseModel):
    token: str
    user: AuthUser | None = None


class ParsedDocumentResponse(BaseModel):
    title: str
    source_text: str
    character_count: int


class Flashcard(BaseModel):
    question: str
    answer: str


class QuizQuestion(BaseModel):
    question: str
    choices: list[str]
    answer: str
    explanation: str


class QuizAnswer(BaseModel):
    question_index: int = Field(..., ge=0)
    selected_answer: str = Field(..., min_length=1, max_length=500)


class QuizReviewRequest(BaseModel):
    answers: list[QuizAnswer] = Field(default_factory=list)


class QuizReviewIssue(BaseModel):
    question: str
    selected_answer: str
    correct_answer: str
    explanation: str


class QuizReviewResult(BaseModel):
    total: int
    correct: int
    incorrect: list[QuizReviewIssue] = Field(default_factory=list)
    tutor_explanation: str


class DiagnosticQuestion(BaseModel):
    topic: str
    difficulty: str = "medium"
    question: str
    choices: list[str]
    answer: str
    explanation: str


class DiagnosticAnswer(BaseModel):
    question_index: int = Field(..., ge=0)
    selected_answer: str = Field(..., min_length=1, max_length=500)


class DiagnosticReviewRequest(BaseModel):
    answers: list[DiagnosticAnswer] = Field(default_factory=list)


class DiagnosticReviewIssue(BaseModel):
    topic: str
    question: str
    selected_answer: str
    correct_answer: str
    explanation: str


class DiagnosticReviewResult(BaseModel):
    total: int
    correct: int
    score_percent: int
    strengths: list[str] = Field(default_factory=list)
    weak_topics: list[str] = Field(default_factory=list)
    priority_review: list[str] = Field(default_factory=list)
    incorrect: list[DiagnosticReviewIssue] = Field(default_factory=list)
    tutor_explanation: str


class TargetedPracticeQuestion(BaseModel):
    topic: str
    difficulty: str = "medium"
    question: str
    choices: list[str]
    answer: str
    explanation: str
    study_tip: str


class TargetedPracticeAnswer(BaseModel):
    question_index: int = Field(..., ge=0)
    selected_answer: str = Field(..., min_length=1, max_length=500)


class TargetedPracticeReviewRequest(BaseModel):
    answers: list[TargetedPracticeAnswer] = Field(default_factory=list)


class TargetedPracticeReviewIssue(BaseModel):
    topic: str
    question: str
    selected_answer: str
    correct_answer: str
    explanation: str
    study_tip: str


class TargetedPracticeReviewResult(BaseModel):
    total: int
    correct: int
    score_percent: int
    mastered_topics: list[str] = Field(default_factory=list)
    still_weak_topics: list[str] = Field(default_factory=list)
    next_steps: list[str] = Field(default_factory=list)
    incorrect: list[TargetedPracticeReviewIssue] = Field(default_factory=list)


class ChatRequest(BaseModel):
    question: str = Field(..., min_length=3, max_length=1000)


class ChatMessage(BaseModel):
    role: str
    content: str


class StudySession(BaseModel):
    id: str
    title: str
    source_text: str
    summary: str | None = None
    cheat_sheet: str | None = None
    flashcards: list[Flashcard] = Field(default_factory=list)
    quiz: list[QuizQuestion] = Field(default_factory=list)
    quiz_review: str | None = None
    diagnostic: list[DiagnosticQuestion] = Field(default_factory=list)
    diagnostic_review: str | None = None
    targeted_practice: list[TargetedPracticeQuestion] = Field(default_factory=list)
    targeted_practice_review: str | None = None
    chat_messages: list[ChatMessage] = Field(default_factory=list)
    created_at: str
    updated_at: str


class StudySessionListItem(BaseModel):
    id: str
    title: str
    created_at: str
    updated_at: str
    has_summary: bool
    has_cheat_sheet: bool
    flashcard_count: int
    quiz_count: int
    has_quiz_review: bool
    diagnostic_count: int
    has_diagnostic_review: bool
    targeted_practice_count: int
    has_targeted_practice_review: bool
    chat_count: int


class SummaryResponse(BaseModel):
    session: StudySession


class CheatSheetResponse(BaseModel):
    session: StudySession


class FlashcardsResponse(BaseModel):
    session: StudySession


class QuizResponse(BaseModel):
    session: StudySession


class QuizReviewResponse(BaseModel):
    session: StudySession
    review: QuizReviewResult


class DiagnosticResponse(BaseModel):
    session: StudySession


class DiagnosticReviewResponse(BaseModel):
    session: StudySession
    review: DiagnosticReviewResult


class TargetedPracticeResponse(BaseModel):
    session: StudySession


class TargetedPracticeReviewResponse(BaseModel):
    session: StudySession
    review: TargetedPracticeReviewResult


class ChatResponse(BaseModel):
    session: StudySession
    answer: str
