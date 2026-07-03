from __future__ import annotations

import os
from pathlib import Path

from dotenv import load_dotenv


BASE_DIR = Path(__file__).resolve().parents[2]
load_dotenv(BASE_DIR / ".env", encoding="utf-8-sig")


def _env_bool(name: str, default: bool = False) -> bool:
    value = os.getenv(name)
    if value is None:
        return default
    return value.strip().lower() in {"1", "true", "yes", "on"}


def _env_csv(name: str, default: list[str]) -> list[str]:
    value = os.getenv(name, "")
    items = [item.strip() for item in value.split(",") if item.strip()]
    return items or default


class Settings:
    def __init__(self) -> None:
        self.app_env = os.getenv("APP_ENV", "development").strip().lower()
        self.openai_api_key = os.getenv("OPENAI_API_KEY", "")
        self.openai_model = os.getenv("OPENAI_MODEL", "gpt-5.4-mini")
        self.max_source_chars = int(os.getenv("MAX_SOURCE_CHARS", "100000"))
        self.max_upload_bytes = int(os.getenv("MAX_UPLOAD_MB", "10")) * 1024 * 1024
        self.access_password = os.getenv("ACCESS_PASSWORD", "")
        self.auth_token_secret = os.getenv("AUTH_TOKEN_SECRET", self.access_password)
        self.auth_token_ttl_days = int(os.getenv("AUTH_TOKEN_TTL_DAYS", "14"))
        self.require_user_accounts = _env_bool("REQUIRE_USER_ACCOUNTS", False)
        self.mock_ai = _env_bool("MOCK_AI", False)
        self.per_user_daily_ai_limit = int(os.getenv("PER_USER_DAILY_AI_LIMIT", "20"))
        self.global_daily_ai_limit = int(os.getenv("GLOBAL_DAILY_AI_LIMIT", "100"))
        self.database_url = os.getenv("DATABASE_URL", "").strip()
        database_path = Path(os.getenv("DATABASE_PATH", "data/study_assistant.db"))
        self.database_path = database_path if database_path.is_absolute() else BASE_DIR / database_path
        self.cors_origins = _env_csv(
            "CORS_ORIGINS",
            [
                "http://127.0.0.1:8000",
                "http://localhost:8000",
                "http://127.0.0.1:5173",
                "http://localhost:5173",
            ],
        )
        self._validate_production_settings()

    def _validate_production_settings(self) -> None:
        if self.app_env not in {"production", "prod"}:
            return

        errors: list[str] = []
        if self.mock_ai:
            errors.append("MOCK_AI must be false in production.")
        if not self.openai_api_key or "replace_with" in self.openai_api_key:
            errors.append("OPENAI_API_KEY must be configured.")
        if not self.database_url.startswith(("postgres://", "postgresql://")):
            errors.append("DATABASE_URL must point to PostgreSQL in production.")
        if not self.require_user_accounts and not self.access_password:
            errors.append("Enable REQUIRE_USER_ACCOUNTS=true or set ACCESS_PASSWORD.")
        weak_secrets = {
            "",
            "change_this_to_a_long_random_secret_before_launch",
            "local-development-secret",
        }
        if (
            self.auth_token_secret in weak_secrets
            or "replace_with" in self.auth_token_secret
            or len(self.auth_token_secret) < 32
        ):
            errors.append("AUTH_TOKEN_SECRET must be a random secret with at least 32 characters.")

        if errors:
            message = "Production configuration is not safe:\n- " + "\n- ".join(errors)
            raise RuntimeError(message)


settings = Settings()
