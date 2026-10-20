import os
import time
import platform
import subprocess
from fastapi import APIRouter, Depends
from typing import Dict, Any
import psutil

from app.core.auth import get_current_user
from app.services.port_scanner import get_open_ports
from app.services.tool_manager import get_installed_security_tools
from app.services.attack_monitor import attack_monitor

router = APIRouter(prefix="/api/system", tags=["System Telemetry"])

def get_cpu_temperature() -> float:
    """
    Reads CPU temperature on Raspberry Pi or Linux.
    """
    # 1. Thermal zone file on Linux / Raspberry Pi
    thermal_file = "/sys/class/thermal/thermal_zone0/temp"
    if os.path.exists(thermal_file):
        try:
            with open(thermal_file, "r") as f:
                temp_str = f.read().strip()
                return round(float(temp_str) / 1000.0, 1)
        except Exception:
            pass

    # 2. Raspberry Pi vcgencmd
    try:
        res = subprocess.run(["vcgencmd", "measure_temp"], stdout=subprocess.PIPE, stderr=subprocess.PIPE, text=True, timeout=1)
        if res.returncode == 0:
            # Output: temp=48.2'C
            out = res.stdout.strip()
            temp_val = out.replace("temp=", "").replace("'C", "")
            return round(float(temp_val), 1)
    except Exception:
        pass

    # 3. psutil sensors
    try:
        temps = psutil.sensors_temperatures()
        if temps:
            for name, entries in temps.items():
                if entries:
                    return round(entries[0].current, 1)
    except Exception:
        pass

    # Fallback simulated temperature
    return 42.5

@router.get("/status")
def get_system_telemetry(user: Dict[str, Any] = Depends(get_current_user)):
    """
    Returns full hardware and OS telemetry (CPU, RAM, Temp, Disk, Net, Uptime).
    """
    cpu_percent = psutil.cpu_percent(interval=None)
    cpu_count = psutil.cpu_count(logical=True)
    
    mem = psutil.virtual_memory()
    disk = psutil.disk_usage('/') if os.path.exists('/') else psutil.disk_usage('C:\\')
    net = psutil.net_io_counters()

    uptime_seconds = int(time.time() - psutil.boot_time())
    days, remainder = divmod(uptime_seconds, 86400)
    hours, remainder = divmod(remainder, 3600)
    minutes, _ = divmod(remainder, 60)
    uptime_str = f"{days}j {hours}h {minutes}m" if days > 0 else f"{hours}h {minutes}m"

    # Detect board model
    model = "Raspberry Pi (Système Détecté)"
    model_file = "/proc/device-tree/model"
    if os.path.exists(model_file):
        try:
            with open(model_file, "r") as f:
                model = f.read().strip().replace("\x00", "")
        except Exception:
            pass
    elif platform.system() != "Linux":
        model = f"Station Dev ({platform.system()} {platform.release()})"

    return {
        "hostname": platform.node(),
        "model": model,
        "os": f"{platform.system()} {platform.release()}",
        "architecture": platform.machine(),
        "uptime": uptime_str,
        "uptime_seconds": uptime_seconds,
        "cpu": {
            "percent": cpu_percent,
            "cores": cpu_count,
            "temperature_c": get_cpu_temperature()
        },
        "memory": {
            "total_mb": round(mem.total / (1024 * 1024), 1),
            "used_mb": round(mem.used / (1024 * 1024), 1),
            "free_mb": round(mem.free / (1024 * 1024), 1),
            "percent": mem.percent
        },
        "disk": {
            "total_gb": round(disk.total / (1024 * 1024 * 1024), 1),
            "used_gb": round(disk.used / (1024 * 1024 * 1024), 1),
            "free_gb": round(disk.free / (1024 * 1024 * 1024), 1),
            "percent": disk.percent
        },
        "network": {
            "bytes_sent_mb": round(net.bytes_sent / (1024 * 1024), 2),
            "bytes_recv_mb": round(net.bytes_recv / (1024 * 1024), 2),
            "packets_sent": net.packets_sent,
            "packets_recv": net.packets_recv
        }
    }

@router.get("/summary")
def get_security_summary(user: Dict[str, Any] = Depends(get_current_user)):
    """
    Aggregates overall health score, open ports status, active security tools, and recent attacks.
    """
    ports_data = get_open_ports()
    tools_data = get_installed_security_tools()
    attack_stats = attack_monitor.get_stats()

    active_tools_count = sum(1 for t in tools_data if t["status"] == "active")
    total_tools_count = len(tools_data)

    # Global Security Index calculation
    # Base is port score (50%) + tools protection (30%) + active attacks penalty (20%)
    port_component = ports_data["score"] * 0.50
    tools_component = (active_tools_count / max(1, len([t for t in tools_data if t["recommended"]]))) * 30
    attack_penalty = min(20, attack_stats["total_attacks"] * 2)
    overall_score = max(0, min(100, int(port_component + tools_component - attack_penalty + 10)))

    return {
        "overall_security_score": overall_score,
        "security_level": "EXCELLENT" if overall_score >= 85 else ("BON" if overall_score >= 70 else ("ATTENTION" if overall_score >= 50 else "CRITIQUE")),
        "open_ports_count": ports_data["total_open"],
        "critical_ports_count": ports_data["risk_breakdown"].get("critical", 0),
        "high_ports_count": ports_data["risk_breakdown"].get("high", 0),
        "active_tools_count": active_tools_count,
        "total_tools_count": total_tools_count,
        "recent_attacks_count": attack_stats["total_attacks"],
        "banned_ips_count": attack_stats["total_banned"]
    }
