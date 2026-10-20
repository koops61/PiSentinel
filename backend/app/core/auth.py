from fastapi import Depends, HTTPException, status, Request
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from typing import Optional, Dict, Any

from app.core.security import decode_access_token

security_scheme = HTTPBearer(auto_error=False)

async def get_current_user(
    request: Request,
    credentials: Optional[HTTPAuthorizationCredentials] = Depends(security_scheme)
) -> Dict[str, Any]:
    token = None

    # 1. Bearer header
    if credentials:
        token = credentials.credentials
    # 2. Cookie fallback
    elif "access_token" in request.cookies:
        token = request.cookies.get("access_token")
    # 3. Query param fallback (used for WebSocket or download links)
    elif "token" in request.query_params:
        token = request.query_params.get("token")

    if not token:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Session non authentifiée. Veuillez vous connecter.",
            headers={"WWW-Authenticate": "Bearer"},
        )

    payload = decode_access_token(token)
    if not payload:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Jeton de session expiré ou invalide.",
            headers={"WWW-Authenticate": "Bearer"},
        )

    return payload

async def get_current_user_optional(
    request: Request,
    credentials: Optional[HTTPAuthorizationCredentials] = Depends(security_scheme)
) -> Optional[Dict[str, Any]]:
    try:
        return await get_current_user(request, credentials)
    except HTTPException:
        return None
