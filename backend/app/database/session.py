import os
from pathlib import Path

from sqlalchemy import create_engine
from sqlalchemy.orm import DeclarativeBase, sessionmaker
from sqlalchemy.pool import StaticPool

from app.config import get_settings


def _build_engine():
    settings = get_settings()
    url = settings.database_url
    # Managed Postgres providers (Render, Heroku, etc.) hand out "postgres://"
    # URLs; SQLAlchemy 2.x only recognizes the "postgresql://" scheme.
    if url.startswith("postgres://"):
        url = "postgresql://" + url[len("postgres://"):]
    engine_kwargs = {}
    if url.startswith("sqlite"):
        # sqlite:///./data/antarctic_ops.db -> ensure parent dir exists.
        path_part = url.split("sqlite:///")[-1]
        connect_args = {"check_same_thread": False}
        if path_part in (":memory:", ""):
            # A single shared connection is required so every session sees
            # the same in-memory database (used by the test suite).
            engine_kwargs["poolclass"] = StaticPool
        else:
            db_path = Path(path_part)
            db_path.parent.mkdir(parents=True, exist_ok=True)
        engine_kwargs["connect_args"] = connect_args
    return create_engine(url, **engine_kwargs)


engine = _build_engine()
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)


class Base(DeclarativeBase):
    pass


def init_db() -> None:
    from app import models  # noqa: F401 ensures models are registered

    Base.metadata.create_all(bind=engine)


def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()
