import os
import uuid
import aiofiles
from datetime import datetime, timedelta, timezone
from typing import List, Optional
from fastapi import (
    APIRouter,
    Depends,
    HTTPException,
    status,
    UploadFile,
    File,
    Form,
    Request,
)

from sqlmodel import Session, select
from app.database import get_session
from app.models.user import User
from app.models.share import ShareLink, ShareLinkRead
from app.routers.auth import get_current_user
from app.config import UPLOAD_DIR

router = APIRouter(prefix="/api/share", tags=["share"])


@router.post("", response_model=ShareLinkRead)
async def create_share_link(
    request: Request,
    file: UploadFile = File(...),
    expires_in_hours: Optional[int] = Form(None),
    is_anonymous: bool = Form(False),
    current_user: User = Depends(get_current_user),
    session: Session = Depends(get_session),
):
    filename = file.filename
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


@router.get("/me", response_model=List[ShareLinkRead])
def get_my_links(
    request: Request,
    current_user: User = Depends(get_current_user),
    session: Session = Depends(get_session),
):
    links = session.exec(
        select(ShareLink)
        .where(ShareLink.user_id == current_user.id)
        .order_by(ShareLink.created_at.desc())
    ).all()
    base_url = str(request.base_url).rstrip("/")
    result = []
    for link in links:
        result.append(ShareLinkRead(**link.dict(), url=f"{base_url}/view/{link.token}"))
    return result


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
