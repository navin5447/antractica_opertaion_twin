# Antarctic Operations Digital Twin (Maitri & Bharati)

A comprehensive operational digital twin and decision support platform for India's Antarctic research stations (Maitri and Bharati). The system integrates real-time environmental data with simulated domain telemetry (infrastructure, microgrid power, supply logistics, satellite connectivity) and a deterministic decision engine for safe autonomous operation during connectivity blackouts.

---

## 🌟 Key Features

- **Live & Simulated Telemetry**: Real-time environmental metrics scraped from NCPOR live feeds alongside deterministic physics/station simulation models for life support, microgrid, logistics, and satcom links.
- **Deterministic Decision Engine & Safe Operating Capacity (SOC)**: Continuous computation of facility operating headroom and autonomous response rules.
- **Bounded Autonomy FSM**: Automatic failover state machine (`CONNECTED`, `DEGRADED`, `BLACKOUT`) enabling pre-approved autonomous operations during communication blackouts.
- **Immutable Decision Ledger**: Cryptographically verifiable and traceable audit log of all station decisions, alarms, and operator overrides.
- **Mission Control UI**: Interactive dashboard featuring real-time charts, facility status monitors, 3D station models, emergency protocols, and satellite uplink telemetry.
- **FastAPI & WebSocket Backend**: Low-latency REST endpoints and live WebSocket push for real-time station state synchronization.

---

## 🏗️ Architecture

```
                                  ┌───────────────────────────────┐
                                  │   NCPOR Station Live Feeds    │
                                  └──────────────┬────────────────┘
                                                 │
                                                 ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│ FastAPI Backend                                                             │
│                                                                             │
│  ┌────────────────────────┐         ┌────────────────────────────────────┐  │
│  │ Environmental Collector│         │ Simulated Station Domain Models    │  │
│  │ (Live NCPOR Scraper)   │         │ (Infra, Microgrid, Logistics, FSM) │  │
│  └───────────┬────────────┘         └─────────────────┬──────────────────┘  │
│              └───────────────────┬────────────────────┘                     │
│                                  ▼                                          │
│                      ┌───────────────────────┐                              │
│                      │  Digital Twin State   │                              │
│                      └───────────┬───────────┘                              │
│                                  ▼                                          │
│                      ┌───────────────────────┐                              │
│                      │ Deterministic Engine  │                              │
│                      │ (Capacity, FSM, Auto) │                              │
│                      └───────────┬───────────┘                              │
│                                  │                                          │
│                  ┌───────────────┴───────────────┐                          │
│                  ▼                               ▼                          │
│          ┌───────────────┐               ┌───────────────┐                  │
│          │ REST Endpoints│               │   WebSocket   │                  │
│          └───────┬───────┘               └───────┬───────┘                  │
└──────────────────┼───────────────────────────────┼──────────────────────────┘
                   │                               │
                   ▼                               ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│ React + TypeScript Frontend (Mission Control Dashboard)                    │
│                                                                             │
│  • Station Overview & Safe Operating Capacity (SOC) Gauge                   │
│  • Microgrid & Power Distribution telemetry                                 │
│  • Life Support, HVAC, & Fuel Logistics Monitor                             │
│  • Live NCPOR Environmental Weather Station feed                            │
│  • Autonomous Decision Ledger & Blackout Incident Protocol                  │
└─────────────────────────────────────────────────────────────────────────────┘
```

---

## 🚀 Quick Start

### Prerequisites
- Node.js (v18+) & `pnpm`
- Python 3.10+ (for FastAPI backend)

### 1. Backend Setup

```bash
cd backend
python -m venv .venv

# On Windows:
.venv\Scripts\activate
# On Linux/macOS:
# source .venv/bin/activate

pip install -r requirements.txt
uvicorn app.main:app --reload --port 8000
```

### 2. Frontend Setup

```bash
# In the project root directory
pnpm install
pnpm dev
```

The frontend will be available at `http://localhost:5173` (or the port specified by Vite), connecting seamlessly to the backend on `http://localhost:8000`.

---

## 🛠️ Tech Stack

- **Frontend**: React 19, TypeScript, Vite, TailwindCSS, Radix UI, Lucide Icons, Framer Motion, Recharts
- **Backend**: FastAPI, Uvicorn, Pydantic, SQLAlchemy / SQLite, WebSockets, BeautifulSoup4, Requests
- **Testing**: Vitest, Pytest

---

## 📜 License

MIT License.
