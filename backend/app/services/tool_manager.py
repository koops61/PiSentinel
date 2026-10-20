import shutil
import subprocess
import platform
import logging
from typing import List, Dict, Any

logger = logging.getLogger("pisentinel.tools")

SECURITY_TOOLS_CATALOG = [
    {
        "id": "ufw",
        "name": "UFW (Uncomplicated Firewall)",
        "service_name": "ufw",
        "binary": "ufw",
        "category": "Pare-feu",
        "description": "Gère le pare-feu réseau Linux avec des règles simples et efficaces pour bloquer les connexions non autorisées.",
        "apt_package": "ufw",
        "recommended": True
    },
    {
        "id": "fail2ban",
        "name": "Fail2ban",
        "service_name": "fail2ban",
        "binary": "fail2ban-client",
        "category": "Anti-Intrusion (IPS)",
        "description": "Analyse les journaux de connexion et bannit automatiquement les adresses IP après plusieurs échecs d'authentification.",
        "apt_package": "fail2ban",
        "recommended": True
    },
    {
        "id": "lynis",
        "name": "Lynis Security Auditor",
        "service_name": None,
        "binary": "lynis",
        "category": "Audit & Durcissement",
        "description": "Outil d'audit approfondi de sécurité et de conformité du système d'exploitation.",
        "apt_package": "lynis",
        "recommended": True
    },
    {
        "id": "clamav",
        "name": "ClamAV Antivirus",
        "service_name": "clamav-daemon",
        "binary": "clamscan",
        "category": "Antivirus",
        "description": "Moteur antivirus open-source pour détecter les chevaux de Troie, virus et logiciels malveillants.",
        "apt_package": "clamav clamav-daemon",
        "recommended": False
    },
    {
        "id": "rkhunter",
        "name": "Rootkit Hunter",
        "service_name": None,
        "binary": "rkhunter",
        "category": "Anti-Rootkit",
        "description": "Scanne le système à la recherche de rootkits, portes dérobées (backdoors) et failles locales.",
        "apt_package": "rkhunter",
        "recommended": True
    },
    {
        "id": "wireguard",
        "name": "WireGuard VPN",
        "service_name": "wg-quick@wg0",
        "binary": "wg",
        "category": "VPN & Chiffrement",
        "description": "VPN moderne et ultra-rapide pour accéder à votre Raspberry Pi à distance en toute sécurité.",
        "apt_package": "wireguard",
        "recommended": True
    },
    {
        "id": "iptables",
        "name": "iptables / Netfilter",
        "service_name": "netfilter-persistent",
        "binary": "iptables",
        "category": "Filtrage Noyau",
        "description": "Système de filtrage de paquets natif du noyau Linux pour un contrôle granulaire du trafic.",
        "apt_package": "iptables iptables-persistent",
        "recommended": False
    }
]

def check_service_status(service_name: str) -> str:
    if not service_name:
        return "not_applicable"
    if platform.system() != "Linux":
        return "active"

    try:
        res = subprocess.run(
            ["systemctl", "is-active", service_name],
            stdout=subprocess.PIPE,
            stderr=subprocess.PIPE,
            text=True,
            timeout=2
        )
        status = res.stdout.strip()
        if status in ("active", "running"):
            return "active"
        if status in ("inactive", "failed"):
            return status
        return "stopped"
    except Exception:
        return "unknown"

def get_installed_security_tools() -> List[Dict[str, Any]]:
    """
    Returns the list of security tools with installation status, active status, and action capabilities.
    """
    is_linux = platform.system() == "Linux"
    results = []

    for tool in SECURITY_TOOLS_CATALOG:
        binary_exists = shutil.which(tool["binary"]) is not None
        
        # In non-Linux development mode, simulate realistic installed tools
        if not is_linux:
            # Simulate ufw and fail2ban installed for testing
            if tool["id"] in ("ufw", "fail2ban", "iptables"):
                binary_exists = True
                active_status = "active"
            elif tool["id"] == "lynis":
                binary_exists = True
                active_status = "not_applicable"
            else:
                binary_exists = False
                active_status = "not_installed"
        else:
            if binary_exists:
                active_status = check_service_status(tool["service_name"])
            else:
                active_status = "not_installed"

        results.append({
            "id": tool["id"],
            "name": tool["name"],
            "category": tool["category"],
            "description": tool["description"],
            "apt_package": tool["apt_package"],
            "recommended": tool["recommended"],
            "is_installed": binary_exists,
            "status": active_status,
            "can_control_service": tool["service_name"] is not None and binary_exists
        })

    return results

def control_tool_service(tool_id: str, action: str) -> Dict[str, Any]:
    """
    Performs action ('start', 'stop', 'restart') on a service.
    """
    tool = next((t for t in SECURITY_TOOLS_CATALOG if t["id"] == tool_id), None)
    if not tool:
        return {"success": False, "message": f"Outil '{tool_id}' inconnu."}

    if not tool["service_name"]:
        return {"success": False, "message": f"L'outil '{tool['name']}' n'a pas de démon de service dédié."}

    if action not in ("start", "stop", "restart"):
        return {"success": False, "message": f"Action '{action}' invalide."}

    if platform.system() != "Linux":
        # Dev simulation
        return {
            "success": True,
            "message": f"[Dev Mode] Service {tool['service_name']} {action} exécuté avec succès."
        }

    try:
        cmd = ["sudo", "systemctl", action, tool["service_name"]]
        res = subprocess.run(cmd, stdout=subprocess.PIPE, stderr=subprocess.PIPE, text=True, timeout=10)
        if res.returncode == 0:
            return {
                "success": True,
                "message": f"Service {tool['service_name']} : {action} effectué."
            }
        else:
            return {
                "success": False,
                "message": f"Erreur lors de l'exécution: {res.stderr.strip() or res.stdout.strip()}"
            }
    except Exception as e:
        logger.error(f"Error controlling service {tool_id}: {e}")
        return {"success": False, "message": str(e)}

def install_tool(tool_id: str) -> Dict[str, Any]:
    """
    Returns installation command or executes apt-get install if running as root/sudo.
    """
    tool = next((t for t in SECURITY_TOOLS_CATALOG if t["id"] == tool_id), None)
    if not tool:
        return {"success": False, "message": f"Outil '{tool_id}' inconnu."}

    cmd = f"sudo apt-get update && sudo apt-get install -y {tool['apt_package']}"

    if platform.system() != "Linux":
        return {
            "success": True,
            "simulated": True,
            "command": cmd,
            "message": f"[Dev Mode] Commande d'installation générée: {cmd}"
        }

    try:
        res = subprocess.run(
            ["sudo", "apt-get", "install", "-y"] + tool["apt_package"].split(),
            stdout=subprocess.PIPE,
            stderr=subprocess.PIPE,
            text=True,
            timeout=60
        )
        return {
            "success": res.returncode == 0,
            "command": cmd,
            "message": "Installation terminée avec succès." if res.returncode == 0 else res.stderr
        }
    except Exception as e:
        return {"success": False, "command": cmd, "message": str(e)}
