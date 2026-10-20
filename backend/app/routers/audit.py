from fastapi import APIRouter, Depends, HTTPException, status
from typing import Dict, Any, List

from app.core.auth import get_current_user
from app.services.audit_service import audit_service

router = APIRouter(prefix="/api/audit", tags=["Security Audit & Hardening"])

@router.get("/report")
def get_audit_report(user: Dict[str, Any] = Depends(get_current_user)):
    """
    Returns latest Lynis and Rootkit Hunter audit results and warnings.
    """
    return {
        "lynis": audit_service.get_lynis_report(),
        "rkhunter": audit_service.get_rkhunter_report(),
        "scan_status": audit_service.current_scan
    }

@router.post("/scan/{tool_id}")
def trigger_scan(tool_id: str, user: Dict[str, Any] = Depends(get_current_user)):
    """
    Starts an on-demand security audit scan (lynis or rkhunter).
    """
    res = audit_service.run_scan_async(tool_id)
    if not res.get("success"):
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=res.get("message"))
    return res

@router.get("/optimizations")
def get_optimizations(user: Dict[str, Any] = Depends(get_current_user)):
    """
    Returns system hardening checks and their compliance status.
    """
    return audit_service.get_hardening_checks()

@router.post("/optimize")
def apply_system_optimizations(user: Dict[str, Any] = Depends(get_current_user)):
    """
    Applies recommended kernel and system hardening settings.
    """
    res = audit_service.apply_hardening()
    if not res.get("success"):
        raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail=res.get("message"))
    return res
