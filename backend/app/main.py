import os
import logging
from contextlib import asynccontextmanager
from fastapi import FastAPI, Request, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from fastapi.responses import FileResponse, RedirectResponse

from app.core.config import settings
from app.services.attack_monitor import attack_monitor
from app.routers import auth, system, ports, security_tools, attacks, ws

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(name)s: %(message)s"
)
logger = logging.getLogger("pisentinel")

@asynccontextmanager
async def lifespan(app: FastAPI):
    # Startup: Launch background attack monitoring loop
    logger.info("Initializing PiSentinel Security Engine...")
    attack_monitor.start()
    logger.info(f"PiSentinel online - Simulation mode: {settings.is_simulation}")
    yield
    # Shutdown
    logger.info("Shutting down PiSentinel Security Engine...")
    attack_monitor._running = False

app = FastAPI(
    title="PiSentinel - Raspberry Pi Security Hub",
    description="All-in-One Real-Time Security Operations Center for Raspberry Pi",
    version="1.0.0",
    lifespan=lifespan
)

# CORS configuration
origins = [o.strip() for o in settings.CORS_ORIGINS.split(",") if o.strip()]
if "*" in origins:
    app.add_middleware(
        CORSMiddleware,
        allow_origins=["*"],
        allow_credentials=True,
        allow_methods=["*"],
        allow_headers=["*"],
    )
else:
    app.add_middleware(
        CORSMiddleware,
        allow_origins=origins,
        allow_credentials=True,
        allow_methods=["*"],
        allow_headers=["*"],
    )

# Security Headers Middleware
@app.middleware("http")
async def add_security_headers(request: Request, call_next):
    response = await call_next(request)
    response.headers["X-Content-Type-Options"] = "nosniff"
    response.headers["X-Frame-Options"] = "DENY"
    response.headers["X-XSS-Protection"] = "1; mode=block"
    response.headers["Referrer-Policy"] = "strict-origin-when-cross-origin"
    return response

# Include API Routers
app.include_router(auth.router)
app.include_router(system.router)
app.include_router(ports.router)
app.include_router(security_tools.router)
app.include_router(attacks.router)
app.include_router(ws.router)

@app.get("/health")
def health_check():
    return {
        "status": "healthy",
        "service": "PiSentinel",
        "simulation_mode": settings.is_simulation
    }

# Frontend Static Files Serving (if built frontend exists)
frontend_dist = os.path.join(os.path.dirname(os.path.dirname(os.path.dirname(__file__))), "frontend", "dist")

if os.path.exists(frontend_dist):
    assets_dir = os.path.join(frontend_dist, "assets")
    if os.path.exists(assets_dir):
        app.mount("/assets", StaticFiles(directory=assets_dir), name="assets")
        app.mount("/sentinel/assets", StaticFiles(directory=assets_dir), name="sentinel_assets")

    @app.get("/sentinel")
    async def redirect_sentinel():
        return RedirectResponse(url="/sentinel/", status_code=301)

    @app.get("/")
    @app.get("/sentinel/")
    async def serve_index():
        index_file = os.path.join(frontend_dist, "index.html")
        if os.path.exists(index_file):
            return FileResponse(index_file)
        return {"detail": "PiSentinel frontend dist missing"}

    @app.get("/{full_path:path}")
    async def serve_spa(full_path: str):
        clean_path = full_path
        if clean_path.startswith("sentinel/"):
            clean_path = clean_path[len("sentinel/"):]
        elif clean_path == "sentinel":
            return RedirectResponse(url="/sentinel/", status_code=301)

        file_path = os.path.join(frontend_dist, clean_path)
        if clean_path and os.path.isfile(file_path):
            return FileResponse(file_path)

        # Never return index.html for missing assets/ or API requests
        if clean_path.startswith("assets/") or clean_path.startswith("api/"):
            raise HTTPException(status_code=404, detail="Fichier introuvable")

        index_file = os.path.join(frontend_dist, "index.html")
        if os.path.exists(index_file):
            return FileResponse(index_file)
        return {"detail": "Not Found"}
else:
    @app.get("/")
    @app.get("/sentinel")
    @app.get("/sentinel/")
    async def serve_missing_frontend():
        return {
            "service": "PiSentinel Security Hub API",
            "status": "online",
            "message": "Le dossier frontend/dist est manquant. Veuillez récupérer la dernière version avec git pull."
        }

if __name__ == "__main__":
    import uvicorn
    uvicorn.run("app.main:app", host=settings.HOST, port=settings.PORT, reload=(settings.ENVIRONMENT == "development"))
