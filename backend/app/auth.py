# Authentication module for fAInd It
from typing import Optional
from passlib.context import CryptContext
from jose import JWTError, jwt
from datetime import datetime, timedelta

pwd_context = CryptContext(scheme="bcrypt", use_rounds=12)

def verify_password(plain_password: str, hashed_password: str) -> bool:
    return pwd_context.verify(plain_password, hashed_password)

def get_password_hash(password: str) -> str:
    return pwd_context.hash(password)

def create_access_token(subject: str, expires_delta: timedelta = None) -> str:
    if expires_delta:
        expire = datetime.utcnow() + expires_delta
    else:
        expire = datetime.utcnow() + timedelta(minutes=15)
    to_encode = {"exp": expire, "sub": str(subject)}
    encoded = jwt.encode(to_encode, "supersecretkeychangeverysecret", algorithm="HS256")
    return encoded

def decode_token(token: str) -> Optional[dict]:
    try:
        payload = jwt.decode(token, "supersecretkeychangeverysecret", algorithms=["HS256"])
        return payload
    except JWTError:
        return None