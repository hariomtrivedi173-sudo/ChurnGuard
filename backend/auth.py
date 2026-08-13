import os
import re
from datetime import datetime, timedelta
from passlib.context import CryptContext
from jose import jwt
from dotenv import load_dotenv
from fastapi import Depends, HTTPException, status
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from database import user_collection

load_dotenv()

SECRET_KEY = os.getenv("SECRET_KEY", "your-super-secret-random-string-change-this-later")
ALGORITHM = "HS256"
ACCESS_TOKEN_EXPIRE_MINUTES = 60 * 24

pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")

security_scheme = HTTPBearer()


def hash_password(password: str) -> str:
    return pwd_context.hash(password)


def verify_password(plain_password: str, hashed_password: str) -> bool:
    return pwd_context.verify(plain_password, hashed_password)


def create_access_token(data: dict) -> str:
    to_encode = data.copy()
    expire = datetime.utcnow() + timedelta(minutes=ACCESS_TOKEN_EXPIRE_MINUTES)
    to_encode.update({"exp": expire})
    return jwt.encode(to_encode, SECRET_KEY, algorithm=ALGORITHM)


def decode_access_token(token: str):
    try:
        return jwt.decode(token, SECRET_KEY, algorithms=[ALGORITHM])
    except Exception:
        return None


def get_company_id_for_name(company_name: str, email: str) -> str:
    name_str = company_name.strip() if company_name else ""
    if not name_str:
        name_str = email.split("@")[0]
    clean_slug = re.sub(r'[^a-zA-Z0-9]', '_', name_str.lower()).strip('_')
    return f"comp_{clean_slug}"


async def get_current_user_doc(credentials: HTTPAuthorizationCredentials = Depends(security_scheme)) -> dict:
    token = credentials.credentials
    payload = decode_access_token(token)
    if payload is None:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid or expired token"
        )
    email = payload.get("sub")
    if not email:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid token payload"
        )
    user_doc = await user_collection.find_one({"email": email})
    if not user_doc:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="User not found"
        )

    if not user_doc.get("company_id"):
        company_id = get_company_id_for_name(user_doc.get("company", ""), user_doc.get("email", ""))
        await user_collection.update_one({"_id": user_doc["_id"]}, {"$set": {"company_id": company_id}})
        user_doc["company_id"] = company_id

    return user_doc


def get_current_user(credentials: HTTPAuthorizationCredentials = Depends(security_scheme)) -> str:
    token = credentials.credentials
    payload = decode_access_token(token)
    if payload is None:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid or expired token"
        )
    email = payload.get("sub")
    if not email:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid token payload"
        )
    return email