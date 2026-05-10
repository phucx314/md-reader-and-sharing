from typing import Optional
from datetime import datetime, timezone
from sqlmodel import SQLModel, Field


class ShareLink(SQLModel, table=True):
    id: Optional[int] = Field(default=None, primary_key=True)
    token: str = Field(unique=True, index=True)
    user_id: int
    file_path: str
    original_filename: str
    is_anonymous: bool = False
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))
    expires_at: Optional[datetime] = None


class ShareLinkRead(SQLModel):
    id: int
    token: str
    original_filename: str
    is_anonymous: bool
    created_at: datetime
    expires_at: Optional[datetime]
    url: str  # To be populated by the response
