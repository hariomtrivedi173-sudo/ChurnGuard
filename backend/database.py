import os
import certifi
import asyncio
from motor.motor_asyncio import AsyncIOMotorClient
from dotenv import load_dotenv
# Load .env from backend directory or fallback to current directory
_backend_dir = os.path.dirname(os.path.abspath(__file__))
_env_path = os.path.join(_backend_dir, ".env")
if os.path.exists(_env_path):
    load_dotenv(dotenv_path=_env_path, override=True)
else:
    load_dotenv(override=True)

MONGO_URI = os.getenv("MONGO_URI")
DB_NAME = os.getenv("DB_NAME")

_client = None
_client_loop = None

def get_client():
    global _client, _client_loop
    try:
        current_loop = asyncio.get_running_loop()
    except RuntimeError:
        current_loop = None

    if _client is None or current_loop != _client_loop or (_client.io_loop and _client.io_loop.is_closed()):
        _client = AsyncIOMotorClient(MONGO_URI, tlsCAFile=certifi.where())
        _client_loop = current_loop
    return _client

class LazyDatabase:
    def __getitem__(self, item):
        return LazyCollection(item)
    def __getattr__(self, item):
        client = get_client()
        return getattr(client[DB_NAME], item)

class LazyCollection:
    def __init__(self, name):
        self.name = name

    def __getattr__(self, attr):
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