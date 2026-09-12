import logging
from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.api import connectivity, decisions, energy, environment, infrastructure, logistics, simulation, stations, websocket
from app.config import get_settings
from app.database import init_db
from app.services import collector_loop

logging.basicConfig(level=logging.INFO, format="%(asctime)s [%(levelname)s] %(name)s: %(message)s")


@asynccontextmanager
async def lifespan(app: FastAPI):
    init_db()
    collector_loop.start()
    try:
        yield
    finally:
        collector_loop.stop()


app = FastAPI(
    title="Antarctic Operations Digital Twin API",
    description=(
        "Backend for the Antarctic Operations Digital Twin (Maitri / Bharati). "
        "Environment data is REAL (scraped live from NCPOR); Infrastructure, "
        "Energy, Logistics and Connectivity are SIMULATED. Safe Operating "
        "Capacity, the connectivity state machine and bounded autonomy are all "
        "deterministic rule/constraint evaluations - no ML."
    ),
    version="1.0.0",
    lifespan=lifespan,
)

settings = get_settings()

app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.allowed_origins_list,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(stations.router)
app.include_router(environment.router)
app.include_router(infrastructure.router)
app.include_router(energy.router)
app.include_router(logistics.router)
app.include_router(connectivity.router)
app.include_router(decisions.router)
app.include_router(simulation.router)
app.include_router(websocket.router)


@app.get("/health")
def health():
    return {
        "status": "ok",
        "ncpor_refresh_interval_seconds": settings.ncpor_refresh_interval,
    }
