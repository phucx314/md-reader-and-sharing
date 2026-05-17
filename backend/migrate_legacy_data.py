import os
import sqlite3
from datetime import datetime, timezone

from sqlmodel import Session, SQLModel, create_engine, select

from app.models.user import User
from app.models.share import ShareLink
from app.models.explanation import ExplanationCache, ExplainUsage
from app.services.storage import get_storage_provider


def normalize_target_url(url: str) -> str:
    value = (url or "").strip()
    if value.startswith("postgresql://"):
        return value.replace("postgresql://", "postgresql+psycopg://", 1)
    return value


def to_dt(value):
    if value is None:
        return None
    if isinstance(value, datetime):
        return value
    text = str(value).replace("Z", "+00:00")
    try:
        return datetime.fromisoformat(text)
    except ValueError:
        return None


def ensure_target_schema(target_engine):
    SQLModel.metadata.create_all(target_engine)


def migrate_users(source_conn: sqlite3.Connection, target_session: Session):
    rows = source_conn.execute(
        "SELECT id, username, email, hashed_password FROM user"
    ).fetchall()
    for row in rows:
        existing = target_session.exec(select(User).where(User.id == row[0])).first()
        if existing:
            continue
        target_session.add(
            User(id=row[0], username=row[1], email=row[2], hashed_password=row[3])
        )
    target_session.commit()


def migrate_explain_tables(source_conn: sqlite3.Connection, target_session: Session):
    usage_rows = source_conn.execute(
        "SELECT id, user_id, date, count FROM explainusage"
    ).fetchall()
    for row in usage_rows:
        existing = target_session.exec(select(ExplainUsage).where(ExplainUsage.id == row[0])).first()
        if existing:
            continue
        target_session.add(
            ExplainUsage(id=row[0], user_id=row[1], date=row[2], count=row[3] or 0)
        )

    cache_rows = source_conn.execute(
        """
        SELECT id, user_id, local_file_id, document_title, selected_text, selected_text_norm, context_hash,
               language, provider, model, meaning, explanation, example, confidence, created_at, updated_at
        FROM explanationcache
        """
    ).fetchall()
    for row in cache_rows:
        existing = target_session.exec(select(ExplanationCache).where(ExplanationCache.id == row[0])).first()
        if existing:
            continue
        target_session.add(
            ExplanationCache(
                id=row[0],
                user_id=row[1],
                local_file_id=row[2],
                document_title=row[3],
                selected_text=row[4],
                selected_text_norm=row[5],
                context_hash=row[6],
                language=row[7] or "vi",
                provider=row[8] or "unknown",
                model=row[9] or "unknown",
                meaning=row[10] or "",
                explanation=row[11] or "",
                example=row[12],
                confidence=row[13],
                created_at=to_dt(row[14]) or datetime.now(timezone.utc),
                updated_at=to_dt(row[15]) or datetime.now(timezone.utc),
            )
        )
    target_session.commit()


def migrate_share_links(source_conn: sqlite3.Connection, target_session: Session, source_base: str):
    storage = get_storage_provider()
    now = datetime.now(timezone.utc)
    rows = source_conn.execute(
        """
        SELECT id, token, user_id, file_path, original_filename, local_file_id, is_anonymous, created_at, expires_at
        FROM sharelink
        """
    ).fetchall()
    for row in rows:
        existing = target_session.exec(select(ShareLink).where(ShareLink.id == row[0])).first()
        if existing:
            continue

        file_path = row[3]
        abs_path = file_path if os.path.isabs(file_path or "") else os.path.join(source_base, file_path or "")
        object_key = None
        stored_path = None
        provider_name = storage.provider_name

        if abs_path and os.path.exists(abs_path):
            with open(abs_path, "rb") as f:
                data = f.read()
            ext = os.path.splitext(row[4] or "")[1] or ".md"
            target_key = abs_path
            if provider_name == "r2":
                target_key = f"shares/{row[2]}/{row[5] or 'no-file-id'}/{row[1]}{ext}"
            stored_ref = storage.write_bytes(
                key=target_key,
                data=data,
                content_type="text/markdown; charset=utf-8",
            )
            if provider_name == "local":
                stored_path = stored_ref
            else:
                object_key = stored_ref
        else:
            # Keep metadata even if file is missing; preserve legacy path for diagnostics.
            provider_name = "local"
            stored_path = file_path

        target_session.add(
            ShareLink(
                id=row[0],
                token=row[1],
                user_id=row[2],
                file_path=stored_path,
                storage_provider=provider_name,
                object_key=object_key,
                original_filename=row[4],
                local_file_id=row[5],
                is_anonymous=bool(row[6]),
                created_at=to_dt(row[7]) or now,
                expires_at=to_dt(row[8]),
            )
        )
    target_session.commit()


def main():
    source_sqlite = os.environ.get("SOURCE_SQLITE_PATH", os.path.abspath("database.db"))
    target_url = normalize_target_url(os.environ.get("TARGET_DATABASE_URL", ""))
    source_base = os.environ.get("SOURCE_BASE_DIR", os.path.abspath("."))

    if not os.path.exists(source_sqlite):
        raise RuntimeError(f"Source sqlite file not found: {source_sqlite}")
    if not target_url:
        raise RuntimeError("TARGET_DATABASE_URL is required")

    source_conn = sqlite3.connect(source_sqlite)
    target_engine = create_engine(target_url, echo=False)
    ensure_target_schema(target_engine)

    with Session(target_engine) as target_session:
        migrate_users(source_conn, target_session)
        migrate_explain_tables(source_conn, target_session)
        migrate_share_links(source_conn, target_session, source_base=source_base)

    source_conn.close()
    print("Migration completed.")


if __name__ == "__main__":
    main()

