"""NCPOR live environment page collector.

The NCPOR live pages (https://data.ncpor.res.in/{maitri,bharati}/live) are not a
REST API - they are HTML pages whose current readings are embedded in specific
element ids. This module fetches the page with `requests`, parses the values out
with BeautifulSoup, and validates them before they are trusted anywhere else in
the system. Values are never hard-coded: every call re-fetches the live page.
"""

import logging
import re
from dataclasses import dataclass
from datetime import datetime, timezone
from typing import Literal

import requests
from bs4 import BeautifulSoup

from app.config import get_settings

logger = logging.getLogger("ncpor")

Station = Literal["Maitri", "Bharati"]

FIELD_IDS = {
    "temperature_c": "divtemp",
    "humidity_percent": "divrh",
    "pressure_mbar": "divap",
    "wind_speed_knots": "divw",
}

# Sanity bounds used to reject obviously malformed / corrupted scrapes.
VALID_RANGES = {
    "temperature_c": (-90.0, 50.0),
    "humidity_percent": (0.0, 100.0),
    "pressure_mbar": (700.0, 1100.0),
    "wind_speed_knots": (0.0, 200.0),
}

_NUMBER_PATTERN = re.compile(r"[-+]?\d+(?:\.\d+)?")


class NCPORFetchError(Exception):
    """Raised when the NCPOR page cannot be retrieved."""


class NCPORParseError(Exception):
    """Raised when a required field is missing or malformed in the NCPOR page."""


@dataclass
class NCPORReading:
    station: Station
    timestamp: str
    temperature_c: float
    humidity_percent: float
    pressure_mbar: float
    wind_speed_knots: float
    source: str = "NCPOR"
    data_type: str = "REAL"
    status: str = "LIVE"

    def as_dict(self) -> dict:
        return {
            "station": self.station,
            "timestamp": self.timestamp,
            "temperature_c": self.temperature_c,
            "humidity_percent": self.humidity_percent,
            "pressure_mbar": self.pressure_mbar,
            "wind_speed_knots": self.wind_speed_knots,
            "source": self.source,
            "data_type": self.data_type,
            "status": self.status,
        }


def _station_url(station: Station) -> str:
    settings = get_settings()
    return settings.ncpor_maitri_url if station == "Maitri" else settings.ncpor_bharati_url


def _fetch_html(url: str) -> str:
    settings = get_settings()
    try:
        response = requests.get(
            url,
            timeout=settings.ncpor_request_timeout,
            headers={"User-Agent": "AntarcticOperationsDigitalTwin/1.0"},
        )
        response.raise_for_status()
    except requests.exceptions.Timeout as exc:
        raise NCPORFetchError(f"Timed out fetching {url}") from exc
    except requests.exceptions.ConnectionError as exc:
        raise NCPORFetchError(f"Connection failed fetching {url}") from exc
    except requests.exceptions.HTTPError as exc:
        raise NCPORFetchError(f"HTTP error fetching {url}: {exc}") from exc
    except requests.exceptions.RequestException as exc:
        raise NCPORFetchError(f"Request failed fetching {url}: {exc}") from exc
    return response.text


def _extract_number(soup: BeautifulSoup, field: str, element_id: str) -> float:
    element = soup.find(id=element_id)
    if element is None:
        raise NCPORParseError(f"Missing element #{element_id} for {field}")

    text = element.get_text(strip=True)
    match = _NUMBER_PATTERN.search(text.replace(",", ""))
    if not match:
        raise NCPORParseError(f"No numeric value found for {field} in #{element_id}: {text!r}")

    value = float(match.group(0))
    low, high = VALID_RANGES[field]
    if not (low <= value <= high):
        raise NCPORParseError(f"{field} value {value} outside valid range [{low}, {high}]")
    return value


def _parse_reading(station: Station, html: str) -> NCPORReading:
    soup = BeautifulSoup(html, "html.parser")
    values = {
        field: _extract_number(soup, field, element_id) for field, element_id in FIELD_IDS.items()
    }
    timestamp = datetime.now(timezone.utc).isoformat()
    return NCPORReading(station=station, timestamp=timestamp, **{k: round(v, 2) for k, v in values.items()})


def fetch_station_live(station: Station) -> NCPORReading:
    """Fetch, parse and validate the live reading for a single station.

    Raises NCPORFetchError / NCPORParseError on failure - callers are
    responsible for falling back to the last known-good reading.
    """
    url = _station_url(station)
    html = _fetch_html(url)
    return _parse_reading(station, html)


def fetch_maitri_live() -> NCPORReading:
    return fetch_station_live("Maitri")


def fetch_bharati_live() -> NCPORReading:
    return fetch_station_live("Bharati")
