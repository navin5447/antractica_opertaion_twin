import os
import sys
from pathlib import Path

import pytest

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

os.environ.setdefault("DATABASE_URL", "sqlite:///:memory:")
os.environ.setdefault("ALLOWED_ORIGINS", "http://localhost:5173")

from app.config import get_settings  # noqa: E402
from app.database.session import Base, engine  # noqa: E402
from app import models  # noqa: E402,F401


@pytest.fixture(autouse=True)
def _reset_state():
    """Isolate every test: fresh schema, cleared settings cache, cleared
    in-process caches (NCPOR last-good reading, simulated domain state)."""
    get_settings.cache_clear()
    Base.metadata.drop_all(bind=engine)
    Base.metadata.create_all(bind=engine)

    from app.services import environment_service

    environment_service._last_good.clear()
    environment_service._fetched_at_monotonic.clear()

    yield


@pytest.fixture
def db_session():
    from app.database.session import SessionLocal

    session = SessionLocal()
    try:
        yield session
    finally:
        session.close()
