from functools import lru_cache
from typing import List

from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", extra="ignore")

    host: str = "0.0.0.0"
    port: int = 8000
    allowed_origins: str = "http://localhost:5173,http://localhost:3000"

    database_url: str = "sqlite:///./data/antarctic_ops.db"

    ncpor_maitri_url: str = "https://data.ncpor.res.in/maitri/live"
    ncpor_bharati_url: str = "https://data.ncpor.res.in/bharati/live"
    ncpor_refresh_interval: int = 600
    ncpor_request_timeout: int = 15

    wind_speed_limit_knots: float = 35.0
    temp_low_limit_c: float = -35.0
    temp_high_limit_c: float = 5.0
    critical_load_margin_kw: float = 50.0
    fuel_safety_reserve_percent: float = 40.0
    fuel_warning_buffer_percent: float = 10.0

    @property
    def allowed_origins_list(self) -> List[str]:
        return [origin.strip() for origin in self.allowed_origins.split(",") if origin.strip()]


@lru_cache
def get_settings() -> Settings:
    return Settings()
