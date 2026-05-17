import os
from dotenv import load_dotenv

load_dotenv()

SECRET_KEY = os.environ.get("SECRET_KEY", "")
if not SECRET_KEY:
    raise RuntimeError("SECRET_KEY environment variable is not set. Create a backend/.env file from .env.example.")
ALGORITHM = "HS256"
ACCESS_TOKEN_EXPIRE_MINUTES = 60 * 24 * 7  # 7 days
DATABASE_URL = os.environ.get("DATABASE_URL", "")

UPLOAD_DIR = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", "uploads"))

# Ensure upload directory exists
os.makedirs(UPLOAD_DIR, exist_ok=True)

STORAGE_PROVIDER = os.environ.get("STORAGE_PROVIDER", "local").lower()
R2_ACCOUNT_ID = os.environ.get("R2_ACCOUNT_ID", "")
R2_ACCESS_KEY_ID = os.environ.get("R2_ACCESS_KEY_ID", "")
R2_SECRET_ACCESS_KEY = os.environ.get("R2_SECRET_ACCESS_KEY", "")
R2_BUCKET = os.environ.get("R2_BUCKET", "")
R2_REGION = os.environ.get("R2_REGION", "auto")
R2_ENDPOINT = os.environ.get("R2_ENDPOINT", "")
R2_PUBLIC_BASE_URL = os.environ.get("R2_PUBLIC_BASE_URL", "")

LLM_PROVIDER = os.environ.get("LLM_PROVIDER", "openai").lower()
LLM_MODEL = os.environ.get("LLM_MODEL", "gpt-4.1-nano")
OPENAI_MODEL = os.environ.get("OPENAI_MODEL", LLM_MODEL)
ANTHROPIC_MODEL = os.environ.get("ANTHROPIC_MODEL", "claude-3-5-haiku-latest")
GEMINI_MODEL = os.environ.get("GEMINI_MODEL", "gemini-2.5-flash-lite")
OPENAI_BASE_URL = os.environ.get("OPENAI_BASE_URL", "https://api.openai.com/v1")
ANTHROPIC_BASE_URL = os.environ.get("ANTHROPIC_BASE_URL", "https://api.anthropic.com")
LLM_API_KEY = os.environ.get("LLM_API_KEY", "")
OPENAI_API_KEY = os.environ.get("OPENAI_API_KEY", LLM_API_KEY)
ANTHROPIC_API_KEY = os.environ.get("ANTHROPIC_API_KEY", "")
GEMINI_API_KEY = os.environ.get("GEMINI_API_KEY", "")
EXPLAIN_DAILY_LIMIT = int(os.environ.get("EXPLAIN_DAILY_LIMIT", "20"))
