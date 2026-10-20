import requests
import logging
from typing import Dict, Any

logger = logging.getLogger("pisentinel.geoip")

# In-memory LRU cache to avoid rate limits
GEO_CACHE: Dict[str, Dict[str, Any]] = {
    "127.0.0.1": {"country": "Localhost", "country_code": "LOC", "city": "Raspberry Pi", "lat": 0.0, "lon": 0.0},
    "::1": {"country": "Localhost", "country_code": "LOC", "city": "Raspberry Pi", "lat": 0.0, "lon": 0.0},
}

def is_private_ip(ip: str) -> bool:
    if ip.startswith("10.") or ip.startswith("192.168.") or ip.startswith("127."):
        return True
    if ip.startswith("172."):
        parts = ip.split(".")
        if len(parts) >= 2 and parts[1].isdigit():
            second = int(parts[1])
            if 16 <= second <= 31:
                return True
    return False

def get_ip_location(ip: str) -> Dict[str, Any]:
    """
    Retrieves geographic information for an IP address.
    Uses free ip-api.com with memory caching.
    """
    if not ip or ip in ("localhost", "0.0.0.0"):
        return {"country": "Local", "country_code": "LOC", "city": "Raspberry Pi", "lat": 48.8566, "lon": 2.3522}

    if is_private_ip(ip):
        return {"country": "Réseau Local", "country_code": "LAN", "city": "LAN", "lat": 48.8566, "lon": 2.3522}

    if ip in GEO_CACHE:
        return GEO_CACHE[ip]

    try:
        url = f"http://ip-api.com/json/{ip}?fields=status,country,countryCode,city,lat,lon,org"
        res = requests.get(url, timeout=3)
        if res.status_code == 200:
            data = res.json()
            if data.get("status") == "success":
                geo = {
                    "country": data.get("country", "Inconnu"),
                    "country_code": data.get("countryCode", "UN"),
                    "city": data.get("city", ""),
                    "lat": data.get("lat", 0.0),
                    "lon": data.get("lon", 0.0),
                    "org": data.get("org", "ISP Inconnu")
                }
                GEO_CACHE[ip] = geo
                return geo
    except Exception as e:
        logger.debug(f"GeoIP error for {ip}: {e}")

    fallback = {"country": "Inconnu", "country_code": "UN", "city": "N/A", "lat": 20.0, "lon": 0.0}
    GEO_CACHE[ip] = fallback
    return fallback
