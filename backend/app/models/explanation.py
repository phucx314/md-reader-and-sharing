from datetime import datetime, timezone
from typing import Optional

from sqlmodel import Field, SQLModel


def utc_now() -> datetime:
    return datetime.now(timezone.utc)


class ExplainTermRequest(SQLModel):
    selected_text: str
    context_before: str = ""
    context_after: str = ""
    paragraph: str = ""
    document_title: Optional[str] = None
    local_file_id: Optional[str] = None
    language: str = "vi"
    renew: bool = False


class ExplainTermResponse(SQLModel):
    term: str
    meaning: str
    explanation: str
    example: Optional[str] = None
    confidence: Optional[str] = None
    cached: bool = False
    daily_remaining: int


class ExplanationCache(SQLModel, table=True):
    id: Optional[int] = Field(default=None, primary_key=True)
    user_id: int = Field(index=True, foreign_key="user.id")
    local_file_id: Optional[str] = Field(default=None, index=True)
    document_title: Optional[str] = None
    selected_text: str = Field(index=True)
    selected_text_norm: str = Field(index=True)
    context_hash: str = Field(index=True)
    language: str = Field(default="vi", index=True)
    provider: str
    model: str
    meaning: str
    explanation: str
    example: Optional[str] = None
    confidence: Optional[str] = None
    created_at: datetime = Field(default_factory=utc_now)
    updated_at: datetime = Field(default_factory=utc_now)


class ExplainUsage(SQLModel, table=True):
    id: Optional[int] = Field(default=None, primary_key=True)
    user_id: int = Field(index=True, foreign_key="user.id")
    date: str = Field(index=True)
    count: int = 0
