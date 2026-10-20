from fastapi import APIRouter, HTTPException, status, Depends, Response
from pydantic import BaseModel
from typing import Optional, Dict, Any

from app.core.config import settings
from app.core.security import (
    verify_google_token,
    verify_password,
    create_access_token
)
from app.core.auth import get_current_user

router = APIRouter(prefix="/api/auth", tags=["Authentication"])

class GoogleAuthRequest(BaseModel):
    credential: str

class LocalAuthRequest(BaseModel):
    username: str
    password: str

@router.get("/config")
def get_auth_config():
    """
    Returns public authentication configuration (Google Client ID, Whitelist active flag).
    """
    return {
        "google_client_id": settings.GOOGLE_CLIENT_ID or None,
        "google_enabled": bool(settings.GOOGLE_CLIENT_ID),
        "whitelist_enabled": bool(settings.ALLOWED_EMAILS),
        "allowed_email_count": len(settings.allowed_email_list),
        "local_login_enabled": True
    }

@router.post("/google")
def login_with_google(data: GoogleAuthRequest, response: Response):
    """
    Verifies Google ID token, checks against allowed email whitelist, and issues JWT access token.
    """
    user_info = verify_google_token(data.credential)
    if not user_info:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Le jeton Google est invalide ou a expiré."
        )

    email = user_info.get("email", "").lower()
    if not email:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Adresse email introuvable dans le profil Google."
        )

    # Check Whitelist
    if not settings.is_email_allowed(email):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail=f"Accès refusé : Le compte Google '{email}' ne figure pas dans la liste des administrateurs autorisés du Raspberry Pi."
        )

    # Issue JWT
    token_payload = {
        "sub": email,
        "email": email,
        "name": user_info.get("name", "Google Admin"),
        "picture": user_info.get("picture", ""),
        "role": "admin",
        "provider": "google"
    }
    access_token = create_access_token(token_payload)

    # Set secure HttpOnly cookie
    response.set_cookie(
        key="access_token",
        value=access_token,
        httponly=True,
        samesite="lax",
        secure=settings.ENVIRONMENT == "production",
        max_age=settings.ACCESS_TOKEN_EXPIRE_MINUTES * 60
    )

    return {
        "access_token": access_token,
        "token_type": "bearer",
        "user": token_payload
    }

@router.post("/login")
def login_local_admin(data: LocalAuthRequest, response: Response):
    """
    Emergency admin credentials login (fallback when offline or no Google OAuth).
    """
    if data.username != settings.ADMIN_USERNAME or not verify_password(data.password, settings.ADMIN_PASSWORD):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Identifiants administrateur incorrects."
        )

    token_payload = {
        "sub": data.username,
        "email": f"{data.username}@local.raspberrypi",
        "name": "Administrateur Local",
        "picture": "",
        "role": "admin",
        "provider": "local"
    }
    access_token = create_access_token(token_payload)

    response.set_cookie(
        key="access_token",
        value=access_token,
        httponly=True,
        samesite="lax",
        secure=settings.ENVIRONMENT == "production",
        max_age=settings.ACCESS_TOKEN_EXPIRE_MINUTES * 60
    )

    return {
        "access_token": access_token,
        "token_type": "bearer",
        "user": token_payload
    }

@router.get("/me")
def get_current_user_profile(user: Dict[str, Any] = Depends(get_current_user)):
    """
    Returns authenticated user information.
    """
    return {
        "user": user,
        "authenticated": True
    }

@router.post("/logout")
def logout(response: Response):
    """
    Clears the authentication cookie.
    """
    response.delete_cookie(key="access_token")
    return {"message": "Déconnexion réussie."}
