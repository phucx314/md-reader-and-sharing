from sqlmodel import create_engine, Session
from app.config import DATABASE_URL

sqlite_file_name = "database.db"
sqlite_url = f"sqlite:///{sqlite_file_name}"
database_url = DATABASE_URL.strip() or sqlite_url
if database_url.startswith("postgresql://"):
    database_url = database_url.replace("postgresql://", "postgresql+psycopg://", 1)

connect_args = {"check_same_thread": False} if database_url.startswith("sqlite") else {}
engine = create_engine(database_url, echo=False, connect_args=connect_args)


def get_session():
    with Session(engine) as session:
        yield session
