from unittest.mock import patch

import pytest

from app.collectors.ncpor import NCPORFetchError, NCPORReading
from app.services import environment_service


def _reading(temp=-15.94):
    return NCPORReading(
        station="Maitri",
        timestamp="2026-01-01T00:00:00+00:00",
        temperature_c=temp,
        humidity_percent=42.78,
        pressure_mbar=968.33,
        wind_speed_knots=28.26,
    )


class TestCollectStation:
    @patch("app.services.environment_service.fetch_station_live")
    def test_success_returns_live_and_caches(self, mock_fetch):
        mock_fetch.return_value = _reading()
        result = environment_service.collect_station("Maitri")
        assert result.status == "LIVE"
        assert result.temperature_c == -15.94
        assert environment_service.get_cached("Maitri") is not None

    @patch("app.services.environment_service.fetch_station_live")
    def test_failure_without_cache_raises(self, mock_fetch):
        mock_fetch.side_effect = NCPORFetchError("down")
        with pytest.raises(NCPORFetchError):
            environment_service.collect_station("Maitri")

    @patch("app.services.environment_service.fetch_station_live")
    def test_failure_with_cache_returns_stale_not_live(self, mock_fetch):
        mock_fetch.return_value = _reading()
        environment_service.collect_station("Maitri")

        mock_fetch.side_effect = NCPORFetchError("down")
        result = environment_service.collect_station("Maitri")

        assert result.status == "STALE"
        assert result.temperature_c == -15.94  # last known-good value retained

    def test_server_never_crashes_when_ncpor_unreachable(self):
        # Never having collected before and never having a cache should raise
        # a normal Python exception (caught by the collector loop), not crash
        # the process.
        with patch("app.services.environment_service.fetch_station_live", side_effect=NCPORFetchError("down")):
            with pytest.raises(NCPORFetchError):
                environment_service.collect_station("Bharati")
