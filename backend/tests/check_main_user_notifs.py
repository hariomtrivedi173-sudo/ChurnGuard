import asyncio
import os
import sys

backend_dir = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
sys.path.insert(0, backend_dir)

from database import user_collection, notification_collection

async def check_main_user():
    u = await user_collection.find_one({'email': 'hariomtrivedi173@gmail.com'})
    if not u:
        print("User not found!")
        return
    print(f"User ID: {u['_id']}, Company ID: {u.get('company_id')}, Seeded: {u.get('notifications_seeded')}")
    notifs = await notification_collection.find({'company_id': u.get('company_id')}).to_list(10)
    print(f"Total notifications found: {len(notifs)}")
    for n in notifs:
        print(f"  - [{n.get('type')}] read={n.get('read')} | {n.get('title')} | {n.get('created_at')}")

if __name__ == "__main__":
    asyncio.run(check_main_user())
