import os
from datetime import datetime, timezone
import markdown
from typing import Optional
from fastapi import APIRouter, Depends, HTTPException
from fastapi.responses import HTMLResponse, FileResponse, Response
from sqlmodel import Session, select
from app.database import get_session
from app.models.share import ShareLink
from app.models.user import User

router = APIRouter(prefix="/view", tags=["view"])


def get_valid_link(token: str, session: Session) -> tuple[ShareLink, Optional[User]]:
    link = session.exec(select(ShareLink).where(ShareLink.token == token)).first()
    if not link:
        raise HTTPException(status_code=404, detail="Link not found")

    if link.expires_at:
        expires_at = link.expires_at.replace(tzinfo=timezone.utc) if link.expires_at.tzinfo is None else link.expires_at
        if expires_at < datetime.now(timezone.utc):
            raise HTTPException(status_code=410, detail="Link has expired")

    if not os.path.exists(link.file_path):
        raise HTTPException(status_code=404, detail="File no longer exists on server")

    user = session.exec(select(User).where(User.id == link.user_id)).first()
    return link, user


@router.get("/{token}", response_class=HTMLResponse)
async def view_markdown_html(token: str, session: Session = Depends(get_session)):
    link, user = get_valid_link(token, session)

    with open(link.file_path, "r", encoding="utf-8") as f:
        md_content = f.read()

    html_content = markdown.markdown(
        md_content, extensions=["fenced_code", "tables", "nl2br"]
    )

    author_info = ""
    if not link.is_anonymous and user:
        author_info = (
            f"<p class='author'>Shared by: <strong>{user.username}</strong></p>"
        )

    # Neo-Brutalism styling for the web view
    html = f"""
    <!DOCTYPE html>
    <html lang="en">
    <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>{link.original_filename} - MD Reader</title>
        <style>
            @import url('https://fonts.googleapis.com/css2?family=Space+Grotesk:wght@400;600;700&display=swap');
            
            :root {{
                --bg: #FFFFFF;
                --text: #111111;
                --primary: #FFE500;
                --border: #111111;
            }}
            
            body {{
                font-family: 'Space Grotesk', sans-serif;
                background-color: var(--bg);
                color: var(--text);
                line-height: 1.6;
                padding: 2rem;
                max-width: 800px;
                margin: 0 auto;
            }}
            
            .header {{
                border-bottom: 3px solid var(--border);
                margin-bottom: 2rem;
                padding-bottom: 1rem;
                display: flex;
                justify-content: space-between;
                align-items: center;
            }}
            
            .author {{
                font-size: 0.9rem;
                background-color: var(--primary);
                padding: 0.5rem 1rem;
                border: 2px solid var(--border);
                box-shadow: 4px 4px 0 var(--border);
                display: inline-block;
            }}
            
            .content {{
                background-color: #F5F5F5;
                padding: 2rem;
                border: 3px solid var(--border);
                box-shadow: 6px 6px 0 var(--border);
            }}
            
            .download-btn {{
                background-color: var(--primary);
                color: var(--text);
                text-decoration: none;
                padding: 0.5rem 1rem;
                border: 2px solid var(--border);
                box-shadow: 4px 4px 0 var(--border);
                font-weight: bold;
                transition: transform 0.1s;
            }}
            
            .download-btn:active {{
                transform: translate(2px, 2px);
                box-shadow: 2px 2px 0 var(--border);
            }}
            
            pre {{
                background-color: #111;
                color: #fff;
                padding: 1rem;
                border-radius: 4px;
                overflow-x: auto;
            }}
            
            code {{
                font-family: monospace;
            }}
            
            img {{
                max-width: 100%;
                border: 2px solid var(--border);
            }}
        </style>
    </head>
    <body>
        <div class="header">
            <div>
                <h1>{link.original_filename}</h1>
                {author_info}
            </div>
            <a href="/view/{token}/raw" class="download-btn">Download .md</a>
        </div>
        <div class="content">
            {html_content}
        </div>
    </body>
    </html>
    """
    return HTMLResponse(content=html)


@router.get("/{token}/raw")
async def download_markdown_raw(token: str, session: Session = Depends(get_session)):
    link, _ = get_valid_link(token, session)
    
    with open(link.file_path, "rb") as f:
        content = f.read()
        
    # Prepend UTF-8 BOM for Windows compatibility
    if not content.startswith(b'\xef\xbb\xbf'):
        content = b'\xef\xbb\xbf' + content
        
    return Response(
        content=content,
        media_type="text/markdown; charset=utf-8",
        headers={"Content-Disposition": f'attachment; filename="{link.original_filename}"'}
    )
