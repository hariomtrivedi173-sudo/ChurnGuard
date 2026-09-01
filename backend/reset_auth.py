"""
ChurnGuard - Safe Authentication Reset Script
Resets ONLY development/test authentication records (users, otp_codes, notifications).
NEVER touches customer data, telco_customers (ML dataset), dataset_uploads, dashboard_cache, or ML models.
"""

import os
import sys
import asyncio
import certifi
from motor.motor_asyncio import AsyncIOMotorClient
from dotenv import load_dotenv

# Load environment variables
_backend_dir = os.path.dirname(os.path.abspath(__file__))
_env_path = os.path.join(_backend_dir, ".env")
if os.path.exists(_env_path):
    load_dotenv(dotenv_path=_env_path, override=True)
else:
    load_dotenv(override=True)

MONGO_URI = os.getenv("MONGO_URI")
DB_NAME = os.getenv("DB_NAME", "churnguard")


async def reset_auth_data(auto_confirm: bool = False):
    if not MONGO_URI:
        print("[ERROR] MONGO_URI is not set in .env file.")
        sys.exit(1)

    client = AsyncIOMotorClient(MONGO_URI, tlsCAFile=certifi.where())
    db = client[DB_NAME]

    print("=" * 65)
    print("       ChurnGuard - Development Authentication Data Reset")
    print("=" * 65)

    # 1. Inspect existing collections
    collections = await db.list_collection_names()
    print(f"Connected to database: '{DB_NAME}'")
    print(f"Collections found in database: {', '.join(sorted(collections))}\n")

    # Document counts before reset
    user_count = await db["users"].count_documents({}) if "users" in collections else 0
    otp_count = await db["otp_codes"].count_documents({}) if "otp_codes" in collections else 0
    notif_count = await db["notifications"].count_documents({}) if "notifications" in collections else 0

    cust_count = await db["customers"].count_documents({}) if "customers" in collections else 0
    telco_count = await db["telco_customers"].count_documents({}) if "telco_customers" in collections else 0
    upload_count = await db["dataset_uploads"].count_documents({}) if "dataset_uploads" in collections else 0
    cache_count = await db["dashboard_cache"].count_documents({}) if "dashboard_cache" in collections else 0

    print("Authentication Collections (TO BE RESET):")
    print(f"  • users:          {user_count} document(s)")
    print(f"  • otp_codes:      {otp_count} document(s)")
    print(f"  • notifications:  {notif_count} document(s)")
    print("\nBusiness & ML Collections (WILL BE PRESERVED INTACT):")
    print(f"  • customers:       {cust_count} document(s)")
    print(f"  • telco_customers: {telco_count} document(s)")
    print(f"  • dataset_uploads: {upload_count} document(s)")
    print(f"  • dashboard_cache: {cache_count} document(s)")
    print("-" * 65)

    if not auto_confirm:
        print("\nWARNING: This will delete all authentication users, OTPs, and sessions.")
        user_input = input("Type RESET AUTH to continue: ").strip()
        if user_input != "RESET AUTH":
            print("\nReset cancelled. Confirmation phrase did not match. No data was deleted.")
            return

    print("\nAuthentication reset started...\n")

    # 2. Perform safe deletion of auth collections only
    res_users = await db["users"].delete_many({}) if "users" in collections else type('obj', (), {'deleted_count': 0})
    res_otps = await db["otp_codes"].delete_many({}) if "otp_codes" in collections else type('obj', (), {'deleted_count': 0})
    res_notifs = await db["notifications"].delete_many({}) if "notifications" in collections else type('obj', (), {'deleted_count': 0})

    # Re-verify preserved counts
    cust_post = await db["customers"].count_documents({}) if "customers" in collections else 0
    telco_post = await db["telco_customers"].count_documents({}) if "telco_customers" in collections else 0
    upload_post = await db["dataset_uploads"].count_documents({}) if "dataset_uploads" in collections else 0
    cache_post = await db["dashboard_cache"].count_documents({}) if "dashboard_cache" in collections else 0

    print(f"Users deleted: {res_users.deleted_count}")
    print(f"OTP records deleted: {res_otps.deleted_count}")
    print(f"Notifications deleted: {res_notifs.deleted_count}")
    print()
    print(f"Customer data: NOT MODIFIED (retained {cust_post} records)")
    print(f"ML data (telco_customers): NOT MODIFIED (retained {telco_post} records)")
    print(f"Dataset uploads: NOT MODIFIED (retained {upload_post} records)")
    print(f"Dashboard cache: NOT MODIFIED (retained {cache_post} records)")
    print()
    print("Authentication reset completed.")
    print("=" * 65)


if __name__ == "__main__":
    auto = "--force" in sys.argv or "--yes" in sys.argv or "-y" in sys.argv
    asyncio.run(reset_auth_data(auto_confirm=auto))
