import os
import certifi
import asyncio
import logging
from typing import Optional, Any, Dict, List
from motor.motor_asyncio import AsyncIOMotorClient
from dotenv import load_dotenv

logger = logging.getLogger(__name__)

# Load .env from backend directory or fallback to current directory
_backend_dir = os.path.dirname(os.path.abspath(__file__))
_env_path = os.path.join(_backend_dir, ".env")
if os.path.exists(_env_path):
    load_dotenv(dotenv_path=_env_path, override=True)
else:
    load_dotenv(override=True)

# Module-level environment configuration with explicit type definitions
MONGO_URI: str = os.getenv("MONGO_URI", "").strip()
DB_NAME: str = os.getenv("DB_NAME", "churnguard").strip() or "churnguard"

_client: Optional[AsyncIOMotorClient] = None
_client_loop: Optional[asyncio.AbstractEventLoop] = None


def get_client() -> AsyncIOMotorClient:
    global _client, _client_loop, MONGO_URI, DB_NAME
    try:
        current_loop = asyncio.get_running_loop()
    except RuntimeError:
        current_loop = None

    if not MONGO_URI:
        if os.path.exists(_env_path):
            load_dotenv(dotenv_path=_env_path, override=True)
        else:
            load_dotenv(override=True)
        MONGO_URI = os.getenv("MONGO_URI", "").strip()
        DB_NAME = os.getenv("DB_NAME", "churnguard").strip() or "churnguard"

    if not MONGO_URI:
        raise RuntimeError(
            "CRITICAL: 'MONGO_URI' is not configured in backend/.env. "
            "Refusing to fall back to an accidental local MongoDB instance. "
            "Please configure your MongoDB Atlas connection string in backend/.env."
        )

    # Safely inspect loop state without triggering Pylance member access warnings
    io_loop = getattr(_client, "io_loop", None) if _client is not None else None
    is_closed = getattr(io_loop, "is_closed", lambda: False)() if io_loop is not None else False

    if _client is None or current_loop != _client_loop or is_closed:
        client_kwargs: Dict[str, Any] = {
            "serverSelectionTimeoutMS": 8000,
            "connectTimeoutMS": 5000,
            "socketTimeoutMS": 10000,
        }
        if "mongodb+srv" in MONGO_URI or "ssl=true" in MONGO_URI.lower() or "tls=true" in MONGO_URI.lower():
            client_kwargs["tlsCAFile"] = certifi.where()

        _client = AsyncIOMotorClient(MONGO_URI, **client_kwargs)
        _client_loop = current_loop

    return _client


async def check_db_connection() -> Dict[str, Any]:
    """Verify live connectivity and access to MongoDB Atlas."""
    client = get_client()
    await client.admin.command("ping")
    db = client[DB_NAME]
    collections: List[str] = await db.list_collection_names()
    return {
        "connected": True,
        "database": DB_NAME,
        "collections": collections,
    }


class LazyDatabase:
    def __getitem__(self, item: str) -> "LazyCollection":
        return LazyCollection(item)

    def __getattr__(self, item: str) -> Any:
        client = get_client()
        return getattr(client[DB_NAME], item)

    def command(self, *args: Any, **kwargs: Any) -> Any:
        client = get_client()
        return client[DB_NAME].command(*args, **kwargs)


class LazyCollection:
    def __init__(self, name: str) -> None:
        self.name = name

    def __getattr__(self, attr: str) -> Any:
        client = get_client()
        db = client[DB_NAME]
        coll = db[self.name]
        return getattr(coll, attr)


database = LazyDatabase()
customer_collection = LazyCollection("customers")
user_collection = LazyCollection("users")
telco_collection = LazyCollection("telco_customers")
notification_collection = LazyCollection("notifications")
otp_collection = LazyCollection("otp_codes")
upload_collection = LazyCollection("dataset_uploads")
password_reset_collection = LazyCollection("password_resets")
