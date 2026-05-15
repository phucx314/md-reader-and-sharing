from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
import uvicorn
from contextlib import asynccontextmanager

from app.database import engine
from sqlmodel import SQLModel

# Import models so they are registered with SQLModel metadata before creating tables

from app.routers import auth, explain, share, view
import asyncio
import os
from datetime import datetime, timezone, timedelta
from sqlmodel import Session, select
from app.models.share import ShareLink
from app.models.explanation import ExplanationCache, ExplainUsage  # noqa: F401

async def cleanup_expired_links():
    while True:
        try:
            now = datetime.now(timezone.utc)
            cutoff = now - timedelta(days=7)
            
            with Session(engine) as session:
                expired_links = session.exec(
                    select(ShareLink).where(ShareLink.expires_at < cutoff)
                ).all()
                
                for link in expired_links:
                    if os.path.exists(link.file_path):
                        try:
                            os.remove(link.file_path)
                        except Exception:
                            pass
                    session.delete(link)
                session.commit()
        except Exception as e:
            print(f"Cleanup task error: {e}")
            
        # Sleep for 1 hour
        await asyncio.sleep(3600)


@asynccontextmanager
async def lifespan(app: FastAPI):
    # Startup: create db tables
    SQLModel.metadata.create_all(engine)
    
    # Start cleanup task
    task = asyncio.create_task(cleanup_expired_links())
    
    yield
    # Shutdown logic if any
    task.cancel()


app = FastAPI(title="MD Reader & Sharing API", lifespan=lifespan)

# Allow React Native app (usually from LAN or specific origins)
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # For dev. In prod, restrict this.
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(auth.router)
app.include_router(share.router)
app.include_router(explain.router)
app.include_router(view.router)


@app.get("/")
def read_root():
    return {"message": "Welcome to MD Reader & Sharing API"}

@app.get("/api/wakeup")
def wakeup():
    return {
        "ok": True,
        "message": "awake",
        "timestamp": datetime.now(timezone.utc).isoformat(),
    }


if __name__ == "__main__":
    uvicorn.run("app.main:app", host="0.0.0.0", port=8000, reload=True)
