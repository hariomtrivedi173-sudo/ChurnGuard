import sys
import os
sys.path.append(os.path.join(os.path.dirname(__file__), '..'))

import asyncio
import database

async def main():
    client = database.get_client()
    db = client[database.DB_NAME]
    users = await db['users'].find({}, {'email': 1, 'company': 1, 'company_id': 1}).to_list(100)
    print("=== Users in DB ===")
    for u in users:
        c_count = await db['telco_customers'].count_documents({'company_id': u.get('company_id')})
        u_count = await db['dataset_uploads'].count_documents({'company_id': u.get('company_id')})
        print(f"{u.get('email')} | company: {u.get('company')} | company_id: {u.get('company_id')} | customers: {c_count} | uploads: {u_count}")

if __name__ == "__main__":
    asyncio.run(main())
