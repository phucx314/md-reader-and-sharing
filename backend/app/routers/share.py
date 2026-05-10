import os
import uuid
import aiofiles
from datetime import datetime, timedelta, timezone
from typing import List, Optional
from pydantic import BaseModel
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
    force_new: bool = Form(False),
    local_file_id: Optional[str] = Form(None),
    current_user: User = Depends(get_current_user),
    session: Session = Depends(get_session),
):
    filename = urllib.parse.unquote(file.filename) if file.filename else ""
    if not filename or not filename.endswith(".md"):
        raise HTTPException(status_code=400, detail="Only .md files are allowed")

    if current_user.id is None:
        raise HTTPException(status_code=401, detail="Invalid user")

    now = datetime.now(timezone.utc)
    
    # Calculate the target expiration hours for the new link
    target_exp_hours = expires_in_hours if expires_in_hours else None

    # Helper function to check if an existing link matches the requested settings
    def is_same_settings(link: ShareLink) -> bool:
        if link.original_filename != filename:
            return False
        if link.is_anonymous != is_anonymous:
            return False
        if target_exp_hours is None:
            return link.expires_at is None
        if link.expires_at is None:
            return False
        # Calculate original expiry hours
        diff = (link.expires_at - link.created_at).total_seconds() / 3600
        return round(diff) == target_exp_hours

    # Base query for existing links of this user
    query = select(ShareLink).where(ShareLink.user_id == current_user.id)
    if local_file_id:
        query = query.where(ShareLink.local_file_id == local_file_id)
    else:
        query = query.where(ShareLink.original_filename == filename)

    # Only check for duplicates if NOT overwrite and NOT force_new
    if not overwrite and not force_new:
        existing_links = session.exec(query.order_by(ShareLink.created_at.desc())).all()

        existing_link = next((el for el in existing_links if is_same_settings(el)), None)

        if existing_link:
            is_expired = False
            if existing_link.expires_at:
                exp = existing_link.expires_at.replace(tzinfo=timezone.utc) if existing_link.expires_at.tzinfo is None else existing_link.expires_at
                if exp < now:
                    is_expired = True
            
            if not is_expired:
                import json
                base_url = str(request.base_url).rstrip("/")
                detail_dict = json.loads(ShareLinkRead(**existing_link.dict(), url=f"{base_url}/view/{existing_link.token}").json())
                raise HTTPException(
                    status_code=status.HTTP_409_CONFLICT,
                    detail=detail_dict
                )
    
    # If overwrite is True, delete existing links with the SAME EXACT settings
    if overwrite:
        existing_links = session.exec(query).all()
        for el in existing_links:
            if is_same_settings(el):
                if os.path.exists(el.file_path):
                    try:
                        os.remove(el.file_path)
                    except Exception:
                        pass
                session.delete(el)
        session.commit()

    token = str(uuid.uuid4())
    file_ext = os.path.splitext(filename)[1]
    secure_filename = f"{token}{file_ext}"
    file_path = os.path.join(UPLOAD_DIR, secure_filename)

    async with aiofiles.open(file_path, "wb") as out_file:
        content = await file.read()
        await out_file.write(content)

    expires_at = None
    if expires_in_hours:
        expires_at = now + timedelta(hours=expires_in_hours)

    share_link = ShareLink(
        token=token,
        user_id=current_user.id,
        file_path=file_path,
        original_filename=filename,
        local_file_id=local_file_id,
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
    local_file_id: Optional[str] = None,
    current_user: User = Depends(get_current_user),
    session: Session = Depends(get_session),
):
    query_total = select(func.count(ShareLink.id)).where(ShareLink.user_id == current_user.id)
    query_items = select(ShareLink).where(ShareLink.user_id == current_user.id)
    
    if local_file_id:
        query_total = query_total.where(ShareLink.local_file_id == local_file_id)
        query_items = query_items.where(ShareLink.local_file_id == local_file_id)
        
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


class TokenList(BaseModel):
    tokens: List[str]

@router.post("/batch-revoke", status_code=status.HTTP_204_NO_CONTENT)
def batch_revoke_links(
    body: TokenList,
    current_user: User = Depends(get_current_user),
    session: Session = Depends(get_session),
):
    links = session.exec(
        select(ShareLink).where(
            ShareLink.token.in_(body.tokens),
            ShareLink.user_id == current_user.id
        )
    ).all()

    for link in links:
        if os.path.exists(link.file_path):
            try:
                os.remove(link.file_path)
            except Exception:
                pass
        session.delete(link)

    session.commit()
    return None

@router.delete("/all", status_code=status.HTTP_204_NO_CONTENT)
def revoke_all_links(
    current_user: User = Depends(get_current_user),
    session: Session = Depends(get_session),
):
    links = session.exec(
        select(ShareLink).where(ShareLink.user_id == current_user.id)
    ).all()

    for link in links:
        if os.path.exists(link.file_path):
            try:
                os.remove(link.file_path)
            except Exception:
                pass
        session.delete(link)

    session.commit()
    return None

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
