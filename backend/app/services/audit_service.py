import os
import re
import platform
import subprocess
import threading
import logging
from datetime import datetime
from typing import Dict, Any, List

logger = logging.getLogger("pisentinel.audit")

class AuditService:
    def __init__(self):
        self.lynis_report_path = "/var/log/lynis-report.dat"
        self.lynis_log_path = "/var/log/lynis.log"
        self.rkhunter_log_path = "/var/log/rkhunter.log"
        self.scan_lock = threading.Lock()
        self.current_scan = None  # None or {"tool": "lynis|rkhunter", "status": "running|done|error", "started_at": ...}

    def _read_file_lines(self, file_path: str) -> List[str]:
        if not os.path.exists(file_path):
            return []
        try:
            with open(file_path, "r", encoding="utf-8", errors="ignore") as f:
                return f.readlines()
        except PermissionError:
            try:
                res = subprocess.run(["sudo", "cat", file_path], stdout=subprocess.PIPE, text=True, timeout=5)
                if res.returncode == 0:
                    return res.stdout.splitlines()
            except Exception as e:
                logger.error(f"Fallback sudo cat failed for {file_path}: {e}")
        except Exception as e:
            logger.error(f"Error reading {file_path}: {e}")
        return []

    def get_lynis_report(self) -> Dict[str, Any]:
        """
        Parses /var/log/lynis-report.dat and returns structured audit results.
        """
        if platform.system() != "Linux":
            # Realistic simulation data for dev mode
            return {
                "available": True,
                "hardening_index": 65,
                "scan_date": datetime.now().strftime("%Y-%m-%d %H:%M"),
                "tests_performed": 266,
                "suggestions_count": 14,
                "warnings_count": 0,
                "firewall_active": True,
                "malware_scanner": True,
                "suggestions": [
                    {"id": "KRNL-5830", "title": "Protection SYN-Flood", "desc": "Activer net.ipv4.tcp_syncookies dans sysctl"},
                    {"id": "SSH-7408", "title": "Sécurisation SSH Root", "desc": "Désactiver PermitRootLogin par mot de passe"},
                    {"id": "NETW-3015", "title": "Anti-Spoofing Réseau", "desc": "Activer le filtrage inverse de paquet (rp_filter)"},
                    {"id": "FILE-6310", "title": "Permissions Système", "desc": "Restreindre les permissions des fichiers de configuration crontab"}
                ],
                "warnings": []
            }

        if not os.path.exists(self.lynis_report_path):
            return {
                "available": False,
                "message": "Aucun rapport Lynis trouvé. Lancez un premier audit pour générer le rapport."
            }

        try:
            mtime = os.path.getmtime(self.lynis_report_path)
            scan_date = datetime.fromtimestamp(mtime).strftime("%d/%m/%Y à %H:%M")

            hardening_index = 0
            suggestions = []
            warnings = []

            lines = self._read_file_lines(self.lynis_report_path)
            for line in lines:
                line = line.strip()
                if line.startswith("hardening_index="):
                    val = line.split("=", 1)[1]
                    hardening_index = int(val) if val.isdigit() else 0
                elif line.startswith("suggestion[]="):
                    content = line.split("=", 1)[1]
                    parts = content.split("|")
                    s_id = parts[0] if len(parts) > 0 else "LYNIS"
                    s_desc = parts[1] if len(parts) > 1 else content
                    suggestions.append({"id": s_id, "desc": s_desc})
                elif line.startswith("warning[]="):
                    content = line.split("=", 1)[1]
                    parts = content.split("|")
                    w_id = parts[0] if len(parts) > 0 else "ALERT"
                    w_desc = parts[1] if len(parts) > 1 else content
                    warnings.append({"id": w_id, "desc": w_desc})

            return {
                "available": True,
                "hardening_index": hardening_index,
                "scan_date": scan_date,
                "suggestions_count": len(suggestions),
                "warnings_count": len(warnings),
                "suggestions": suggestions[:15],
                "warnings": warnings
            }
        except Exception as e:
            logger.error(f"Error parsing Lynis report: {e}")
            return {"available": False, "message": str(e)}

    def get_rkhunter_report(self) -> Dict[str, Any]:
        """
        Parses /var/log/rkhunter.log to extract recent check results and warnings.
        """
        if platform.system() != "Linux":
            return {
                "available": True,
                "scan_date": datetime.now().strftime("%Y-%m-%d %H:%M"),
                "possible_rootkits": 1,
                "warnings": [
                    {
                        "raw": "Warning: The SSH configuration option 'PermitRootLogin' has not been set.",
                        "explanation": "Option par défaut de SSH. Recommandé : interdire root via mot de passe.",
                        "is_false_positive": True
                    }
                ]
            }

        if not os.path.exists(self.rkhunter_log_path):
            return {
                "available": False,
                "message": "Aucun journal RKHunter trouvé. Exécutez une première analyse."
            }

        try:
            mtime = os.path.getmtime(self.rkhunter_log_path)
            scan_date = datetime.fromtimestamp(mtime).strftime("%d/%m/%Y à %H:%M")
            warnings = []

            lines = self._read_file_lines(self.rkhunter_log_path)
            for line in lines:
                if "[Warning]" in line or "Warning:" in line:
                    cleaned = line.strip()
                    # Extract explanation for common Debian/RPi false positives
                    explanation = "Avertissement système détecté."
                    is_fp = False
                    if "PermitRootLogin" in cleaned:
                        explanation = "Configuration SSH par défaut : autorise root ou n'est pas restreint."
                        is_fp = True
                    elif "/dev/shm" in cleaned:
                        explanation = "Mémoire partagée Linux (/dev/shm) : comportement normal sous Raspberry Pi OS."
                        is_fp = True
                    elif ".pwd.lock" in cleaned:
                        explanation = "Fichier de verrouillage des mots de passe Debian : faux positif classique."
                        is_fp = True
                    elif "lwp-request" in cleaned:
                        explanation = "Script Perl standard du système utilisé par libwww-perl."
                        is_fp = True

                    warnings.append({
                        "raw": cleaned,
                        "explanation": explanation,
                        "is_false_positive": is_fp
                    })

            return {
                "available": True,
                "scan_date": scan_date,
                "warnings_count": len(warnings),
                "warnings": warnings[-10:]  # last 10 warnings
            }
        except Exception as e:
            logger.error(f"Error parsing rkhunter log: {e}")
            return {"available": False, "message": str(e)}

    def run_scan_async(self, tool_id: str) -> Dict[str, Any]:
        """
        Launches an audit scan in a background thread.
        """
        if self.current_scan and self.current_scan.get("status") == "running":
            return {
                "success": False,
                "message": f"Un scan est déjà en cours ({self.current_scan['tool']}). Veuillez patienter."
            }

        if tool_id not in ("lynis", "rkhunter"):
            return {"success": False, "message": "Outil inconnu pour l'audit."}

        def _worker():
            self.current_scan = {
                "tool": tool_id,
                "status": "running",
                "started_at": datetime.now().isoformat()
            }
            try:
                if platform.system() != "Linux":
                    import time
                    time.sleep(3)
                    self.current_scan["status"] = "done"
                    return

                if tool_id == "lynis":
                    cmd = ["sudo", "lynis", "audit", "system", "--quick", "--cronjob"]
                else:
                    cmd = ["sudo", "rkhunter", "-c", "--sk"]

                subprocess.run(cmd, stdout=subprocess.PIPE, stderr=subprocess.PIPE, timeout=600)
                self.current_scan["status"] = "done"
            except Exception as e:
                logger.error(f"Error during scan {tool_id}: {e}")
                self.current_scan["status"] = "error"
                self.current_scan["error"] = str(e)

        thread = threading.Thread(target=_worker, daemon=True)
        thread.start()

        return {
            "success": True,
            "message": f"Scan {tool_id.upper()} lancé en arrière-plan. Les résultats seront actualisés dès la fin.",
            "tool": tool_id
        }

    def get_hardening_checks(self) -> List[Dict[str, Any]]:
        """
        Evaluates system hardening rules status (sysctl, ssh, etc.).
        """
        is_linux = platform.system() == "Linux"

        checks = [
            {
                "id": "tcp_syncookies",
                "title": "Protection Anti-SYN Flood (TCP)",
                "category": "Réseau & DoS",
                "desc": "Empêche la saturation de la pile réseau lors d'attaques par déni de service SYN flood.",
                "sysctl_key": "net.ipv4.tcp_syncookies",
                "expected": "1"
            },
            {
                "id": "rp_filter",
                "title": "Protection Anti-Spoofing IP (Reverse Path Filtering)",
                "category": "Réseau & Pare-feu",
                "desc": "Rejette les paquets entrants dont l'adresse source est falsifiée ou non routable.",
                "sysctl_key": "net.ipv4.conf.all.rp_filter",
                "expected": "1"
            },
            {
                "id": "ignore_broadcasts",
                "title": "Ignorer les requêtes ICMP Broadcast (Smurf Attack)",
                "category": "Réseau & DoS",
                "desc": "Bloque les pings envoyés en broadcast pour éviter d'utiliser la Raspberry Pi en relais d'attaque.",
                "sysctl_key": "net.ipv4.icmp_echo_ignore_broadcasts",
                "expected": "1"
            },
            {
                "id": "disable_redirects",
                "title": "Désactiver les redirections ICMP",
                "category": "Réseau & Routage",
                "desc": "Empêche un tiers sur le réseau d'altérer la table de routage via des paquets ICMP forgés.",
                "sysctl_key": "net.ipv4.conf.all.accept_redirects",
                "expected": "0"
            },
            {
                "id": "shadow_perms",
                "title": "Permissions strictes sur /etc/shadow",
                "category": "Système & Fichiers",
                "desc": "Garantit que seuls root/shadow ont accès aux empreintes de mots de passe (chmod 640 ou 600).",
                "sysctl_key": None,
                "expected": "0640 / 0600"
            }
        ]

        results = []
        for c in checks:
            is_compliant = False
            current_value = "inconnu"

            if not is_linux:
                # Simulated state
                is_compliant = c["id"] in ("tcp_syncookies", "shadow_perms")
                current_value = c["expected"] if is_compliant else "0"
            else:
                if c["sysctl_key"]:
                    try:
                        res = subprocess.run(["sysctl", "-n", c["sysctl_key"]], stdout=subprocess.PIPE, text=True, timeout=2)
                        current_value = res.stdout.strip()
                        is_compliant = (current_value == c["expected"])
                    except Exception:
                        current_value = "erreur"
                elif c["id"] == "shadow_perms":
                    try:
                        stat = os.stat("/etc/shadow")
                        mode = oct(stat.st_mode)[-3:]
                        current_value = f"0{mode}"
                        is_compliant = mode in ("600", "640", "000")
                    except Exception:
                        current_value = "inaccessible"

            results.append({
                **c,
                "compliant": is_compliant,
                "current_value": current_value
            })

        return results

    def apply_hardening(self) -> Dict[str, Any]:
        """
        Applies system hardening configuration safely using /etc/sysctl.d/99-pisentinel.conf.
        """
        if platform.system() != "Linux":
            return {
                "success": True,
                "message": "[Mode Dev] Règles de durcissement appliquées avec succès."
            }

        conf_content = """# --- PiSentinel Security Hardening Sysctl Rules ---
net.ipv4.tcp_syncookies = 1
net.ipv4.conf.all.rp_filter = 1
net.ipv4.conf.default.rp_filter = 1
net.ipv4.icmp_echo_ignore_broadcasts = 1
net.ipv4.conf.all.accept_redirects = 0
net.ipv4.conf.default.accept_redirects = 0
net.ipv4.conf.all.send_redirects = 0
net.ipv4.conf.default.send_redirects = 0
net.ipv4.conf.all.log_martians = 1
"""
        target_conf = "/etc/sysctl.d/99-pisentinel.conf"
        try:
            # 1. Write sysctl config directly via sudo tee (avoids PrivateTmp=true namespace isolation)
            tee_res = subprocess.run(
                ["sudo", "tee", target_conf],
                input=conf_content,
                text=True,
                stdout=subprocess.PIPE,
                stderr=subprocess.PIPE,
                timeout=5
            )
            if tee_res.returncode != 0:
                err_msg = tee_res.stderr.strip() or "Permission refusée"
                logger.error(f"Failed to write sysctl file: {err_msg}")
                return {"success": False, "message": f"Échec d'écriture ({target_conf}): {err_msg}"}

            # 2. Apply live sysctl rules directly into the running Linux kernel
            sysctl_settings = [
                ("net.ipv4.tcp_syncookies", "1"),
                ("net.ipv4.conf.all.rp_filter", "1"),
                ("net.ipv4.conf.default.rp_filter", "1"),
                ("net.ipv4.icmp_echo_ignore_broadcasts", "1"),
                ("net.ipv4.conf.all.accept_redirects", "0"),
                ("net.ipv4.conf.default.accept_redirects", "0"),
                ("net.ipv4.conf.all.send_redirects", "0"),
                ("net.ipv4.conf.default.send_redirects", "0"),
                ("net.ipv4.conf.all.log_martians", "1"),
            ]
            for key, val in sysctl_settings:
                try:
                    subprocess.run(["sudo", "sysctl", "-w", f"{key}={val}"], stdout=subprocess.PIPE, stderr=subprocess.PIPE, timeout=3)
                except Exception as ex:
                    logger.warning(f"Could not apply sysctl {key}={val}: {ex}")

            # 3. Reload sysctl system-wide
            try:
                subprocess.run(["sudo", "sysctl", "--system"], stdout=subprocess.PIPE, stderr=subprocess.PIPE, timeout=10)
            except Exception:
                pass

            # 4. Secure /etc/shadow permissions
            try:
                subprocess.run(["sudo", "chmod", "640", "/etc/shadow"], stdout=subprocess.PIPE, stderr=subprocess.PIPE, timeout=5)
            except Exception:
                pass

            return {
                "success": True,
                "message": "Durcissement appliqué avec succès ! Protection SYN-flood, Anti-spoofing et règles noyau activées."
            }
        except Exception as e:
            logger.error(f"Error applying hardening: {e}")
            return {"success": False, "message": f"Erreur lors de l'application : {str(e)}"}

audit_service = AuditService()
