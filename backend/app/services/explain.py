import hashlib
from datetime import datetime, timezone

from fastapi import HTTPException, status
from sqlmodel import Session, select

from app.config import EXPLAIN_DAILY_LIMIT
from app.models.explanation import (
    ExplainTermRequest,
    ExplainTermResponse,
    ExplainUsage,
    ExplanationCache,
)
from app.models.user import User
from app.services.llm_providers import ExplainProvider


def normalize_selected_text(value: str) -> str:
    return " ".join(value.strip().lower().split())


def build_context_window(req: ExplainTermRequest) -> str:
    parts = []
    if req.context_before.strip():
        parts.append(req.context_before.strip())
    if req.paragraph.strip():
        parts.append(req.paragraph.strip())
    if req.context_after.strip():
        parts.append(req.context_after.strip())
    return "\n\n".join(parts).strip()[:5000]


def context_hash(req: ExplainTermRequest) -> str:
    payload = "\n\n".join(
        [
            req.context_before.strip(),
            req.paragraph.strip(),
            req.context_after.strip(),
            req.document_title or "",
        ]
    )
    return hashlib.sha256(payload.encode("utf-8")).hexdigest()


def today_key() -> str:
    return datetime.now(timezone.utc).date().isoformat()


def get_usage(session: Session, user_id: int, date_key: str | None = None) -> ExplainUsage | None:
    return session.exec(
        select(ExplainUsage).where(
            ExplainUsage.user_id == user_id,
            ExplainUsage.date == (date_key or today_key()),
        )
    ).first()


def get_daily_remaining(session: Session, user_id: int, limit: int = EXPLAIN_DAILY_LIMIT) -> int:
    usage = get_usage(session, user_id)
    return max(0, limit - (usage.count if usage else 0))


def get_cache(
    session: Session,
    *,
    user_id: int,
    selected_text_norm: str,
    context_hash_value: str,
    local_file_id: str | None,
    language: str,
) -> ExplanationCache | None:
    return session.exec(
        select(ExplanationCache).where(
            ExplanationCache.user_id == user_id,
            ExplanationCache.selected_text_norm == selected_text_norm,
            ExplanationCache.context_hash == context_hash_value,
            ExplanationCache.local_file_id == local_file_id,
            ExplanationCache.language == language,
        )
    ).first()


def increment_usage_or_raise(session: Session, user_id: int, limit: int = EXPLAIN_DAILY_LIMIT) -> ExplainUsage:
    date_key = today_key()
    usage = get_usage(session, user_id, date_key)
    if usage is None:
        usage = ExplainUsage(user_id=user_id, date=date_key, count=0)
    if usage.count >= limit:
        raise HTTPException(
            status_code=status.HTTP_429_TOO_MANY_REQUESTS,
            detail=f"Daily explanation limit reached ({limit}/day)",
        )
    usage.count += 1
    session.add(usage)
    return usage


def response_from_cache(cache: ExplanationCache, session: Session) -> ExplainTermResponse:
    return ExplainTermResponse(
        term=cache.selected_text,
        meaning=cache.meaning,
        explanation=cache.explanation,
        example=cache.example,
        confidence=cache.confidence,
        cached=True,
        daily_remaining=get_daily_remaining(session, cache.user_id),
    )


def explain_term(
    *,
    session: Session,
    current_user: User,
    req: ExplainTermRequest,
    provider: ExplainProvider,
    limit: int = EXPLAIN_DAILY_LIMIT,
) -> ExplainTermResponse:
    if current_user.id is None:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid user")

    selected = req.selected_text.strip()
    selected_norm = normalize_selected_text(selected)
    if not selected_norm:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="selected_text is required")

    ctx = build_context_window(req)
    if not ctx:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Context is required")

    hash_value = context_hash(req)
    cached = get_cache(
        session,
        user_id=current_user.id,
        selected_text_norm=selected_norm,
        context_hash_value=hash_value,
        local_file_id=req.local_file_id,
        language=req.language,
    )
    if cached and not req.renew:
        return response_from_cache(cached, session)

    usage = increment_usage_or_raise(session, current_user.id, limit)
    result = provider.explain(selected_text=selected, context=ctx, language=req.language)

    now = datetime.now(timezone.utc)
    cache = cached or ExplanationCache(
        user_id=current_user.id,
        local_file_id=req.local_file_id,
        document_title=req.document_title,
        selected_text=selected,
        selected_text_norm=selected_norm,
        context_hash=hash_value,
        language=req.language,
        provider=provider.provider_name,
        model=provider.model,
        meaning=result.meaning,
        explanation=result.explanation,
    )
    cache.document_title = req.document_title
    cache.selected_text = selected
    cache.provider = provider.provider_name
    cache.model = provider.model
    cache.meaning = result.meaning
    cache.explanation = result.explanation
    cache.example = result.example
    cache.confidence = result.confidence
    cache.updated_at = now

    session.add(cache)
    session.add(usage)
    session.commit()
    session.refresh(cache)

    return ExplainTermResponse(
        term=cache.selected_text,
        meaning=cache.meaning,
        explanation=cache.explanation,
        example=cache.example,
        confidence=cache.confidence,
        cached=False,
        daily_remaining=max(0, limit - usage.count),
    )
