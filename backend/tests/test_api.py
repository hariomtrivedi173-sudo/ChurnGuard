# pyrefly: ignore [missing-import]
import pytest
from fastapi.testclient import TestClient
import sys
import os

sys.path.append(os.path.join(os.path.dirname(__file__), '..'))
from main import app
from auth import hash_password, verify_password, create_access_token, decode_access_token

client = TestClient(app)

def test_password_hashing():
    pwd = "secretpassword123"
    hashed = hash_password(pwd)
    assert verify_password(pwd, hashed) is True
    assert verify_password("wrongpassword", hashed) is False

def test_jwt_token():
    payload = {"sub": "testuser@example.com"}
    token = create_access_token(payload)
    decoded = decode_access_token(token)
    assert decoded["sub"] == "testuser@example.com"

def test_health_check_docs():
    response = client.get("/docs")
    assert response.status_code == 200

def test_protected_route_requires_auth():
    response = client.get("/customers/all")
    assert response.status_code == 401
