from __future__ import annotations

import json
import sqlite3
import uuid
from datetime import datetime, timezone
from pathlib import Path
from typing import Any

from backend.app.config import settings
from backend.app.schemas import (
    ChatMessage,
    DiagnosticQuestion,
    Flashcard,
    QuizQuestion,
    StudySession,
    TargetedPracticeQuestion,
)


DEFAULT_OWNER_ID = "local-dev"


class UsageLimitError(Exception):
    def __init__(self, message: str, usage: dict[str, int]) -> None:
        super().__init__(message)
        self.usage = usage


class DuplicateUserError(Exception):
    pass


def utc_now() -> str:
    return datetime.now(timezone.utc).isoformat()


def using_postgres() -> bool:
    return settings.database_url.startswith(("postgres://", "postgresql://"))


def _postgres_dsn() -> str:
    if settings.database_url.startswith("postgres://"):
        return f"postgresql://{settings.database_url.removeprefix('postgres://')}"
    return settings.database_url


def get_connection() -> Any:
    if using_postgres():
        try:
            import psycopg
            from psycopg.rows import dict_row
        except ImportError as exc:
            raise RuntimeError(
                "DATABASE_URL is configured for PostgreSQL, but psycopg is not installed. "
                "Run pip install -r requirements.txt."
            ) from exc

        return psycopg.connect(_postgres_dsn(), row_factory=dict_row)

    db_path = Path(settings.database_path)
    db_path.parent.mkdir(parents=True, exist_ok=True)
    connection = sqlite3.connect(db_path)
    connection.row_factory = sqlite3.Row
    return connection


def _execute(connection: Any, sql: str, params: tuple[Any, ...] = ()) -> Any:
    if using_postgres():
        sql = sql.replace("?", "%s")
    return connection.execute(sql, params)


def init_db() -> None:
    with get_connection() as connection:
        _execute(
            connection,
            """
            CREATE TABLE IF NOT EXISTS users (
                id TEXT PRIMARY KEY,
                email TEXT UNIQUE NOT NULL,
                password_hash TEXT NOT NULL,
                plan TEXT NOT NULL DEFAULT 'free',
                created_at TEXT NOT NULL,
                updated_at TEXT NOT NULL
            )
            """,
        )
        _execute(
            connection,
            """
            CREATE TABLE IF NOT EXISTS study_sessions (
                id TEXT PRIMARY KEY,
                owner_id TEXT NOT NULL DEFAULT 'local-dev',
                title TEXT NOT NULL,
                source_text TEXT NOT NULL,
                summary TEXT,
                cheat_sheet TEXT,
                flashcards_json TEXT NOT NULL DEFAULT '[]',
                quiz_json TEXT NOT NULL DEFAULT '[]',
                quiz_review TEXT,
                diagnostic_json TEXT NOT NULL DEFAULT '[]',
                diagnostic_review TEXT,
                targeted_practice_json TEXT NOT NULL DEFAULT '[]',
                targeted_practice_review TEXT,
                chat_messages_json TEXT NOT NULL DEFAULT '[]',
                created_at TEXT NOT NULL,
                updated_at TEXT NOT NULL
            )
            """
        )
        _ensure_column(connection, "study_sessions", "owner_id", "TEXT NOT NULL DEFAULT 'local-dev'")
        _ensure_column(connection, "study_sessions", "cheat_sheet", "TEXT")
        _ensure_column(connection, "study_sessions", "quiz_review", "TEXT")
        _ensure_column(connection, "study_sessions", "diagnostic_json", "TEXT NOT NULL DEFAULT '[]'")
        _ensure_column(connection, "study_sessions", "diagnostic_review", "TEXT")
        _ensure_column(
            connection,
            "study_sessions",
            "targeted_practice_json",
            "TEXT NOT NULL DEFAULT '[]'",
        )
        _ensure_column(connection, "study_sessions", "targeted_practice_review", "TEXT")
        _execute(
            connection,
            """
            CREATE TABLE IF NOT EXISTS usage_events (
                id TEXT PRIMARY KEY,
                owner_id TEXT,
                visitor_id TEXT NOT NULL,
                event_type TEXT NOT NULL,
                created_at TEXT NOT NULL
            )
            """
        )
        _ensure_column(connection, "usage_events", "owner_id", "TEXT")
        _execute(
            connection,
            """
            CREATE INDEX IF NOT EXISTS idx_users_email
            ON users (email)
            """,
        )
        _execute(
            connection,
            """
            CREATE INDEX IF NOT EXISTS idx_study_sessions_owner_updated
            ON study_sessions (owner_id, updated_at)
            """,
        )
        _execute(
            connection,
            """
            CREATE INDEX IF NOT EXISTS idx_usage_events_type_created
            ON usage_events (event_type, created_at)
            """
        )
        _execute(
            connection,
            """
            CREATE INDEX IF NOT EXISTS idx_usage_events_visitor_type_created
            ON usage_events (visitor_id, event_type, created_at)
            """
        )


def _ensure_column(
    connection: Any,
    table_name: str,
    column_name: str,
    column_definition: str,
) -> None:
    if using_postgres():
        row = _execute(
            connection,
            """
            SELECT column_name
            FROM information_schema.columns
            WHERE table_schema = current_schema()
              AND table_name = ?
              AND column_name = ?
            """,
            (table_name, column_name),
        ).fetchone()
        if row is None:
            _execute(
                connection,
                f"ALTER TABLE {table_name} ADD COLUMN {column_name} {column_definition}",
            )
        return

    columns = _execute(connection, f"PRAGMA table_info({table_name})").fetchall()
    if column_name not in {column["name"] for column in columns}:
        _execute(
            connection,
            f"ALTER TABLE {table_name} ADD COLUMN {column_name} {column_definition}",
        )


def _loads(value: str | None, fallback: Any) -> Any:
    if not value:
        return fallback
    return json.loads(value)


def _row_to_user(row: Any) -> dict[str, str]:
    return {
        "id": row["id"],
        "email": row["email"],
        "password_hash": row["password_hash"],
        "plan": row["plan"],
        "created_at": row["created_at"],
        "updated_at": row["updated_at"],
    }


def create_user(email: str, password_hash: str) -> dict[str, str]:
    if get_user_by_email(email) is not None:
        raise DuplicateUserError("Email is already registered")

    now = utc_now()
    user_id = str(uuid.uuid4())
    with get_connection() as connection:
        try:
            _execute(
                connection,
                """
                INSERT INTO users (id, email, password_hash, plan, created_at, updated_at)
                VALUES (?, ?, ?, 'free', ?, ?)
                """,
                (user_id, email, password_hash, now, now),
            )
        except Exception as exc:
            if "unique" in str(exc).casefold() or "duplicate" in str(exc).casefold():
                raise DuplicateUserError("Email is already registered") from exc
            raise

    user = get_user_by_email(email)
    if user is None:
        raise RuntimeError("Failed to create user")
    return user


def get_user_by_email(email: str) -> dict[str, str] | None:
    with get_connection() as connection:
        row = _execute(
            connection,
            "SELECT * FROM users WHERE email = ?",
            (email,),
        ).fetchone()
    if row is None:
        return None
    return _row_to_user(row)


def _row_to_session(row: sqlite3.Row) -> StudySession:
    return StudySession(
        id=row["id"],
        title=row["title"],
        source_text=row["source_text"],
        summary=row["summary"],
        cheat_sheet=row["cheat_sheet"],
        flashcards=[Flashcard(**item) for item in _loads(row["flashcards_json"], [])],
        quiz=[QuizQuestion(**item) for item in _loads(row["quiz_json"], [])],
        quiz_review=row["quiz_review"],
        diagnostic=[
            DiagnosticQuestion(**item) for item in _loads(row["diagnostic_json"], [])
        ],
        diagnostic_review=row["diagnostic_review"],
        targeted_practice=[
            TargetedPracticeQuestion(**item)
            for item in _loads(row["targeted_practice_json"], [])
        ],
        targeted_practice_review=row["targeted_practice_review"],
        chat_messages=[ChatMessage(**item) for item in _loads(row["chat_messages_json"], [])],
        created_at=row["created_at"],
        updated_at=row["updated_at"],
    )


def create_session(
    source_text: str,
    title: str,
    owner_id: str = DEFAULT_OWNER_ID,
) -> StudySession:
    now = utc_now()
    session_id = str(uuid.uuid4())
    with get_connection() as connection:
        _execute(
            connection,
            """
            INSERT INTO study_sessions (
                id, owner_id, title, source_text, summary, cheat_sheet, flashcards_json,
                quiz_json, quiz_review, diagnostic_json, targeted_practice_json,
                chat_messages_json, created_at, updated_at
            )
            VALUES (?, ?, ?, ?, NULL, NULL, '[]', '[]', NULL, '[]', '[]', '[]', ?, ?)
            """,
            (session_id, owner_id, title, source_text, now, now),
        )
    session = get_session(session_id, owner_id=owner_id)
    if session is None:
        raise RuntimeError("Failed to create study session")
    return session


def list_sessions(owner_id: str | None = None) -> list[dict[str, Any]]:
    with get_connection() as connection:
        sql = """
        SELECT id, title, summary, cheat_sheet, flashcards_json, quiz_json,
               quiz_review, diagnostic_json, diagnostic_review,
               targeted_practice_json, targeted_practice_review,
               chat_messages_json, created_at, updated_at
        FROM study_sessions
        """
        params: tuple[Any, ...] = ()
        if owner_id:
            sql += " WHERE owner_id = ?"
            params = (owner_id,)
        sql += " ORDER BY updated_at DESC"
        rows = _execute(connection, sql, params).fetchall()
    return [
        {
            "id": row["id"],
            "title": row["title"],
            "created_at": row["created_at"],
            "updated_at": row["updated_at"],
            "has_summary": bool(row["summary"]),
            "has_cheat_sheet": bool(row["cheat_sheet"]),
            "flashcard_count": len(_loads(row["flashcards_json"], [])),
            "quiz_count": len(_loads(row["quiz_json"], [])),
            "has_quiz_review": bool(row["quiz_review"]),
            "diagnostic_count": len(_loads(row["diagnostic_json"], [])),
            "has_diagnostic_review": bool(row["diagnostic_review"]),
            "targeted_practice_count": len(_loads(row["targeted_practice_json"], [])),
            "has_targeted_practice_review": bool(row["targeted_practice_review"]),
            "chat_count": len(_loads(row["chat_messages_json"], [])),
        }
        for row in rows
    ]


def get_session(session_id: str, owner_id: str | None = None) -> StudySession | None:
    with get_connection() as connection:
        sql = "SELECT * FROM study_sessions WHERE id = ?"
        params: tuple[Any, ...] = (session_id,)
        if owner_id:
            sql += " AND owner_id = ?"
            params = (session_id, owner_id)
        row = _execute(connection, sql, params).fetchone()
    if row is None:
        return None
    return _row_to_session(row)


def delete_session(session_id: str, owner_id: str | None = None) -> bool:
    with get_connection() as connection:
        sql = "DELETE FROM study_sessions WHERE id = ?"
        params: tuple[Any, ...] = (session_id,)
        if owner_id:
            sql += " AND owner_id = ?"
            params = (session_id, owner_id)
        cursor = _execute(connection, sql, params)
        return cursor.rowcount > 0


def delete_all_sessions(owner_id: str | None = None) -> int:
    with get_connection() as connection:
        if owner_id:
            cursor = _execute(connection, "DELETE FROM study_sessions WHERE owner_id = ?", (owner_id,))
        else:
            cursor = _execute(connection, "DELETE FROM study_sessions")
        return cursor.rowcount


def update_summary(session_id: str, summary: str) -> StudySession:
    with get_connection() as connection:
        _execute(
            connection,
            """
            UPDATE study_sessions
            SET summary = ?, updated_at = ?
            WHERE id = ?
            """,
            (summary, utc_now(), session_id),
        )
    session = get_session(session_id)
    if session is None:
        raise ValueError("Study session not found")
    return session


def update_cheat_sheet(session_id: str, cheat_sheet: str) -> StudySession:
    with get_connection() as connection:
        _execute(
            connection,
            """
            UPDATE study_sessions
            SET cheat_sheet = ?, updated_at = ?
            WHERE id = ?
            """,
            (cheat_sheet, utc_now(), session_id),
        )
    session = get_session(session_id)
    if session is None:
        raise ValueError("Study session not found")
    return session


def update_flashcards(session_id: str, flashcards: list[dict[str, str]]) -> StudySession:
    with get_connection() as connection:
        _execute(
            connection,
            """
            UPDATE study_sessions
            SET flashcards_json = ?, updated_at = ?
            WHERE id = ?
            """,
            (json.dumps(flashcards), utc_now(), session_id),
        )
    session = get_session(session_id)
    if session is None:
        raise ValueError("Study session not found")
    return session


def update_quiz(session_id: str, questions: list[dict[str, Any]]) -> StudySession:
    with get_connection() as connection:
        _execute(
            connection,
            """
            UPDATE study_sessions
            SET quiz_json = ?, updated_at = ?
            WHERE id = ?
            """,
            (json.dumps(questions), utc_now(), session_id),
        )
    session = get_session(session_id)
    if session is None:
        raise ValueError("Study session not found")
    return session


def update_quiz_review(session_id: str, quiz_review: str) -> StudySession:
    with get_connection() as connection:
        _execute(
            connection,
            """
            UPDATE study_sessions
            SET quiz_review = ?, updated_at = ?
            WHERE id = ?
            """,
            (quiz_review, utc_now(), session_id),
        )
    session = get_session(session_id)
    if session is None:
        raise ValueError("Study session not found")
    return session


def update_diagnostic(session_id: str, questions: list[dict[str, Any]]) -> StudySession:
    with get_connection() as connection:
        _execute(
            connection,
            """
            UPDATE study_sessions
            SET diagnostic_json = ?, diagnostic_review = NULL, updated_at = ?
            WHERE id = ?
            """,
            (json.dumps(questions), utc_now(), session_id),
        )
    session = get_session(session_id)
    if session is None:
        raise ValueError("Study session not found")
    return session


def update_diagnostic_review(session_id: str, diagnostic_review: str) -> StudySession:
    with get_connection() as connection:
        _execute(
            connection,
            """
            UPDATE study_sessions
            SET diagnostic_review = ?, updated_at = ?
            WHERE id = ?
            """,
            (diagnostic_review, utc_now(), session_id),
        )
    session = get_session(session_id)
    if session is None:
        raise ValueError("Study session not found")
    return session


def update_targeted_practice(session_id: str, questions: list[dict[str, Any]]) -> StudySession:
    with get_connection() as connection:
        _execute(
            connection,
            """
            UPDATE study_sessions
            SET targeted_practice_json = ?, targeted_practice_review = NULL, updated_at = ?
            WHERE id = ?
            """,
            (json.dumps(questions), utc_now(), session_id),
        )
    session = get_session(session_id)
    if session is None:
        raise ValueError("Study session not found")
    return session


def update_targeted_practice_review(
    session_id: str,
    targeted_practice_review: str,
) -> StudySession:
    with get_connection() as connection:
        _execute(
            connection,
            """
            UPDATE study_sessions
            SET targeted_practice_review = ?, updated_at = ?
            WHERE id = ?
            """,
            (targeted_practice_review, utc_now(), session_id),
        )
    session = get_session(session_id)
    if session is None:
        raise ValueError("Study session not found")
    return session


def append_chat_messages(session_id: str, messages: list[dict[str, str]]) -> StudySession:
    session = get_session(session_id)
    if session is None:
        raise ValueError("Study session not found")
    existing = [message.model_dump() for message in session.chat_messages]
    updated = existing + messages
    with get_connection() as connection:
        _execute(
            connection,
            """
            UPDATE study_sessions
            SET chat_messages_json = ?, updated_at = ?
            WHERE id = ?
            """,
            (json.dumps(updated), utc_now(), session_id),
        )
    refreshed = get_session(session_id)
    if refreshed is None:
        raise ValueError("Study session not found")
    return refreshed


def get_ai_usage(visitor_id: str) -> dict[str, int]:
    since = _utc_day_start()
    with get_connection() as connection:
        user_count = _execute(
            connection,
            """
            SELECT COUNT(*) AS count
            FROM usage_events
            WHERE visitor_id = ? AND event_type = 'ai_request' AND created_at >= ?
            """,
            (visitor_id, since),
        ).fetchone()["count"]
        global_count = _execute(
            connection,
            """
            SELECT COUNT(*) AS count
            FROM usage_events
            WHERE event_type = 'ai_request' AND created_at >= ?
            """,
            (since,),
        ).fetchone()["count"]

    return {
        "user_count": int(user_count),
        "user_limit": settings.per_user_daily_ai_limit,
        "global_count": int(global_count),
        "global_limit": settings.global_daily_ai_limit,
    }


def record_ai_usage(visitor_id: str) -> dict[str, int]:
    usage = get_ai_usage(visitor_id)
    if usage["user_limit"] > 0 and usage["user_count"] >= usage["user_limit"]:
        raise UsageLimitError("Daily AI generation limit reached for this visitor.", usage)
    if usage["global_limit"] > 0 and usage["global_count"] >= usage["global_limit"]:
        raise UsageLimitError("Daily site-wide AI generation limit reached.", usage)

    with get_connection() as connection:
        _execute(
            connection,
            """
            INSERT INTO usage_events (id, owner_id, visitor_id, event_type, created_at)
            VALUES (?, ?, ?, 'ai_request', ?)
            """,
            (str(uuid.uuid4()), visitor_id, visitor_id, utc_now()),
        )

    return get_ai_usage(visitor_id)


def _utc_day_start() -> str:
    now = datetime.now(timezone.utc)
    return now.replace(hour=0, minute=0, second=0, microsecond=0).isoformat()
