// Client for the Python/FastAPI backend (backend/app). This is separate from
// the tRPC client in ./trpc.ts, which only serves auth/system routes - all
// station domain data (environment, infrastructure, energy, logistics,
// connectivity, safe operating capacity, decisions, what-if simulation) comes
// from this REST API instead.

export type StationKey = "Maitri" | "Bharati";
export type ConnectivityState = "CONNECTED" | "DEGRADED" | "BLACKOUT";
export type RiskLevel = "LOW" | "MODERATE" | "HIGH" | "CRITICAL";

export type LiveEnvironment = {
  station: StationKey;
  timestamp: string;
  temperature_c: number;
  humidity_percent: number;
  pressure_mbar: number;
  wind_speed_knots: number;
  source: "NCPOR";
  data_type: "REAL";
  status: "LIVE" | "STALE";
  last_updated: string;
};

export type InfrastructureState = {
  station: StationKey;
  timestamp: string;
  buildings_nominal: number;
  buildings_total: number;
  utilities_nominal: number;
  utilities_total: number;
  equipment_nominal: number;
  equipment_total: number;
  critical_systems_nominal: number;
  critical_systems_total: number;
  source: "SIMULATED";
};

export type EnergyState = {
  station: StationKey;
  timestamp: string;
  generator_output_kw: number;
  total_consumption_kw: number;
  critical_load_kw: number;
  non_critical_load_kw: number;
  available_power_kw: number;
  generator_status: string;
  source: "SIMULATED";
};

export type LogisticsState = {
  station: StationKey;
  timestamp: string;
  fuel_stock_percent: number;
  fuel_consumption_rate_percent_per_day: number;
  safety_reserve_percent: number;
  essential_supplies_percent: number;
  remaining_operational_days: number;
  source: "SIMULATED";
};

export type ConnectivityStatusOut = {
  station: StationKey;
  timestamp: string;
  state: ConnectivityState;
  operation_mode: string;
  latency_ms: number;
  source: "SIMULATED";
};

export type LimitingFactor = { domain: string; score: number; reason: string };

export type SafeOperatingCapacity = {
  safe_capacity_percent: number;
  risk_level: RiskLevel;
  limiting_factors: LimitingFactor[];
  recommended_action: string;
  domain_scores: Record<string, number>;
};

export type DigitalTwinState = {
  station: StationKey;
  environment: LiveEnvironment;
  infrastructure: InfrastructureState;
  energy: EnergyState;
  logistics: LogisticsState;
  connectivity: ConnectivityStatusOut;
  safe_operating_capacity: SafeOperatingCapacity;
};

export type DecisionEntry = {
  id: number;
  station: StationKey;
  timestamp: string;
  connectivity_state: string;
  trigger: string;
  rule: string;
  action: string;
  safety_limit: string;
  outcome: string;
  status: string;
};

export type SimulateRequest = {
  temperature_c?: number;
  wind_speed_knots?: number;
  humidity_percent?: number;
  pressure_mbar?: number;
  available_power_kw?: number;
  critical_load_kw?: number;
  fuel_level_percent?: number;
  connectivity?: ConnectivityState;
};

export type SimulateResponse = {
  station: StationKey;
  current_state: DigitalTwinState;
  simulated_state: DigitalTwinState;
};

const API_BASE_URL = (import.meta.env.VITE_API_BASE_URL as string | undefined)?.replace(/\/+$/, "") || "http://localhost:8000";

async function apiFetch<T>(path: string, init?: RequestInit): Promise<T> {
  const response = await fetch(`${API_BASE_URL}${path}`, {
    headers: { "Content-Type": "application/json" },
    ...init,
  });
  if (!response.ok) {
    throw new Error(`API ${path} failed: ${response.status} ${response.statusText}`);
  }
  return response.json() as Promise<T>;
}

export const api = {
  digitalTwin: (station: StationKey) => apiFetch<DigitalTwinState>(`/api/stations/${station}/digital-twin`),
  environmentLive: (station: StationKey) => apiFetch<LiveEnvironment>(`/api/stations/${station}/environment/live`),
  decisions: (station: StationKey) => apiFetch<DecisionEntry[]>(`/api/stations/${station}/decisions`),
  setConnectivity: (station: StationKey, state: ConnectivityState) =>
    apiFetch<ConnectivityStatusOut>(`/api/stations/${station}/connectivity`, {
      method: "POST",
      body: JSON.stringify({ state }),
    }),
  simulate: (station: StationKey, body: SimulateRequest) =>
    apiFetch<SimulateResponse>(`/api/stations/${station}/simulate`, {
      method: "POST",
      body: JSON.stringify(body),
    }),
};

export function stationWebSocketUrl(station: StationKey): string {
  const wsBase = API_BASE_URL.replace(/^http/, "ws");
  return `${wsBase}/ws/stations/${station}`;
}
