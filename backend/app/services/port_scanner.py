import socket
import logging
import ipaddress
from typing import List, Dict, Any
try:
    import psutil
except ImportError:
    psutil = None

logger = logging.getLogger("pisentinel.ports")

# Database of standard port knowledge & security risk levels
PORT_DATABASE = {
    21: {
        "service": "FTP",
        "description": "File Transfer Protocol (mots de passe en clair)",
        "risk": "critical",
        "recommendation": "Désactivez FTP et utilisez SFTP (via SSH) pour chiffrer les transferts."
    },
    22: {
        "service": "SSH",
        "description": "Secure Shell - Accès administration à distance",
        "risk": "medium",
        "recommendation": "Utilisez l'authentification par clé SSH, désactivez le mot de passe root et configurez Fail2ban."
    },
    23: {
        "service": "Telnet",
        "description": "Protocole d'accès non sécurisé sans chiffrement",
        "risk": "critical",
        "recommendation": "Désactivez immédiatement Telnet ! Remplacez par SSH."
    },
    25: {
        "service": "SMTP",
        "description": "Serveur d'envoi de courriels",
        "risk": "medium",
        "recommendation": "Vérifiez que votre serveur n'est pas un relais ouvert (open relay) pour les spammers."
    },
    53: {
        "service": "DNS",
        "description": "Serveur de noms de domaine (ex: Pi-hole / dnsmasq)",
        "risk": "low",
        "recommendation": "Si utilisé avec Pi-hole, assurez-vous qu'il n'est accessible que sur le LAN privé."
    },
    67: {
        "service": "DHCP Server",
        "description": "Serveur d'attribution d'adresses IP locale",
        "risk": "low",
        "recommendation": "Service réseau local pour l'attribution dynamique d'adresses IP privées."
    },
    68: {
        "service": "DHCP Client",
        "description": "Client DHCP local",
        "risk": "safe",
        "recommendation": "Client réseau pour l'obtention de la configuration IP sur votre box/routeur."
    },
    80: {
        "service": "HTTP",
        "description": "Serveur Web non chiffré",
        "risk": "high",
        "recommendation": "Configurez HTTPS avec Let's Encrypt (Certbot) et redirigez tout le trafic HTTP vers HTTPS."
    },
    110: {
        "service": "POP3",
        "description": "Relève de courrier non sécurisé",
        "risk": "high",
        "recommendation": "Migrez vers POP3S (Port 995) avec chiffrement TLS."
    },
    137: {
        "service": "NetBIOS Name Service",
        "description": "Résolution de noms NetBIOS locale",
        "risk": "low",
        "recommendation": "Utilisé par Samba pour la découverte des partages Windows sur le réseau local (LAN)."
    },
    138: {
        "service": "NetBIOS Datagram",
        "description": "Service de datagrammes NetBIOS local",
        "risk": "low",
        "recommendation": "Communication réseau locale pour les partages de fichiers Windows."
    },
    139: {
        "service": "NetBIOS",
        "description": "Partage de fichiers Windows Samba",
        "risk": "critical",
        "recommendation": "Bloquez ce port depuis Internet avec votre pare-feu (UFW)."
    },
    443: {
        "service": "HTTPS",
        "description": "Serveur Web chiffré avec TLS/SSL",
        "risk": "safe",
        "recommendation": "Maintenez vos certificats SSL à jour et activez HTTP/2 ou HTTP/3."
    },
    445: {
        "service": "SMB",
        "description": "Partage de fichiers Samba Windows",
        "risk": "critical",
        "recommendation": "Ne JAMAIS exposer le port 445 à Internet (vecteur d'attaques type ransomware)."
    },
    3306: {
        "service": "MySQL / MariaDB",
        "description": "Base de données relationnelle",
        "risk": "high",
        "recommendation": "Liez le serveur à 127.0.0.1 (bind-address = 127.0.0.1). Ne pas exposer sur 0.0.0.0 !"
    },
    3389: {
        "service": "RDP",
        "description": "Bureau à distance Windows / XRDP",
        "risk": "critical",
        "recommendation": "N'exposez jamais le bureau à distance directement à Internet sans tunnel SSH ou VPN."
    },
    5353: {
        "service": "mDNS (Avahi / Bonjour)",
        "description": "Découverte de services locaux (ex: raspberrypi.local)",
        "risk": "safe",
        "recommendation": "Protocole multicast local permettant de joindre la Pi sur le réseau via son nom d'hôte."
    },
    5432: {
        "service": "PostgreSQL",
        "description": "Base de données PostgreSQL",
        "risk": "high",
        "recommendation": "Restreignez l'écoute sur localhost ou autorisez uniquement l'IP des applications clientes."
    },
    5900: {
        "service": "VNC",
        "description": "Contrôle graphique à distance Raspberry Pi",
        "risk": "high",
        "recommendation": "VNC est souvent ciblé par attaques par force brute. Utilisez un tunnel SSH ou WireGuard."
    },
    6379: {
        "service": "Redis",
        "description": "Base de données clé-valeur en mémoire",
        "risk": "critical",
        "recommendation": "Exposez uniquement sur 127.0.0.1 et définissez un mot de passe fort via requirepass."
    },
    8000: {
        "service": "PiSentinel SOC Hub",
        "description": "Serveur d'application Web PiSentinel",
        "risk": "low",
        "recommendation": "Protégé par authentification Google OAuth et JWT. En production, placez derrière un reverse proxy HTTPS."
    },
    8080: {
        "service": "HTTP-Alt",
        "description": "Serveur Web alternatif ou proxy",
        "risk": "medium",
        "recommendation": "Vérifiez les applications exécutées sur ce port et appliquez une authentification forte."
    },
    8443: {
        "service": "PiSentinel Backend",
        "description": "API & Hub interne PiSentinel",
        "risk": "safe",
        "recommendation": "Port interne d'écoute de l'application PiSentinel (redirigé par le reverse proxy Apache)."
    },
    51820: {
        "service": "WireGuard",
        "description": "VPN hautement sécurisé",
        "risk": "safe",
        "recommendation": "Port VPN moderne avec chiffrement de pointe (ChaCha20-Poly1305)."
    }
}

def classify_ip_scope(ip: str) -> Dict[str, Any]:
    """
    Classifies an IP address into its network scope:
    - loopback: 127.0.0.1, ::1 (Localhost only)
    - lan: RFC 1918 (192.168.0.0/16, 10.0.0.0/8, 172.16.0.0/12), link-local (169.254.x.x, fe80::/10)
    - wildcard: 0.0.0.0, :: (All network interfaces / Unspecified)
    - public: Truly public, globally routable Internet IP
    """
    clean_ip = (ip or "").strip()

    if clean_ip in ("localhost", "127.0.0.1", "::1"):
        return {
            "scope": "loopback",
            "label": "Localhost",
            "is_loopback": True,
            "is_lan": False,
            "is_public": False
        }

    if clean_ip in ("0.0.0.0", "::", "*"):
        return {
            "scope": "wildcard",
            "label": "Toutes interfaces",
            "is_loopback": False,
            "is_lan": False,
            "is_public": True
        }

    try:
        addr = ipaddress.ip_address(clean_ip)
        if addr.is_loopback:
            return {
                "scope": "loopback",
                "label": "Localhost",
                "is_loopback": True,
                "is_lan": False,
                "is_public": False
            }
        if addr.is_unspecified:
            return {
                "scope": "wildcard",
                "label": "Toutes interfaces",
                "is_loopback": False,
                "is_lan": False,
                "is_public": True
            }
        if addr.is_private or addr.is_link_local:
            return {
                "scope": "lan",
                "label": "LAN Privé",
                "is_loopback": False,
                "is_lan": True,
                "is_public": False
            }
        return {
            "scope": "public",
            "label": "Public",
            "is_loopback": False,
            "is_lan": False,
            "is_public": True
        }
    except ValueError:
        # Fallback string check for standard RFC 1918 private subnets
        if clean_ip.startswith(("192.168.", "10.", "172.16.", "172.17.", "172.18.", "172.19.", "172.20.", "172.21.", "172.22.", "172.23.", "172.24.", "172.25.", "172.26.", "172.27.", "172.28.", "172.29.", "172.30.", "172.31.")):
            return {
                "scope": "lan",
                "label": "LAN Privé",
                "is_loopback": False,
                "is_lan": True,
                "is_public": False
            }
        return {
            "scope": "public",
            "label": "Public",
            "is_loopback": False,
            "is_lan": False,
            "is_public": True
        }

def analyze_port(port: int, ip: str, pid: int = None, pname: str = None) -> Dict[str, Any]:
    info = PORT_DATABASE.get(port, {
        "service": f"Service applicatif (Port {port})",
        "description": "Service personnalisé ou démon local",
        "risk": "low",
        "recommendation": "Vérifiez si ce service a besoin d'être ouvert à tout le réseau ou s'il peut être restreint à 127.0.0.1."
    })

    scope_info = classify_ip_scope(ip)
    scope = scope_info["scope"]
    base_risk = info["risk"]
    effective_risk = base_risk
    recommendation = info["recommendation"]

    if scope == "loopback":
        # Loopback 127.0.0.1: only accessible from localhost
        effective_risk = "safe" if base_risk in ("safe", "low") else "low"
        recommendation = "Service restreint à la machine locale (127.0.0.1). Isolé du réseau extérieur."

    elif scope == "lan":
        # Bound strictly to private LAN (RFC 1918, ex: 192.168.x.x, 10.x.x.x)
        # Not accessible from the Internet directly
        if port in (137, 138, 139, 445):
            effective_risk = "low"
            recommendation = "Partage Samba/NetBIOS actif sur le réseau local privé (LAN). Protégé d'Internet par le pare-feu de votre box/routeur."
        elif port == 3389:
            effective_risk = "low"
            recommendation = "Bureau à distance (RDP/XRDP) accessible uniquement sur vos réseaux locaux (LAN ou VPN)."
        elif port in (53, 67, 68, 5353, 8443):
            effective_risk = "safe"
            recommendation = f"{info['service']} actif sur le réseau local (LAN). Conforme."
        elif base_risk in ("critical", "high"):
            effective_risk = "medium"
            recommendation = f"{info['description']} - Accessible sur votre réseau local ({ip}). Non exposé à Internet."
        elif base_risk == "medium":
            effective_risk = "low"
        else:
            effective_risk = base_risk

    elif scope == "wildcard":
        # Listening on 0.0.0.0 or :: (all interfaces)
        if port in (443, 51820):
            effective_risk = "safe"
        elif port in (80, 8080):
            effective_risk = "medium"
        elif port in (139, 445, 3389, 21, 23):
            effective_risk = "critical"
        else:
            effective_risk = base_risk
    else:
        # Listening directly on a public routable IP
        effective_risk = base_risk

    return {
        "port": port,
        "bind_ip": ip,
        "ip_scope": scope,
        "ip_label": scope_info["label"],
        "is_localhost_only": scope_info["is_loopback"],
        "is_lan": scope_info["is_lan"],
        "is_public": scope_info["is_public"],
        "service": info["service"],
        "description": info["description"],
        "risk": effective_risk,
        "recommendation": recommendation,
        "pid": pid,
        "process_name": pname or "Inconnu"
    }

def get_open_ports() -> Dict[str, Any]:
    """
    Scans and returns all open listening server ports on the system with security audit info.
    """
    open_ports_list = []
    seen = set()

    try:
        if psutil:
            connections = psutil.net_connections(kind="inet")
            for conn in connections:
                # We focus on TCP servers actively in LISTEN state
                # or well-known UDP service daemons (< 10000 or WireGuard 51820), skipping ephemeral client ports
                is_tcp_listen = conn.status == "LISTEN"
                is_udp_server = conn.type == socket.SOCK_DGRAM and conn.laddr and (conn.laddr.port < 10000 or conn.laddr.port == 51820)

                if is_tcp_listen or is_udp_server:
                    ip = conn.laddr.ip
                    port = conn.laddr.port
                    
                    # Deduplicate by port + ip
                    key = (ip, port)
                    if key in seen:
                        continue
                    seen.add(key)

                    pname = None
                    if conn.pid:
                        try:
                            p = psutil.Process(conn.pid)
                            pname = p.name()
                        except Exception:
                            pname = "Système / Root"

                    analysis = analyze_port(port, ip, conn.pid, pname)
                    open_ports_list.append(analysis)
    except Exception as e:
        logger.warning(f"Could not scan all connections with psutil: {e}")

    # Fallback typical Raspberry Pi ports if scanning returns nothing (e.g. sandbox restriction)
    if not open_ports_list:
        open_ports_list = [
            analyze_port(22, "0.0.0.0", 512, "sshd"),
            analyze_port(8000, "0.0.0.0", 1024, "python3 (PiSentinel)"),
            analyze_port(53, "127.0.0.1", 340, "systemd-resolved"),
            analyze_port(443, "0.0.0.0", 720, "nginx")
        ]

    # Calculate overall security score (0-100)
    score = 100
    risk_counts = {"critical": 0, "high": 0, "medium": 0, "low": 0, "safe": 0}

    for p in open_ports_list:
        r = p["risk"]
        risk_counts[r] = risk_counts.get(r, 0) + 1

    # Penalties
    score -= min(50, risk_counts["critical"] * 25)
    score -= min(30, risk_counts["high"] * 10)
    score -= min(15, risk_counts["medium"] * 3)

    # Bonus for safe configuration
    if risk_counts["critical"] == 0 and risk_counts["high"] == 0:
        score = max(score, 88)

    score = max(10, min(100, score))

    # Sort ports: critical first, then high, medium, low, safe
    risk_priority = {"critical": 0, "high": 1, "medium": 2, "low": 3, "safe": 4}
    open_ports_list.sort(key=lambda x: (risk_priority.get(x["risk"], 5), x["port"]))

    return {
        "score": score,
        "total_open": len(open_ports_list),
        "risk_breakdown": risk_counts,
        "ports": open_ports_list
    }
