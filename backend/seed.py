import os
import random
import uuid
import asyncio
from datetime import datetime, timedelta, timezone

from sqlmodel import Session, SQLModel
from app.database import engine, get_session
from app.models.user import User
from app.models.share import ShareLink
from app.security import get_password_hash
from app.config import UPLOAD_DIR

def seed_data():
    # Remove existing DB
    if os.path.exists("database.db"):
        os.remove("database.db")
        print("Deleted existing database.db")

    # Clear uploads
    for f in os.listdir(UPLOAD_DIR):
        file_path = os.path.join(UPLOAD_DIR, f)
        if os.path.isfile(file_path):
            os.remove(file_path)
    print("Cleared uploads folder")

    # Recreate tables
    SQLModel.metadata.create_all(engine)
    print("Created tables")

    with Session(engine) as session:
        # Create dummy user
        test_user = User(
            username="testuser",
            email="testuser@example.com",
            hashed_password=get_password_hash("password123")
        )
        session.add(test_user)
        session.commit()
        session.refresh(test_user)
        print("Created testuser (password: password123)")

        # Create dummy share links
        # From Jan 2026 to May 2026
        start_date = datetime(2026, 1, 1, tzinfo=timezone.utc)
        end_date = datetime(2026, 5, 10, tzinfo=timezone.utc)
        delta = end_date - start_date
        
        # We will create 10 links for a single "local_file_id" (simulating 10 versions/shares of the same file)
        # And maybe a few for another file.
        local_id_1 = str(uuid.uuid4())
        local_id_2 = str(uuid.uuid4())
        
        for i in range(15):
            random_days = random.randrange(delta.days)
            created_at = start_date + timedelta(days=random_days)
            
            token = str(uuid.uuid4())
            original_filename = "My Notes.md" if i < 10 else "Secret.md"
            local_id = local_id_1 if i < 10 else local_id_2
            file_path = os.path.join(UPLOAD_DIR, f"{token}.md")
            
            # Create a dummy markdown file
            with open(file_path, "w", encoding="utf-8") as f:
                f.write(f"# Hello from {original_filename}\\nThis is version {i}.")
                
            share_link = ShareLink(
                token=token,
                user_id=test_user.id,
                file_path=file_path,
                original_filename=original_filename,
                local_file_id=local_id,
                created_at=created_at,
                is_anonymous=(i % 3 == 0)
            )
            session.add(share_link)
        
        session.commit()
        print("Seeded 15 ShareLinks successfully.")

if __name__ == "__main__":
    seed_data()
