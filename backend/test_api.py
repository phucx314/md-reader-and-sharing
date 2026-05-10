import asyncio
from sqlmodel import Session, select
from app.database import engine
from app.models.share import ShareLink

def check_db():
    with Session(engine) as session:
        links = session.exec(select(ShareLink)).all()
        print(f"Total links in DB: {len(links)}")
        for l in links:
            print(f"Token: {l.token}, File ID: {l.local_file_id}, Anon: {l.is_anonymous}")

if __name__ == "__main__":
    check_db()
