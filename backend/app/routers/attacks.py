from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel
from typing import Dict, Any, Optional

from app.core.auth import get_current_user
from app.services.attack_monitor import attack_monitor

router = APIRouter(prefix="/api/attacks", tags=["Live Attacks & Threat Intelligence"])

class BanRequest(BaseModel):
    ip: str
    reason: Optional[str] = "Bloqué manuellement par l'administrateur"

class TriggerAttackRequest(BaseModel):
    ip: Optional[str] = None
    service: Optional[str] = None

@router.get("")
def get_attacks_feed(user: Dict[str, Any] = Depends(get_current_user)):
    """
    Returns real-time attack metrics, top threat countries, attack types, and recent events.
    """
    return attack_monitor.get_stats()

@router.post("/trigger")
async def trigger_attack(
    data: Optional[TriggerAttackRequest] = None,
    user: Dict[str, Any] = Depends(get_current_user)
):
    """
    Incorporate a manual or simulated attack to test alerting and firewall visualization.
    """
    ip = data.ip if data else None
    service = data.service if data else None
    event = await attack_monitor.trigger_manual_attack(ip=ip, attack_type=service)
    return {"success": True, "event": event}

@router.get("/banned")
def get_banned_ips(user: Dict[str, Any] = Depends(get_current_user)):
    """
    Returns the list of currently banned IP addresses with reasons and timestamps.
    """
    return {
        "count": len(attack_monitor.banned_ips),
        "banned": attack_monitor.banned_ips
    }

@router.post("/ban")
def ban_ip_address(
    data: BanRequest,
    user: Dict[str, Any] = Depends(get_current_user)
):
    """
    Blocks an attacker IP address immediately via UFW/iptables.
    """
    if not data.ip:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Adresse IP requise.")
    res = attack_monitor.block_ip(data.ip, data.reason or "Blocage manuel")
    return res

@router.delete("/ban/{ip}")
def unban_ip_address(
    ip: str,
    user: Dict[str, Any] = Depends(get_current_user)
):
    """
    Unbans an IP address from the firewall.
    """
    res = attack_monitor.unblock_ip(ip)
    return res
