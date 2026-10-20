import os
import platform
from typing import List
from pydantic_settings import BaseSettings

class Settings(BaseSettings):
    SECRET_KEY: str = "pisentinel_super_secret_jwt_key_rpi_2026_change_in_production!"
    ALGORITHM: str = "HS256"
    ACCESS_TOKEN_EXPIRE_MINUTES: int = 60 * 24  # 24 hours

    GOOGLE_CLIENT_ID: str = ""
    ALLOWED_EMAILS: str = ""

    ADMIN_USERNAME: str = "admin"
    ADMIN_PASSWORD: str = "admin"

    ENVIRONMENT: str = "development"
    SIMULATION_MODE: str = "auto"

    HOST: str = "0.0.0.0"
    PORT: int = 8000
    ROOT_PATH: str = ""
    CORS_ORIGINS: str = "*"

    class Config:
        env_file = os.path.join(os.path.dirname(os.path.dirname(os.path.dirname(__file__))), ".env")
        env_file_encoding = "utf-8"
        extra = "ignore"

    @property
    def allowed_email_list(self) -> List[str]:
        if not self.ALLOWED_EMAILS:
            return []
        return [e.strip().lower() for e in self.ALLOWED_EMAILS.split(",") if e.strip()]

    def is_email_allowed(self, email: str) -> bool:
        allowed = self.allowed_email_list
        # If no allowed emails are specified, in development mode we can allow or notify
        if not allowed:
            return True
        return email.strip().lower() in allowed

    @property
    def is_simulation(self) -> bool:
        mode = self.SIMULATION_MODE.lower()
        if mode in ("true", "1", "yes"):
            return True
        if mode in ("false", "0", "no"):
            return False
        # auto mode: if not Linux, or if /var/log/auth.log doesn't exist, use simulation
        is_linux = platform.system() == "Linux"
        has_auth_log = os.path.exists("/var/log/auth.log") or os.path.exists("/var/log/secure")
        return not (is_linux and has_auth_log)

settings = Settings()
