import os
import uuid
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
from app.services.storage import get_storage_provider, get_storage_provider_by_name

router = APIRouter(prefix="/api/share", tags=["share"])


def resolve_object_ref(link: ShareLink) -> str:
    if link.object_key:
        return link.object_key
    if link.file_path:
        return link.file_path
    return ""


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
                object_ref = resolve_object_ref(el)
                if object_ref:
                    try:
                        storage = get_storage_provider_by_name(el.storage_provider)
                        storage.delete(object_ref=object_ref)
                    except Exception:
                        pass
                session.delete(el)
        session.commit()

    token = str(uuid.uuid4())
    file_ext = os.path.splitext(filename)[1]
    secure_filename = f"{token}{file_ext}"
    storage = get_storage_provider()
    content = await file.read()
    storage_key = os.path.join(UPLOAD_DIR, secure_filename)
    if storage.provider_name == "r2":
        storage_key = f"shares/{current_user.id}/{local_file_id or 'no-file-id'}/{secure_filename}"
    object_ref = storage.write_bytes(
        key=storage_key,
        data=content,
        content_type="text/markdown; charset=utf-8",
    )

    expires_at = None
    if expires_in_hours:
        expires_at = now + timedelta(hours=expires_in_hours)

    share_link = ShareLink(
        token=token,
        user_id=current_user.id,
        file_path=object_ref if storage.provider_name == "local" else None,
        storage_provider=storage.provider_name,
        object_key=object_ref if storage.provider_name != "local" else None,
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


class ShareStatusRequest(BaseModel):
    local_file_ids: List[str]


@router.post("/status")
def get_share_status(
    body: ShareStatusRequest,
    current_user: User = Depends(get_current_user),
    session: Session = Depends(get_session),
):
    ids = [i.strip() for i in body.local_file_ids if i and i.strip()]
    if not ids:
        return {"items": []}

    now = datetime.now(timezone.utc)
    links = session.exec(
        select(ShareLink).where(
            ShareLink.user_id == current_user.id,
            ShareLink.local_file_id.in_(ids),
        )
    ).all()

    result_map: dict[str, dict[str, bool]] = {
        i: {"ever_shared": False, "active_shared": False} for i in ids
    }
    for link in links:
        if not link.local_file_id:
            continue
        key = str(link.local_file_id)
        state = result_map.get(key)
        if not state:
            continue
        state["ever_shared"] = True
        if link.expires_at is None:
            state["active_shared"] = True
        else:
            exp = (
                link.expires_at.replace(tzinfo=timezone.utc)
                if link.expires_at.tzinfo is None
                else link.expires_at
            )
            if exp > now:
                state["active_shared"] = True

    items = [
        {
            "local_file_id": k,
            "ever_shared": v["ever_shared"],
            "active_shared": v["active_shared"],
        }
        for k, v in result_map.items()
    ]
    return {"items": items}

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
        object_ref = resolve_object_ref(link)
        if object_ref:
            try:
                storage = get_storage_provider_by_name(link.storage_provider)
                storage.delete(object_ref=object_ref)
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
        object_ref = resolve_object_ref(link)
        if object_ref:
            try:
                storage = get_storage_provider_by_name(link.storage_provider)
                storage.delete(object_ref=object_ref)
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

    object_ref = resolve_object_ref(link)
    if object_ref:
        try:
            storage = get_storage_provider_by_name(link.storage_provider)
            storage.delete(object_ref=object_ref)
        except Exception:
            pass

    session.delete(link)
    session.commit()
    return None
