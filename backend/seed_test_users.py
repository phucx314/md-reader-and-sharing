from sqlmodel import Session, select

from app.database import engine
from app.models.user import User
from app.security import get_password_hash


TEST_USERS = [
    {"username": "usera", "email": "usera@test.local", "password": "123"},
    {"username": "phuc", "email": "phuc@test.local", "password": "123"},
    {"username": "admin", "email": "admin@test.local", "password": "123"},
]


def seed_test_users() -> None:
    with Session(engine) as session:
        for item in TEST_USERS:
            existing = session.exec(
                select(User).where(User.username == item["username"])
            ).first()

            hashed = get_password_hash(item["password"])

            if existing:
                existing.email = item["email"]
                existing.hashed_password = hashed
                session.add(existing)
                print(f"Updated user: {item['username']}")
            else:
                user = User(
                    username=item["username"],
                    email=item["email"],
                    hashed_password=hashed,
                )
                session.add(user)
                print(f"Created user: {item['username']}")

        session.commit()
        print("Done seeding test users.")


if __name__ == "__main__":
    seed_test_users()
