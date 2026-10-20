import datetime
import logging
from typing import Optional, Dict, Any
import jwt
import requests
from passlib.context import CryptContext
from google.oauth2 import id_token
from google.auth.transport import requests as google_requests

from app.core.config import settings

logger = logging.getLogger("pisentinel.security")

# Setup password hashing
pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")

def verify_password(plain_password: str, hashed_password: str) -> bool:
    try:
        # Check if it's plain text (fallback if user set a simple password in .env)
        if hashed_password.startswith("$2b$") or hashed_password.startswith("$2a$"):
            return pwd_context.verify(plain_password, hashed_password)
        # Direct string comparison if unhashed in .env for easy local dev
        return plain_password == hashed_password
    except Exception as e:
        logger.error(f"Password verification error: {e}")
        return False

def get_password_hash(password: str) -> str:
    return pwd_context.hash(password)

def create_access_token(data: dict, expires_delta: Optional[datetime.timedelta] = None) -> str:
    to_encode = data.copy()
    if expires_delta:
        expire = datetime.datetime.now(datetime.timezone.utc) + expires_delta
    else:
        expire = datetime.datetime.now(datetime.timezone.utc) + datetime.timedelta(minutes=settings.ACCESS_TOKEN_EXPIRE_MINUTES)
    to_encode.update({"exp": expire, "iat": datetime.datetime.now(datetime.timezone.utc)})
    encoded_jwt = jwt.encode(to_encode, settings.SECRET_KEY, algorithm=settings.ALGORITHM)
    return encoded_jwt

def decode_access_token(token: str) -> Optional[Dict[str, Any]]:
    try:
        payload = jwt.decode(token, settings.SECRET_KEY, algorithms=[settings.ALGORITHM])
        return payload
    except jwt.PyJWTError as e:
        logger.warning(f"Invalid JWT token: {e}")
        return None

def verify_google_token(credential: str) -> Optional[Dict[str, Any]]:
    """
    Verifies a Google ID token from Sign-In With Google.
    Returns user dict with email, name, picture, or None if invalid.
    """
    try:
        # Try local offline verification with Google certificates if CLIENT_ID is set
        if settings.GOOGLE_CLIENT_ID:
            idinfo = id_token.verify_oauth2_token(
                credential,
                google_requests.Request(),
                settings.GOOGLE_CLIENT_ID
            )
            return {
                "email": idinfo.get("email"),
                "name": idinfo.get("name", "Google User"),
                "picture": idinfo.get("picture", ""),
                "sub": idinfo.get("sub"),
                "email_verified": idinfo.get("email_verified", False)
            }
        else:
            # Fallback to Google TokenInfo endpoint (useful when client ID is configured dynamically or in testing)
            url = f"https://oauth2.googleapis.com/tokeninfo?id_token={credential}"
            res = requests.get(url, timeout=5)
            if res.status_code == 200:
                data = res.json()
                return {
                    "email": data.get("email"),
                    "name": data.get("name", "Google User"),
                    "picture": data.get("picture", ""),
                    "sub": data.get("sub"),
                    "email_verified": data.get("email_verified") == "true"
                }
            logger.warning(f"Google tokeninfo response {res.status_code}: {res.text}")
            return None
    except Exception as e:
        logger.error(f"Error verifying Google token: {e}")
        return None
