from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel
from typing import Dict, Any, List

from app.core.auth import get_current_user
from app.services.tool_manager import (
    get_installed_security_tools,
    control_tool_service,
    install_tool
)

router = APIRouter(prefix="/api/tools", tags=["Security Tools Manager"])

class ServiceControlRequest(BaseModel):
    action: str  # 'start', 'stop', 'restart'

@router.get("", response_model=List[Dict[str, Any]])
def list_tools(user: Dict[str, Any] = Depends(get_current_user)):
    """
    Returns the catalog of security tools with their live installed and active status.
    """
    return get_installed_security_tools()

@router.post("/{tool_id}/control")
def control_service(
    tool_id: str,
    data: ServiceControlRequest,
    user: Dict[str, Any] = Depends(get_current_user)
):
    """
    Starts, stops, or restarts a security service on the Raspberry Pi.
    """
    res = control_tool_service(tool_id, data.action)
    if not res.get("success"):
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=res.get("message"))
    return res

@router.post("/{tool_id}/install")
def trigger_install(
    tool_id: str,
    user: Dict[str, Any] = Depends(get_current_user)
):
    """
    Installs the requested security package via apt-get.
    """
    res = install_tool(tool_id)
    return res
