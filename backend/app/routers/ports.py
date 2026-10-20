from fastapi import APIRouter, Depends
from typing import Dict, Any

from app.core.auth import get_current_user
from app.services.port_scanner import get_open_ports

router = APIRouter(prefix="/api/ports", tags=["Port Scanner & Auditor"])

@router.get("")
def list_open_ports(user: Dict[str, Any] = Depends(get_current_user)):
    """
    Returns live listening ports on the Raspberry Pi with risk assessments and security tips.
    """
    return get_open_ports()

@router.get("/hardening-rules")
def get_hardening_rules(user: Dict[str, Any] = Depends(get_current_user)):
    """
    Generates recommended UFW firewall commands based on current open ports.
    """
    data = get_open_ports()
    rules = [
        "sudo ufw default deny incoming",
        "sudo ufw default allow outgoing"
    ]

    has_ssh = any(p["port"] == 22 for p in data["ports"])
    if has_ssh:
        rules.append("sudo ufw limit 22/tcp comment 'Protège SSH contre la force brute'")

    has_web = any(p["port"] in (80, 443) for p in data["ports"])
    if has_web:
        rules.append("sudo ufw allow 80/tcp comment 'HTTP Web'")
        rules.append("sudo ufw allow 443/tcp comment 'HTTPS Web'")

    has_pisentinel = any(p["port"] == 8000 for p in data["ports"])
    if has_pisentinel:
        rules.append("sudo ufw allow from 192.168.0.0/16 to any port 8000 proto tcp comment 'PiSentinel Dashboard (LAN Only)'")

    has_wireguard = any(p["port"] == 51820 for p in data["ports"])
    if has_wireguard:
        rules.append("sudo ufw allow 51820/udp comment 'WireGuard VPN'")

    rules.append("sudo ufw enable")

    return {
        "commands": rules,
        "description": "Exécutez ces règles sur votre Raspberry Pi pour verrouiller les ports non nécessaires."
    }
