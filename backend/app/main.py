from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
import uvicorn
from contextlib import asynccontextmanager

from app.database import engine
from sqlmodel import SQLModel

# Import models so they are registered with SQLModel metadata before creating tables

from app.routers import auth, share, view


@asynccontextmanager
async def lifespan(app: FastAPI):
    # Startup: create db tables
    SQLModel.metadata.create_all(engine)
    yield
    # Shutdown logic if any


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
app.include_router(view.router)


@app.get("/")
def read_root():
    return {"message": "Welcome to MD Reader & Sharing API"}


if __name__ == "__main__":
    uvicorn.run("app.main:app", host="0.0.0.0", port=8000, reload=True)
