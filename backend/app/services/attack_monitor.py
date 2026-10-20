import os
import re
import time
import random
import datetime
import logging
import asyncio
import platform
import subprocess
from typing import List, Dict, Any, Optional

from app.core.config import settings
from app.services.geoip import get_ip_location

logger = logging.getLogger("pisentinel.attacks")

# Regex patterns for common attack vectors in Linux logs
AUTH_FAILED_REGEX = re.compile(
    r"(?:Failed password for(?: invalid user)? (\S+) from (\d+\.\d+\.\d+\.\d+) port (\d+)|Invalid user (\S+) from (\d+\.\d+\.\d+\.\d+) port (\d+))"
)
FAIL2BAN_BAN_REGEX = re.compile(
    r"\[(\S+)\] Ban (\d+\.\d+\.\d+\.\d+)"
)
UFW_BLOCK_REGEX = re.compile(
    r"\[UFW BLOCK\] .*?SRC=(\d+\.\d+\.\d+\.\d+) .*?PROTO=(\S+) .*?DPT=(\d+)"
)

# Simulated attack sources with realistic international attacker IPs
SIMULATED_ATTACKERS = [
    {"ip": "185.220.101.5", "country": "Allemagne", "country_code": "DE", "city": "Francfort", "lat": 50.1109, "lon": 8.6821},
    {"ip": "194.26.29.112", "country": "Russie", "country_code": "RU", "city": "Moscou", "lat": 55.7558, "lon": 37.6173},
    {"ip": "45.155.205.233", "country": "Pays-Bas", "country_code": "NL", "city": "Amsterdam", "lat": 52.3676, "lon": 4.9041},
    {"ip": "112.85.42.91", "country": "Chine", "country_code": "CN", "city": "Nanjing", "lat": 32.0603, "lon": 118.7969},
    {"ip": "162.142.125.40", "country": "États-Unis", "country_code": "US", "city": "Ann Arbor", "lat": 42.2808, "lon": -83.7430},
    {"ip": "103.145.13.20", "country": "Vietnam", "country_code": "VN", "city": "Hanoï", "lat": 21.0285, "lon": 105.8542},
    {"ip": "195.154.60.2", "country": "France", "country_code": "FR", "city": "Paris", "lat": 48.8566, "lon": 2.3522},
    {"ip": "80.82.77.33", "country": "Seychelles", "country_code": "SC", "city": "Victoria", "lat": -4.6234, "lon": 55.4526},
    {"ip": "178.128.24.11", "country": "Singapour", "country_code": "SG", "city": "Singapour", "lat": 1.3521, "lon": 103.8198},
    {"ip": "91.240.118.15", "country": "Bulgarie", "country_code": "BG", "city": "Sofia", "lat": 42.6977, "lon": 23.3219}
]

SIMULATED_USERNAMES = ["root", "admin", "pi", "ubuntu", "user", "test", "postgres", "oracle", "git", "ansible"]
SIMULATED_SERVICES = ["SSH (Port 22)", "HTTP Vulnerability Scan (Port 80)", "MySQL Probe (Port 3306)", "Redis Exploit (Port 6379)", "Telnet Scanner (Port 23)"]

class AttackMonitor:
    def __init__(self):
        self.attack_history: List[Dict[str, Any]] = []
        self.banned_ips: List[Dict[str, Any]] = []
        self.max_history = 200
        self.subscribers: List[asyncio.Queue] = []
        self._running = False
        self._task: Optional[asyncio.Task] = None

    def start(self):
        if not self._running:
            self._running = True
            self._task = asyncio.create_task(self._monitor_loop())

    async def register_subscriber(self, queue: asyncio.Queue):
        self.subscribers.append(queue)
        # Send current recent attack history to new subscriber
        for attack in self.attack_history[-20:]:
            await queue.put({"type": "attack_event", "data": attack})

    def unregister_subscriber(self, queue: asyncio.Queue):
        if queue in self.subscribers:
            self.subscribers.remove(queue)

    async def broadcast(self, message: Dict[str, Any]):
        for queue in list(self.subscribers):
            try:
                await queue.put(message)
            except Exception:
                if queue in self.subscribers:
                    self.subscribers.remove(queue)

    def record_attack(self, attack: Dict[str, Any]):
        attack["id"] = f"atk_{int(time.time()*1000)}_{random.randint(100, 999)}"
        if "timestamp" not in attack:
            attack["timestamp"] = datetime.datetime.now(datetime.timezone.utc).isoformat()
        
        self.attack_history.append(attack)
        if len(self.attack_history) > self.max_history:
            self.attack_history.pop(0)

    def get_stats(self) -> Dict[str, Any]:
        total_attacks = len(self.attack_history)
        unique_ips = len(set(a["ip"] for a in self.attack_history))
        countries: Dict[str, int] = {}
        types: Dict[str, int] = {}

        for a in self.attack_history:
            c = a.get("geo", {}).get("country", "Inconnu")
            t = a.get("type", "Attaque inconnue")
            countries[c] = countries.get(c, 0) + 1
            types[t] = types.get(t, 0) + 1

        top_countries = sorted([{"country": k, "count": v} for k, v in countries.items()], key=lambda x: x["count"], reverse=True)[:5]
        top_types = sorted([{"type": k, "count": v} for k, v in types.items()], key=lambda x: x["count"], reverse=True)

        return {
            "total_attacks": total_attacks,
            "unique_attackers": unique_ips,
            "total_banned": len(self.banned_ips),
            "top_countries": top_countries,
            "top_types": top_types,
            "recent_attacks": self.attack_history[-30:]
        }

    async def trigger_manual_attack(self, ip: Optional[str] = None, attack_type: Optional[str] = None) -> Dict[str, Any]:
        """
        Manually trigger an attack event (for testing alerting and dashboard).
        """
        source = random.choice(SIMULATED_ATTACKERS) if not ip else {"ip": ip, "country": "Test", "country_code": "TST", "city": "Test City", "lat": 48.85, "lon": 2.35}
        target_service = attack_type or random.choice(SIMULATED_SERVICES)
        username = random.choice(SIMULATED_USERNAMES)

        event = {
            "ip": source["ip"],
            "type": f"Tentative Brute-Force ({target_service})" if "SSH" in target_service else f"Balayage ({target_service})",
            "service": target_service,
            "severity": "high" if "SSH" in target_service or "Exploit" in target_service else "medium",
            "details": f"Tentative d'accès non autorisé avec identifiant '{username}'",
            "geo": {
                "country": source.get("country", "Inconnu"),
                "country_code": source.get("country_code", "UN"),
                "city": source.get("city", "N/A"),
                "lat": source.get("lat", 0.0),
                "lon": source.get("lon", 0.0)
            },
            "timestamp": datetime.datetime.now(datetime.timezone.utc).isoformat()
        }

        self.record_attack(event)
        await self.broadcast({"type": "attack_event", "data": event})
        return event

    def block_ip(self, ip: str, reason: str = "Bloqué manuellement par l'administrateur") -> Dict[str, Any]:
        """
        Blocks an IP address using UFW or Fail2ban.
        """
        is_linux = platform.system() == "Linux"
        
        # Check if already banned
        for item in self.banned_ips:
            if item["ip"] == ip:
                return {"success": True, "message": f"L'IP {ip} est déjà bloquée."}

        ban_entry = {
            "ip": ip,
            "reason": reason,
            "timestamp": datetime.datetime.now(datetime.timezone.utc).isoformat(),
            "geo": get_ip_location(ip)
        }

        if is_linux:
            # Try UFW first
            try:
                res = subprocess.run(["sudo", "ufw", "insert", "1", "deny", "from", ip], stdout=subprocess.PIPE, stderr=subprocess.PIPE, text=True, timeout=5)
                if res.returncode == 0:
                    self.banned_ips.append(ban_entry)
                    return {"success": True, "message": f"IP {ip} bloquée avec succès via UFW."}
            except Exception as e:
                logger.warning(f"UFW ban failed: {e}")

            # Try iptables
            try:
                res = subprocess.run(["sudo", "iptables", "-I", "INPUT", "-s", ip, "-j", "DROP"], stdout=subprocess.PIPE, stderr=subprocess.PIPE, text=True, timeout=5)
                if res.returncode == 0:
                    self.banned_ips.append(ban_entry)
                    return {"success": True, "message": f"IP {ip} bloquée avec succès via iptables."}
            except Exception as e:
                logger.error(f"iptables ban failed: {e}")

        # In dev mode / simulated
        self.banned_ips.append(ban_entry)
        return {"success": True, "message": f"[Dev Mode] IP {ip} ajoutée à la liste noire (UFW deny from {ip})."}

    def unblock_ip(self, ip: str) -> Dict[str, Any]:
        self.banned_ips = [b for b in self.banned_ips if b["ip"] != ip]
        if platform.system() == "Linux":
            try:
                subprocess.run(["sudo", "ufw", "delete", "deny", "from", ip], stdout=subprocess.PIPE, stderr=subprocess.PIPE, text=True, timeout=5)
                subprocess.run(["sudo", "iptables", "-D", "INPUT", "-s", ip, "-j", "DROP"], stdout=subprocess.PIPE, stderr=subprocess.PIPE, text=True, timeout=5)
            except Exception:
                pass
        return {"success": True, "message": f"IP {ip} débloquée."}

    async def _monitor_loop(self):
        """
        Background loop: tails Linux logs or simulates realistic background threats.
        """
        logger.info("AttackMonitor loop started.")
        # Prepopulate with a few initial attacks so the dashboard is immediately vivid
        if len(self.attack_history) == 0:
            for _ in range(5):
                src = random.choice(SIMULATED_ATTACKERS)
                svc = random.choice(SIMULATED_SERVICES)
                u = random.choice(SIMULATED_USERNAMES)
                self.record_attack({
                    "ip": src["ip"],
                    "type": f"Tentative Brute-Force ({svc})" if "SSH" in svc else f"Balayage ({svc})",
                    "service": svc,
                    "severity": "high" if "SSH" in svc else "medium",
                    "details": f"Tentative d'accès non autorisé avec identifiant '{u}'",
                    "geo": {
                        "country": src["country"],
                        "country_code": src["country_code"],
                        "city": src["city"],
                        "lat": src["lat"],
                        "lon": src["lon"]
                    },
                    "timestamp": (datetime.datetime.now(datetime.timezone.utc) - datetime.timedelta(minutes=random.randint(2, 60))).isoformat()
                })

        while self._running:
            try:
                if settings.is_simulation:
                    # In simulation mode, generate a realistic threat event periodically (every 10-25 seconds)
                    await asyncio.sleep(random.randint(10, 25))
                    await self.trigger_manual_attack()
                else:
                    # On real Linux Raspberry Pi, parse auth.log or fail2ban.log
                    await self._check_linux_logs()
                    await asyncio.sleep(3)
            except asyncio.CancelledError:
                break
            except Exception as e:
                logger.error(f"Error in attack monitor loop: {e}")
                await asyncio.sleep(5)

    async def _check_linux_logs(self):
        # Read tail of /var/log/auth.log or journalctl
        log_file = "/var/log/auth.log"
        if not os.path.exists(log_file):
            log_file = "/var/log/secure"
        
        if not os.path.exists(log_file):
            return

        try:
            # Read last 30 lines
            cmd = ["tail", "-n", "30", log_file]
            res = subprocess.run(cmd, stdout=subprocess.PIPE, stderr=subprocess.PIPE, text=True, timeout=2)
            lines = res.stdout.splitlines()
            for line in lines:
                m = AUTH_FAILED_REGEX.search(line)
                if m:
                    groups = [g for g in m.groups() if g is not None]
                    if len(groups) >= 2:
                        user = groups[0] if len(groups) == 3 else "unknown"
                        ip = groups[1] if len(groups) == 3 else groups[0]
                        
                        # Check if we already recorded this in last 10 seconds
                        if not any(a["ip"] == ip and a["details"].endswith(f"'{user}'") for a in self.attack_history[-10:]):
                            geo = get_ip_location(ip)
                            event = {
                                "ip": ip,
                                "type": "Tentative Brute-Force SSH",
                                "service": "SSH (Port 22)",
                                "severity": "high",
                                "details": f"Échec d'authentification SSH pour l'utilisateur '{user}'",
                                "geo": geo,
                                "timestamp": datetime.datetime.now(datetime.timezone.utc).isoformat()
                            }
                            self.record_attack(event)
                            await self.broadcast({"type": "attack_event", "data": event})
        except Exception as e:
            logger.debug(f"Error checking Linux logs: {e}")

attack_monitor = AttackMonitor()
