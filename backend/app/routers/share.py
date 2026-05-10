import os
import uuid
import aiofiles
from datetime import datetime, timedelta, timezone
from typing import List, Optional
from fastapi import (
    APIRouter,
    Depends,
    HTTPException,
    UploadFile,
    File,
    Form,
    status,
    Request,
)

import urllib.parse
from sqlmodel import Session, select, func, or_
from app.database import get_session
from app.models.user import User
from app.models.share import ShareLink, ShareLinkRead, PaginatedShareLinks
from app.routers.auth import get_current_user
from app.config import UPLOAD_DIR

router = APIRouter(prefix="/api/share", tags=["share"])


@router.post("", response_model=ShareLinkRead)
async def create_share_link(
    request: Request,
    file: UploadFile = File(...),
    expires_in_hours: Optional[int] = Form(None),
    is_anonymous: bool = Form(False),
    overwrite: bool = Form(False),
    current_user: User = Depends(get_current_user),
    session: Session = Depends(get_session),
):
    filename = urllib.parse.unquote(file.filename) if file.filename else ""
    if not filename or not filename.endswith(".md"):
        raise HTTPException(status_code=400, detail="Only .md files are allowed")

    if current_user.id is None:
        raise HTTPException(status_code=401, detail="Invalid user")

    token = str(uuid.uuid4())
    file_ext = os.path.splitext(filename)[1]
    secure_filename = f"{token}{file_ext}"
    file_path = os.path.join(UPLOAD_DIR, secure_filename)

    async with aiofiles.open(file_path, "wb") as out_file:
        content = await file.read()
        await out_file.write(content)

    expires_at = None
    if expires_in_hours:
        expires_at = datetime.now(timezone.utc) + timedelta(hours=expires_in_hours)

    now = datetime.now(timezone.utc)
    
    if not overwrite:
        existing_link = session.exec(
            select(ShareLink)
            .where(
                ShareLink.user_id == current_user.id,
                ShareLink.original_filename == filename,
                ShareLink.is_anonymous == is_anonymous
            )
            .order_by(ShareLink.created_at.desc())
        ).first()

        if existing_link:
            is_expired = False
            if existing_link.expires_at:
                exp = existing_link.expires_at.replace(tzinfo=timezone.utc) if existing_link.expires_at.tzinfo is None else existing_link.expires_at
                if exp < now:
                    is_expired = True
            
            if not is_expired:
                base_url = str(request.base_url).rstrip("/")
                raise HTTPException(
                    status_code=status.HTTP_409_CONFLICT,
                    detail=ShareLinkRead(**existing_link.dict(), url=f"{base_url}/view/{existing_link.token}").dict()
                )
    else:
        existing_links = session.exec(
            select(ShareLink)
            .where(
                ShareLink.user_id == current_user.id,
                ShareLink.original_filename == filename,
                ShareLink.is_anonymous == is_anonymous
            )
        ).all()
        for el in existing_links:
            if os.path.exists(el.file_path):
                try:
                    os.remove(el.file_path)
                except Exception:
                    pass
            session.delete(el)
        session.commit()

    share_link = ShareLink(
        token=token,
        user_id=current_user.id,
        file_path=file_path,
        original_filename=filename,
        is_anonymous=is_anonymous,
        expires_at=expires_at,
    )

    session.add(share_link)
    session.commit()
    session.refresh(share_link)

    base_url = str(request.base_url).rstrip("/")
    return ShareLinkRead(**share_link.dict(), url=f"{base_url}/view/{token}")


@router.get("/me", response_model=PaginatedShareLinks)
def get_my_links(
    request: Request,
    skip: int = 0,
    limit: int = 10,
    filename: Optional[str] = None,
    fallback: Optional[str] = None,
    current_user: User = Depends(get_current_user),
    session: Session = Depends(get_session),
):
    query_total = select(func.count(ShareLink.id)).where(ShareLink.user_id == current_user.id)
    query_items = select(ShareLink).where(ShareLink.user_id == current_user.id)
    
    if filename:
        decoded_filename = urllib.parse.unquote(filename)
        filters = [ShareLink.original_filename == decoded_filename]
        if fallback:
            decoded_fallback = urllib.parse.unquote(fallback)
            if decoded_fallback != decoded_filename:
                filters.append(ShareLink.original_filename == decoded_fallback)
        
        query_total = query_total.where(or_(*filters))
        query_items = query_items.where(or_(*filters))
        
    total = session.exec(query_total).one()
    links = session.exec(
        query_items
        .order_by(ShareLink.created_at.desc())
        .offset(skip)
        .limit(limit)
    ).all()
    
    base_url = str(request.base_url).rstrip("/")
    items = []
    for link in links:
        items.append(ShareLinkRead(**link.dict(), url=f"{base_url}/view/{link.token}"))
        
    return PaginatedShareLinks(total=total, items=items)


@router.delete("/{token}", status_code=status.HTTP_204_NO_CONTENT)
def revoke_link(
    token: str,
    current_user: User = Depends(get_current_user),
    session: Session = Depends(get_session),
):
    link = session.exec(
        select(ShareLink).where(
            ShareLink.token == token, ShareLink.user_id == current_user.id
        )
    ).first()
    if not link:
        raise HTTPException(
            status_code=404, detail="Link not found or not owned by you"
        )

    # Delete file
    if os.path.exists(link.file_path):
        os.remove(link.file_path)

    session.delete(link)
    session.commit()
    return None
