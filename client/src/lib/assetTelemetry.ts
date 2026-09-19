// Generic asset-inspection adapter for the 3D Digital Twin.
//
// This is intentionally a thin, pure-function layer: it reads the SAME
// `DigitalTwinState` object already fetched by Home.tsx (backend digital-twin
// endpoint) and already passed into MaitriStation3D / BharatiStation3D as
// `liveState`. It does not fetch anything, poll anything, or maintain any
// state of its own - it just maps that one existing data source onto the
// fields a given asset type cares about, plus a status derived from the
// backend's own domain scores / connectivity state. No second telemetry
// engine, no invented values: a field is omitted entirely if the backend
// does not provide it.

import type { ConnectivityState, DigitalTwinState } from "@/lib/api";

export type AssetStatus = "NORMAL" | "WARNING" | "CRITICAL";

// Matches the app's existing status vocabulary (badge-success / badge-warning
// / badge-error, tiny-dot good/amber/danger) rather than inventing new colors.
export const STATUS_COLOR: Record<AssetStatus, string> = {
  NORMAL: "#34d399",
  WARNING: "#fbbf24",
  CRITICAL: "#f87171",
};

export const CONNECTIVITY_ASSET_STATUS: Record<ConnectivityState, AssetStatus> = {
  CONNECTED: "NORMAL",
  DEGRADED: "WARNING",
  BLACKOUT: "CRITICAL",
};

// Same cut points the backend's own risk_level uses (LOW >= 85, MODERATE >= 65,
// HIGH >= 40, CRITICAL < 40) collapsed to the three-state badge this panel
// shows - MODERATE and HIGH both read as "needs attention" (WARNING).
export function domainScoreStatus(score: number | undefined): AssetStatus {
  if (score === undefined) return "NORMAL";
  if (score >= 85) return "NORMAL";
  if (score >= 40) return "WARNING";
  return "CRITICAL";
}

export interface TelemetryField {
  label: string;
  value: string;
}

export interface AssetInspectorData {
  status: AssetStatus;
  /** The literal label to display - NORMAL/WARNING/CRITICAL for domain-scored
   * assets, or the real CONNECTED/DEGRADED/BLACKOUT state for the comms asset. */
  statusLabel: string;
  operationalState: string;
  telemetry: TelemetryField[];
  info: TelemetryField[];
  condition: string;
  affects: string[];
  relatedSystems: string[];
}

export type AssetKind = "building" | "power" | "communication" | "fuel" | "logistics" | "environment" | "support";

interface BuildParams {
  assetKind: AssetKind;
  station: "Maitri" | "Bharati";
  assetTag: string;
  assetType: string;
  twin: DigitalTwinState | undefined;
  connectivity: ConnectivityState;
}

function round1(n: number): string {
  return (Math.round(n * 10) / 10).toString();
}

export function buildAssetInspectorData({ assetKind, station, assetTag, assetType, twin, connectivity }: BuildParams): AssetInspectorData {
  const scores = twin?.safe_operating_capacity.domain_scores;
  const baseInfo: TelemetryField[] = [
    { label: "Asset ID", value: assetTag },
    { label: "Asset Type", value: assetType },
    { label: "Station", value: station },
  ];

  switch (assetKind) {
    case "power": {
      const energy = twin?.energy;
      const status = domainScoreStatus(scores?.Energy);
      const margin = energy ? Math.round(energy.available_power_kw - energy.critical_load_kw) : undefined;
      const loadPercent = energy && energy.generator_output_kw > 0 ? Math.round((energy.total_consumption_kw / energy.generator_output_kw) * 100) : undefined;
      const telemetry: TelemetryField[] = [];
      if (energy) {
        telemetry.push({ label: "Available Power", value: `${energy.available_power_kw} kW` });
        telemetry.push({ label: "Critical Load", value: `${energy.critical_load_kw} kW` });
        if (loadPercent !== undefined) telemetry.push({ label: "Load", value: `${loadPercent}%` });
        if (margin !== undefined) telemetry.push({ label: "Available Margin", value: `${margin} kW` });
        telemetry.push({ label: "Generator Status", value: energy.generator_status });
      }
      return {
        status,
        statusLabel: status,
        operationalState: energy?.generator_status === "ONLINE" ? "Running" : energy?.generator_status ?? "Unknown",
        telemetry,
        info: [...baseInfo, { label: "Subsystem", value: "Power" }],
        condition:
          status === "CRITICAL"
            ? "Available power below critical load threshold."
            : status === "WARNING"
            ? "Elevated load is reducing the available operating margin."
            : "Operating within normal parameters.",
        affects: ["Energy availability", "Safe Operating Capacity"],
        relatedSystems: ["Fuel supply", "Power distribution"],
      };
    }
    case "fuel": {
      const logistics = twin?.logistics;
      const status = domainScoreStatus(scores?.Logistics);
      const telemetry: TelemetryField[] = [];
      if (logistics) {
        telemetry.push({ label: "Fuel Stock", value: `${logistics.fuel_stock_percent}%` });
        telemetry.push({ label: "Safety Reserve", value: `${logistics.safety_reserve_percent}%` });
        telemetry.push({ label: "Consumption Rate", value: `${logistics.fuel_consumption_rate_percent_per_day}%/day` });
        telemetry.push({ label: "Estimated Endurance", value: `${logistics.remaining_operational_days} days` });
      }
      return {
        status,
        statusLabel: status,
        operationalState: logistics && logistics.fuel_stock_percent <= logistics.safety_reserve_percent ? "Reserve Protected" : "Nominal",
        telemetry,
        info: [...baseInfo, { label: "Subsystem", value: "Logistics" }],
        condition:
          status === "CRITICAL"
            ? "Fuel stock has reached the safety reserve."
            : status === "WARNING"
            ? "Fuel stock is approaching the safety reserve."
            : "Fuel reserve is within the safe operating band.",
        affects: ["Logistics reserve", "Safe Operating Capacity"],
        relatedSystems: ["Power generation", "Expedition stores"],
      };
    }
    case "communication": {
      const conn = twin?.connectivity;
      const status = CONNECTIVITY_ASSET_STATUS[connectivity];
      const telemetry: TelemetryField[] = [];
      if (conn) {
        telemetry.push({ label: "Latency", value: `${conn.latency_ms} ms` });
        telemetry.push({ label: "Connectivity Mode", value: conn.operation_mode });
      }
      telemetry.push({ label: "Last Sync", value: conn ? new Date(conn.timestamp).toLocaleTimeString("en-IN", { hour12: false }) : "—" });
      return {
        status,
        statusLabel: connectivity,
        operationalState: conn?.operation_mode ?? connectivity,
        telemetry,
        info: [...baseInfo, { label: "Subsystem", value: "Communication" }],
        condition:
          connectivity === "BLACKOUT"
            ? "HQ uplink unavailable - local autonomous operation active."
            : connectivity === "DEGRADED"
            ? "Intermittent uplink - operating on locally cached state."
            : "HQ supervision link nominal.",
        affects: ["HQ supervision link", "Bounded autonomy trigger"],
        relatedSystems: ["Decision Ledger", "Safe Operating Capacity"],
      };
    }
    case "environment": {
      const env = twin?.environment;
      const status = domainScoreStatus(scores?.Environment);
      const telemetry: TelemetryField[] = [];
      if (env) {
        telemetry.push({ label: "Temperature", value: `${env.temperature_c}°C` });
        telemetry.push({ label: "Wind Speed", value: `${env.wind_speed_knots} kt` });
        telemetry.push({ label: "Humidity", value: `${env.humidity_percent}%` });
        telemetry.push({ label: "Pressure", value: `${env.pressure_mbar} hPa` });
      }
      return {
        status,
        statusLabel: status,
        operationalState: env ? (env.status === "LIVE" ? "Live NCPOR Feed" : "Stale - Last Known Good") : "Awaiting NCPOR fetch",
        telemetry,
        info: [...baseInfo, { label: "Subsystem", value: "Environment" }, { label: "Source", value: env?.source ?? "NCPOR" }],
        condition:
          status === "CRITICAL"
            ? "Environmental conditions have crossed the safe operating threshold."
            : status === "WARNING"
            ? "Wind or temperature is approaching the operating limit."
            : "Conditions are within the operating envelope.",
        affects: ["Environmental risk", "Safe Operating Capacity"],
        relatedSystems: ["Safe Operating Capacity"],
      };
    }
    case "logistics": {
      const logistics = twin?.logistics;
      const status = domainScoreStatus(scores?.Logistics);
      const telemetry: TelemetryField[] = [];
      if (logistics) {
        telemetry.push({ label: "Essential Supplies", value: `${logistics.essential_supplies_percent}%` });
        telemetry.push({ label: "Runway", value: `${logistics.remaining_operational_days} days` });
      }
      return {
        status,
        statusLabel: status,
        operationalState: "Nominal",
        telemetry,
        info: [...baseInfo, { label: "Subsystem", value: "Logistics" }],
        condition: status === "NORMAL" ? "Supplies within the operating envelope." : "Supply levels are being tracked against the safety reserve.",
        affects: ["Logistics reserve"],
        relatedSystems: ["Bulk fuel farm"],
      };
    }
    case "building":
    case "support":
    default: {
      const infra = twin?.infrastructure;
      const status = domainScoreStatus(scores?.Infrastructure);
      const telemetry: TelemetryField[] = [];
      if (infra) {
        telemetry.push({ label: "Buildings", value: `${infra.buildings_nominal} / ${infra.buildings_total}` });
        telemetry.push({ label: "Critical Systems", value: `${infra.critical_systems_nominal} / ${infra.critical_systems_total}` });
        telemetry.push({ label: "Equipment", value: `${infra.equipment_nominal} / ${infra.equipment_total}` });
        telemetry.push({ label: "Utilities", value: `${infra.utilities_nominal} / ${infra.utilities_total}` });
      }
      return {
        status,
        statusLabel: status,
        operationalState: infra && infra.critical_systems_nominal === infra.critical_systems_total ? "Structurally Nominal" : "Maintenance Flagged",
        telemetry,
        info: [...baseInfo, { label: "Subsystem", value: "Infrastructure" }],
        condition:
          status === "CRITICAL"
            ? "One or more critical systems are not nominal."
            : status === "WARNING"
            ? "Equipment service flags are open."
            : "All structures and critical systems are within operating limits.",
        affects: ["Infrastructure health", "Safe Operating Capacity"],
        relatedSystems: ["Decision Ledger"],
      };
    }
  }
}
