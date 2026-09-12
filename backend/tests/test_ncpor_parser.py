from unittest.mock import Mock, patch

import pytest
import requests

from app.collectors.ncpor import NCPORFetchError, NCPORParseError, fetch_bharati_live, fetch_maitri_live, fetch_station_live

VALID_HTML = """
<html><body>
<div id="divtemp">-15.94 &deg;C</div>
<div id="divrh">42.78 %</div>
<div id="divap">968.33 mbar</div>
<div id="divw">28.26 knots</div>
</body></html>
"""


def _mock_response(text: str, status_code: int = 200) -> Mock:
    response = Mock()
    response.text = text
    response.status_code = status_code
    if status_code >= 400:
        response.raise_for_status.side_effect = requests.exceptions.HTTPError(f"{status_code} error")
    else:
        response.raise_for_status.return_value = None
    return response


class TestSuccessfulParse:
    @patch("app.collectors.ncpor.requests.get")
    def test_parses_all_fields(self, mock_get):
        mock_get.return_value = _mock_response(VALID_HTML)
        reading = fetch_station_live("Maitri")

        assert reading.station == "Maitri"
        assert reading.temperature_c == -15.94
        assert reading.humidity_percent == 42.78
        assert reading.pressure_mbar == 968.33
        assert reading.wind_speed_knots == 28.26
        assert reading.source == "NCPOR"
        assert reading.data_type == "REAL"
        assert reading.status == "LIVE"

    @patch("app.collectors.ncpor.requests.get")
    def test_fetch_maitri_and_bharati_use_distinct_urls(self, mock_get):
        mock_get.return_value = _mock_response(VALID_HTML)
        fetch_maitri_live()
        fetch_bharati_live()
        urls = [call.args[0] for call in mock_get.call_args_list]
        assert urls[0] != urls[1]


class TestMissingFields:
    @patch("app.collectors.ncpor.requests.get")
    def test_missing_element_raises_parse_error(self, mock_get):
        html = '<html><body><div id="divtemp">-15.94</div></body></html>'
        mock_get.return_value = _mock_response(html)
        with pytest.raises(NCPORParseError):
            fetch_station_live("Maitri")

    @patch("app.collectors.ncpor.requests.get")
    def test_malformed_value_raises_parse_error(self, mock_get):
        html = """
        <div id="divtemp">N/A</div><div id="divrh">42.78</div>
        <div id="divap">968.33</div><div id="divw">28.26</div>
        """
        mock_get.return_value = _mock_response(html)
        with pytest.raises(NCPORParseError):
            fetch_station_live("Maitri")

    @patch("app.collectors.ncpor.requests.get")
    def test_out_of_range_value_raises_parse_error(self, mock_get):
        html = """
        <div id="divtemp">500</div><div id="divrh">42.78</div>
        <div id="divap">968.33</div><div id="divw">28.26</div>
        """
        mock_get.return_value = _mock_response(html)
        with pytest.raises(NCPORParseError):
            fetch_station_live("Maitri")


class TestConnectionFailure:
    @patch("app.collectors.ncpor.requests.get")
    def test_connection_error_raises_fetch_error(self, mock_get):
        mock_get.side_effect = requests.exceptions.ConnectionError("no route")
        with pytest.raises(NCPORFetchError):
            fetch_station_live("Maitri")

    @patch("app.collectors.ncpor.requests.get")
    def test_timeout_raises_fetch_error(self, mock_get):
        mock_get.side_effect = requests.exceptions.Timeout("timed out")
        with pytest.raises(NCPORFetchError):
            fetch_station_live("Maitri")

    @patch("app.collectors.ncpor.requests.get")
    def test_http_error_raises_fetch_error(self, mock_get):
        mock_get.return_value = _mock_response("", status_code=503)
        with pytest.raises(NCPORFetchError):
            fetch_station_live("Maitri")
