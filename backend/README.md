# Antarctic Operations Digital Twin — Backend

FastAPI backend for the Antarctic Operations Digital Twin (Maitri / Bharati). It
serves the existing React/Manus frontend in `../client` over a REST + WebSocket
API and replaces the frontend's mock data with real and simulated station
state.

## What's REAL vs SIMULATED

| Domain | Status | Source |
|---|---|---|
| **Environment** (temperature, humidity, pressure, wind) | **REAL** | Scraped live from the NCPOR station pages (`data.ncpor.res.in/{maitri,bharati}/live`) |
| Infrastructure | SIMULATED | Deterministic in-process station model |
| Energy | SIMULATED | Deterministic in-process station model |
| Logistics | SIMULATED | Deterministic in-process station model |
| Connectivity | SIMULATED | Finite state machine (CONNECTED / DEGRADED / BLACKOUT) |

Everything downstream of these — Safe Operating Capacity, the connectivity
state machine, bounded autonomy, and the Decision Ledger — is **deterministic
rule/constraint evaluation**. There is no machine learning, no model, and no
randomness anywhere in the decision path.

## Architecture

```
NCPOR live pages ──requests+BeautifulSoup──▶ collectors/ncpor.py
                                                     │
                                                     ▼
                                          services/environment_service.py
                                          (cache + STALE fallback + persist)
                                                     │
      services/{infrastructure,energy,logistics,connectivity}_service.py
                                (SIMULATED domain state)
                                                     │
                                                     ▼
                                         digital_twin/state.py
                                    (aggregates all 4 domains per station)
                                                     │
                                                     ▼
                              decision_engine/capacity.py (Safe Operating Capacity)
                              decision_engine/fsm.py (connectivity state machine)
                              decision_engine/bounded_autonomy.py (pre-approved actions)
                              decision_engine/ledger_service.py (Decision Ledger)
                                                     │
                              ┌──────────────────────┴──────────────────────┐
                              ▼                                             ▼
                       FastAPI REST API                              WebSocket
                    (api/*.py, consumed by the                 (/ws/stations/{station},
                     existing React frontend)                   pushed by the collector loop)
```

A background collector (`services/collector_loop.py`) runs every
`NCPOR_REFRESH_INTERVAL` seconds (default 600s / 10 min). Each cycle it:

1. Fetches and validates live NCPOR environment data for both stations.
2. Advances the simulated Infrastructure / Energy / Logistics snapshots.
3. Re-evaluates Safe Operating Capacity and, if a station is in `BLACKOUT`,
   runs the bounded-autonomy cycle (Phase 12) and records any resulting
   decision to the ledger.
4. Broadcasts the updated Digital Twin state to any WebSocket clients
   subscribed to that station.

If NCPOR is unreachable, the error is logged, the previous successful reading
is kept and marked `STALE`, and the server keeps running — it never crashes
because an external source is unavailable (Phase 18).

## Setup

```bash
cd backend
python -m venv .venv
.venv\Scripts\activate        # Windows
# source .venv/bin/activate   # macOS/Linux
pip install -r requirements.txt
copy .env.example .env        # Windows: copy, macOS/Linux: cp
```

### Environment variables (`.env`)

| Variable | Default | Purpose |
|---|---|---|
| `HOST` / `PORT` | `0.0.0.0` / `8000` | Uvicorn bind address |
| `ALLOWED_ORIGINS` | `http://localhost:5173,http://localhost:3000` | CORS allow-list for the React dev server (comma-separated, never `*` in production) |
| `DATABASE_URL` | `sqlite:///./data/antarctic_ops.db` | SQLAlchemy URL. Use a `postgresql+psycopg2://...` URL for PostgreSQL in production; defaults to a local SQLite file with zero setup |
| `NCPOR_MAITRI_URL` / `NCPOR_BHARATI_URL` | NCPOR live pages | Source pages for the collector |
| `NCPOR_REFRESH_INTERVAL` | `600` | Seconds between collector cycles |
| `NCPOR_REQUEST_TIMEOUT` | `15` | HTTP timeout (seconds) per NCPOR fetch |
| `WIND_SPEED_LIMIT_KNOTS`, `TEMP_LOW_LIMIT_C`, `TEMP_HIGH_LIMIT_C` | `35`, `-35`, `5` | Environmental thresholds for Safe Operating Capacity |
| `CRITICAL_LOAD_MARGIN_KW` | `50` | Minimum comfortable margin between available power and critical load |
| `FUEL_SAFETY_RESERVE_PERCENT`, `FUEL_WARNING_BUFFER_PERCENT` | `40`, `10` | Logistics fuel thresholds (a station's own configured reserve, held per-station, takes precedence when set) |

### Database

- **PostgreSQL** (recommended for a persistent/shared deployment): set
  `DATABASE_URL=postgresql+psycopg2://user:password@host:5432/antarctic_ops`.
  Create the database first (`createdb antarctic_ops` or equivalent); tables
  are created automatically on startup via SQLAlchemy metadata.
- **SQLite** (default, zero setup): a local file is created automatically at
  `backend/data/antarctic_ops.db` on first run.

Tables: `environment_readings`, `infrastructure_status`, `energy_status`,
`logistics_status`, `connectivity_status`, `decision_ledger`.

### Run

```bash
uvicorn app.main:app --reload --port 8000
```

Then check `http://localhost:8000/health` and `http://localhost:8000/docs`
(interactive OpenAPI docs).

### Run the frontend against it

From the repo root:

```bash
copy .env.example .env   # sets VITE_API_BASE_URL=http://localhost:8000
pnpm install
pnpm dev
```

The existing React/Manus dashboard (`client/`) reads `VITE_API_BASE_URL` (see
`client/src/lib/api.ts`) to call this backend directly for every domain
(environment, infrastructure, energy, logistics, connectivity, Safe Operating
Capacity, Decision Ledger, What-If Simulator). Its own Node/tRPC server
(`server/`) is unrelated to this backend and only serves auth/system routes.

## Tests

```bash
cd backend
pytest
```

Tests never call the real NCPOR site — every test that touches the collector
mocks `requests.get` / `fetch_station_live`. Coverage includes the NCPOR
parser (success, missing fields, malformed values, connection/timeout/HTTP
failures), Safe Operating Capacity (energy, fuel-reserve and environmental
constraints), the connectivity state machine, bounded autonomy action
selection, the Decision Ledger, and the What-If Simulator.

## API reference

All station endpoints take `station` as `Maitri` or `Bharati` (case-insensitive).

| Method | Path | Description |
|---|---|---|
| GET | `/health` | Liveness check |
| GET | `/api/stations` | List of stations |
| GET | `/api/stations/{station}/state` | Raw per-domain state (no capacity calc) |
| GET | `/api/stations/{station}/digital-twin` | **Main endpoint** — full aggregated state + Safe Operating Capacity |
| GET | `/api/stations/{station}/environment/live` | REAL NCPOR environment reading (LIVE or STALE) |
| GET | `/api/stations/{station}/infrastructure` | SIMULATED infrastructure state |
| GET | `/api/stations/{station}/energy` | SIMULATED energy state |
| GET | `/api/stations/{station}/logistics` | SIMULATED logistics state |
| GET | `/api/stations/{station}/connectivity` | Current connectivity state + operation mode |
| POST | `/api/stations/{station}/connectivity` | Set connectivity (`CONNECTED`/`DEGRADED`/`BLACKOUT`); triggers bounded autonomy evaluation |
| GET | `/api/stations/{station}/decisions` | Decision Ledger (most recent first) |
| POST | `/api/stations/{station}/simulate` | What-If Simulator — evaluates hypothetical inputs without mutating real state |
| WS | `/ws/stations/{station}` | Live Digital Twin state push (sent on every collector cycle and on connectivity change) |

## Safe Operating Capacity

`decision_engine/capacity.py` scores each of the four domains 0–100 using
fixed rules and thresholds (never randomness, never a model):

- **Environment**: penalized when wind speed or temperature exceed configured
  limits.
- **Energy**: penalized when the margin between available power and critical
  load shrinks below `CRITICAL_LOAD_MARGIN_KW`, and scored critical if
  available power drops below the critical load itself.
- **Logistics**: penalized as fuel stock approaches or crosses the station's
  safety reserve.
- **Infrastructure**: penalized if any critical system is not nominal, or for
  outstanding equipment service flags.

The overall `safe_capacity_percent` is the **minimum** of the four domain
scores (the operating envelope is bounded by its weakest constraint), the
`risk_level` is derived from that value (`LOW` ≥ 85, `MODERATE` ≥ 65, `HIGH`
≥ 40, else `CRITICAL`), and `limiting_factors` lists every domain scoring
below 85, weakest first.

## Blackout operation & bounded autonomy

`decision_engine/fsm.py` implements the connectivity state machine:

- `CONNECTED` → **HQ SUPERVISION**
- `DEGRADED` → **LOCAL ASSISTED OPERATION**
- `BLACKOUT` → **LOCAL AUTONOMOUS OPERATION**

When a station enters `BLACKOUT`, `digital_twin/state.run_autonomous_cycle`
evaluates the full station state, recalculates Safe Operating Capacity, and —
only if a rule threshold is actually crossed — selects exactly one action
from a **fixed catalog of four pre-approved actions**
(`decision_engine/bounded_autonomy.py`): the system can never invent an
action.

| Trigger | Rule | Action | Safety limit |
|---|---|---|---|
| Available power below required critical load | Prioritize essential systems | Prioritize essential energy usage | Critical load must remain supplied |
| Available power below threshold margin | Protect critical loads | Reduce non-critical loads | Critical load must remain supplied |
| Fuel stock approaching or at safety reserve | Protect minimum fuel reserve | Protect minimum fuel reserve | Fuel stock must not fall below the safety reserve |
| Environmental or infrastructure risk elevated | Recalculate safe operating capacity | Reduce non-essential operations | Critical systems must remain within operating limits |

No physical control is performed — this is a software decision-record
prototype. Every executed action is written to the Decision Ledger.

## Decision Ledger

Every autonomous decision is persisted to `decision_ledger`
(`station`, `timestamp`, `connectivity_state`, `trigger`, `rule`, `action`,
`safety_limit`, `outcome`, `status`) and served via
`GET /api/stations/{station}/decisions`, most recent first. Repeated
identical decisions across collector cycles are not re-recorded — only a
change in the underlying situation produces a new ledger entry.
