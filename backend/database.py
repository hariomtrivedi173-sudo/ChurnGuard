import os
import certifi
from motor.motor_asyncio import AsyncIOMotorClient
from dotenv import load_dotenv

load_dotenv()

MONGO_URI = os.getenv("MONGO_URI")
DB_NAME = os.getenv("DB_NAME")

client = AsyncIOMotorClient(MONGO_URI, tlsCAFile=certifi.where())
database = client[DB_NAME]
customer_collection = database["customers"]
user_collection = database["users"]
telco_collection = database["telco_customers"]