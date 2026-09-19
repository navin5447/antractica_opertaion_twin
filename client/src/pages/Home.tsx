import { useEffect, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { api, type DecisionEntry, type DigitalTwinState } from "@/lib/api";
import { MaitriStation3D } from "@/components/MaitriStation3D";
import { BharatiStation3D } from "@/components/BharatiStation3D";
import { AssetInspector } from "@/components/AssetInspector";
import { StationBlueprint } from "@/components/StationBlueprint";
import { buildAssetInspectorData, type AssetKind } from "@/lib/assetTelemetry";
import { assetTag as lookupAssetTag, stationAssets } from "@/lib/stationRegistry";
import {
  Activity,
  AlertTriangle,
  ArrowDownRight,
  ArrowUpRight,
  BatteryCharging,
  Bell,
  Bolt,
  Box,
  Building2,
  Check,
  ChevronDown,
  CircleDot,
  CloudSnow,
  Compass,
  Cpu,
  Database,
  Droplets,
  Fuel,
  Gauge,
  Globe2,
  HardDrive,
  History,
  Landmark,
  Layers3,
  Leaf,
  LifeBuoy,
  Link2,
  LockKeyhole,
  Menu,
  Network,
  Radio,
  Satellite,
  Scan,
  Settings2,
  ShieldCheck,
  SlidersHorizontal,
  Snowflake,
  Sparkles,
  ThermometerSnowflake,
  Timer,
  TriangleAlert,
  Truck,
  Wind,
  X,
  Zap,
} from "lucide-react";

type StationKey = "Maitri" | "Bharati";
type Connectivity = "CONNECTED" | "DEGRADED" | "BLACKOUT";
type LiveEnvironment = DigitalTwinState["environment"];
type LiveEnvironmentMap = Partial<Record<StationKey, DigitalTwinState>>;
const NCPOR_REFRESH_INTERVAL_MS = Number(import.meta.env.VITE_NCPOR_REFRESH_INTERVAL ?? 600) * 1000;
type PageKey =
  | "Overview"
  | "Live Monitor"
  | "Digital Twin"
  | "Environment"
  | "Infrastructure"
  | "Energy"
  | "Logistics"
  | "Safe Operating Capacity"
  | "Autonomous Mode"
  | "What-If Simulator"
  | "Decision Ledger"
  | "HQ / NCPOR";

type IconType = typeof Activity;

const navGroups: { label: string; items: { label: PageKey; icon: IconType }[] }[] = [
  {
    label: "OPERATIONS",
    items: [
      { label: "Overview", icon: Globe2 },
      { label: "Live Monitor", icon: Activity },
      { label: "Digital Twin", icon: Layers3 },
    ],
  },
  {
    label: "DOMAINS",
    items: [
      { label: "Environment", icon: CloudSnow },
      { label: "Infrastructure", icon: Building2 },
      { label: "Energy", icon: Bolt },
      { label: "Logistics", icon: Truck },
    ],
  },
  {
    label: "DECISION SUPPORT",
    items: [
      { label: "Safe Operating Capacity", icon: Gauge },
      { label: "Autonomous Mode", icon: ShieldCheck },
      { label: "What-If Simulator", icon: SlidersHorizontal },
      { label: "Decision Ledger", icon: History },
    ],
  },
  { label: "SUPERVISION", items: [{ label: "HQ / NCPOR", icon: Landmark }] },
];

const stationData: Record<StationKey, {
  coords: string;
  region: string;
  temp: number;
  humidity: number;
  pressure: number;
  wind: number;
  windDir: string;
  power: number;
  critical: number;
  fuel: number;
  reserve: number;
  days: number;
  capacity: number;
  occupants: number;
}> = {
  Maitri: {
    coords: "70°45′S / 11°44′E",
    region: "Schirmacher Oasis",
    temp: -18.6,
    humidity: 64,
    pressure: 982,
    wind: 19,
    windDir: "ENE",
    power: 724,
    critical: 402,
    fuel: 68,
    reserve: 42,
    days: 19,
    capacity: 78,
    occupants: 42,
  },
  Bharati: {
    coords: "69°24′S / 76°11′E",
    region: "Larsemann Hills",
    temp: -14.2,
    humidity: 58,
    pressure: 989,
    wind: 24,
    windDir: "SSW",
    power: 648,
    critical: 388,
    fuel: 74,
    reserve: 45,
    days: 23,
    capacity: 84,
    occupants: 38,
  },
};

function mergeStationData(station: StationKey, twin?: DigitalTwinState) {
  const base = stationData[station];
  if (!twin) return base;
  return {
    ...base,
    temp: twin.environment.temperature_c,
    humidity: twin.environment.humidity_percent,
    pressure: twin.environment.pressure_mbar,
    wind: twin.environment.wind_speed_knots,
    power: twin.energy.available_power_kw,
    critical: twin.energy.critical_load_kw,
    fuel: twin.logistics.fuel_stock_percent,
    reserve: twin.logistics.safety_reserve_percent,
    days: twin.logistics.remaining_operational_days,
    capacity: twin.safe_operating_capacity.safe_capacity_percent,
  };
}

function liveStatusLabel(live?: LiveEnvironment) {
  if (!live) return "NCPOR CONNECTING";
  if (live.status === "LIVE") return "LIVE — NCPOR";
  return `STALE — LAST UPDATED ${new Date(live.last_updated).toLocaleString("en-IN", { dateStyle: "short", timeStyle: "short" })}`;
}

// Formats a duration as "Xs ago" / "Xm ago" / "Xh Ym ago" for freshness
// indicators - never a fabricated value, always derived from a real
// timestamp difference against the ticking clock.
function formatAgo(ms: number): string {
  const totalSeconds = Math.max(0, Math.floor(ms / 1000));
  if (totalSeconds < 60) return `${totalSeconds}s ago`;
  const minutes = Math.floor(totalSeconds / 60);
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  return `${hours}h ${minutes % 60}m ago`;
}

function formatElapsedClock(ms: number): string {
  const totalSeconds = Math.max(0, Math.floor(ms / 1000));
  const mm = String(Math.floor(totalSeconds / 60)).padStart(2, "0");
  const ss = String(totalSeconds % 60).padStart(2, "0");
  return `${mm}:${ss}`;
}

// A single-line, honest freshness readout for the currently selected
// station's NCPOR environment reading - distinct from "current time" and
// from "model sync" (backend response freshness).
function environmentFreshness(live: LiveEnvironment | undefined, now: Date): string {
  if (!live) return "Awaiting first NCPOR fetch";
  if (live.status === "LIVE") return `Updated ${formatAgo(now.getTime() - new Date(live.timestamp).getTime())}`;
  return `Last known good ${formatAgo(now.getTime() - new Date(live.last_updated).getTime())}`;
}

const sparkPoints = "0,61 18,55 35,59 54,45 72,50 90,34 108,37 126,22 144,29 162,17 180,21 198,9 216,14 234,4";

function statusCopy(connectivity: Connectivity, latencyMs?: number) {
  if (connectivity === "BLACKOUT") return { label: "LOCAL AUTONOMOUS OPERATION", tone: "danger", helper: "HQ link unavailable · bounded rules active" };
  if (connectivity === "DEGRADED") return { label: "LOCAL ASSISTED OPERATION", tone: "amber", helper: `Intermittent uplink · ${latencyMs ?? "—"} ms latency` };
  return { label: "HQ SUPERVISION ACTIVE", tone: "good", helper: `NCPOR link nominal · ${latencyMs ?? "—"} ms latency` };
}

function MetricCard({ icon: Icon, label, value, unit, note, tone = "cyan", progress, liveLabel = "LIVE" }: { icon: IconType; label: string; value: string; unit?: string; note: string; tone?: string; progress?: number; liveLabel?: string }) {
  return (
    <div className={`metric-card tone-${tone}`}>
      <div className="metric-top"><span className="metric-icon"><Icon size={15} /></span><span className="metric-label">{label}</span><span className={`metric-live ${liveLabel.startsWith("STALE") ? "stale" : liveLabel.startsWith("SIMULATED") ? "simulated" : ""}`}>{liveLabel}</span></div>
      <div className="metric-value">{value}<small>{unit}</small></div>
      <div className="metric-note">{note}</div>
      {progress !== undefined && <div className="mini-bar"><i style={{ width: `${progress}%` }} /></div>}
    </div>
  );
}

function DomainPanel({ title, code, icon: Icon, children, accent = "cyan", action }: { title: string; code: string; icon: IconType; children: React.ReactNode; accent?: string; action?: string }) {
  return (
    <section className={`domain-panel accent-${accent}`}>
      <div className="panel-head"><div className="panel-title"><span className="panel-icon"><Icon size={16} /></span><div><span className="eyebrow">{code}</span><h3>{title}</h3></div></div>{action && <span className="panel-action">{action}<ArrowUpRight size={13} /></span>}</div>
      {children}
    </section>
  );
}

function RingGauge({ value, label = "SAFE TO OPERATE", size = "large" }: { value: number; label?: string; size?: "large" | "small" }) {
  return (
    <div className={`ring-wrap ${size}`}>
      <div className="ring-gauge" style={{ "--value": `${value * 3.6}deg` } as React.CSSProperties}><div className="ring-inner"><span className="ring-number">{value}<small>%</small></span><span className="ring-label">{label}</span></div></div>
    </div>
  );
}

function DigitalTwinCanvas({ station, connectivity, onStationClick, liveByStation }: { station: StationKey; connectivity: Connectivity; onStationClick: (key: StationKey) => void; liveByStation?: LiveEnvironmentMap }) {
  const data = mergeStationData(station, liveByStation?.[station]);
  const maitri = mergeStationData("Maitri", liveByStation?.Maitri);
  const bharati = mergeStationData("Bharati", liveByStation?.Bharati);
  const isBlackout = connectivity === "BLACKOUT";
  return (
    <div className={`twin-canvas ${isBlackout ? "blackout" : ""}`}>
      <div className="twin-image" />
      <div className="twin-grid" />
      <div className="scanline" />
      <div className="twin-topline"><span><CircleDot size={12} /> DIGITAL TWIN // TERRAIN LAYER</span><span className="twin-date">SIMULATION MODEL v2.4</span></div>
      <div className="globe-outline"><div className="globe-lat lat-1" /><div className="globe-lat lat-2" /><div className="globe-long long-1" /><div className="globe-long long-2" /></div>
      <div className="terrain-contour contour-a" /><div className="terrain-contour contour-b" /><div className="terrain-contour contour-c" />
      <button className={`station-marker marker-maitri ${station === "Maitri" ? "selected" : ""}`} onClick={() => onStationClick("Maitri")}><span className="marker-pulse" /><span className="marker-dot" /><span className="station-tooltip"><b>MAITRI (3D TWIN)</b><em>{liveStatusLabel(liveByStation?.Maitri?.environment)} · {maitri.temp}°C</em></span></button>
      <button className={`station-marker marker-bharati ${station === "Bharati" ? "selected" : ""}`} onClick={() => onStationClick("Bharati")}><span className="marker-pulse" /><span className="marker-dot" /><span className="station-tooltip"><b>BHARATI</b><em>{liveStatusLabel(liveByStation?.Bharati?.environment)} · {bharati.temp}°C</em></span></button>
      <div className="data-path path-one" /><div className="data-path path-two" /><div className="data-path path-three" />
      <div className="satellite-link"><Satellite size={16} /><span>ISRO / SATCOM</span><i /></div>
      <div className="twin-readout readout-top"><span>SELECTED STATION</span><b>{station.toUpperCase()}</b><em>{data.coords}</em></div>
      <div className="twin-readout readout-bottom"><span>ENVIRONMENTAL FIELD</span><b>{data.wind} <small>KT</small></b><em>{data.windDir} / WIND VECTOR</em></div>
      <button
        onClick={() => onStationClick("Maitri")}
        className="absolute top-12 right-4 z-10 btn btn-sm btn-primary font-mono shadow-xl cursor-pointer"
      >
        <Box size={14} className="text-white animate-pulse" />
        <span>LAUNCH 3D DIGITAL TWIN</span>
        <ArrowUpRight size={13} />
      </button>
      <div className="twin-legend"><span><i className="legend-cyan" />LIVE TELEMETRY</span><span><i className="legend-amber" />SIMULATED</span><span><i className="legend-white" />3D ASSET ACTIVE</span></div>
      <div className="twin-scale"><span>0</span><i /><span>500 m</span><i /><span>1 km</span></div>
      {isBlackout && <div className="blackout-stamp"><LockKeyhole size={14} /> BOUNDED AUTONOMY ACTIVE</div>}
    </div>
  );
}

function Sparkline() {
  return <svg className="sparkline" viewBox="0 0 234 70" preserveAspectRatio="none"><defs><linearGradient id="sparkFill" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stopColor="#38bdf8" stopOpacity=".3" /><stop offset="1" stopColor="#38bdf8" stopOpacity="0" /></linearGradient></defs><polygon points={`${sparkPoints} 234,70 0,70`} fill="url(#sparkFill)" /><polyline points={sparkPoints} fill="none" stroke="#38bdf8" strokeWidth="2.5" /></svg>;
}

function Overview({ station, connectivity, capacity, onStationClick, onOpen, liveByStation, decisions, now, lastSyncedAt }: { station: StationKey; connectivity: Connectivity; capacity: number; onStationClick: (key: StationKey) => void; onOpen: (page: PageKey) => void; liveByStation?: LiveEnvironmentMap; decisions?: DecisionEntry[]; now: Date; lastSyncedAt: number | null }) {
  const twin = liveByStation?.[station];
  const d = mergeStationData(station, twin);
  const mode = statusCopy(connectivity, twin?.connectivity.latency_ms);
  const envFreshness = environmentFreshness(twin?.environment, now);
  const modelSyncLabel = lastSyncedAt !== null ? formatElapsedClock(now.getTime() - lastSyncedAt) : "—:--";
  const scores = twin?.safe_operating_capacity.domain_scores;
  const factorRows: [string, number | null, string][] = [
    ["Environment", scores?.Environment ?? null, "cyan"],
    ["Energy", scores?.Energy ?? null, "amber"],
    ["Logistics", scores?.Logistics ?? null, "violet"],
    ["Infrastructure", scores?.Infrastructure ?? null, "green"],
  ];
  const infra = twin?.infrastructure;
  const recentDecisions = (decisions ?? []).slice(0, 4);
  return (
    <>
      <div className="hero-grid">
        <div className="hero-left">
          <div className="section-kicker"><span className="pulse-dot" /> SYSTEM OVERVIEW <span className="slash">/</span> {station.toUpperCase()}</div>
          <h1>Station<br /><i>operational</i> <span>status.</span></h1>
          <p className="hero-copy">Integrated operational view for the Antarctic research stations, combining environment, infrastructure, energy and logistics information for coordinated supervision.</p>
          <div className="hero-actions">
            <button className="btn btn-primary" onClick={() => onOpen("Digital Twin")}>
              <Layers3 size={15} />
              <span>View digital twin</span>
              <ArrowUpRight size={14} />
            </button>
            <button className="btn btn-neutral" onClick={() => onOpen("What-If Simulator")}>
              <Sparkles size={15} />
              <span>Scenario analysis</span>
            </button>
          </div>
          <div className="station-facts">
            <div><span>STATION</span><b>{station}</b><small>{d.region}</small></div>
            <div><span>CREW ON-SITE</span><b>{d.occupants}</b><small>Researchers + ops</small></div>
            <div><span>MODEL SYNC</span><b>{modelSyncLabel}</b><small>Since last backend response</small></div>
          </div>
        </div>
        <div className="hero-twin"><DigitalTwinCanvas station={station} connectivity={connectivity} onStationClick={onStationClick} liveByStation={liveByStation} /></div>
      </div>
      <div className="signal-strip">
        <div className={`signal-state ${mode.tone}`}>
          <span className="signal-icon"><Radio size={16} /></span>
          <div><b>{mode.label}</b><small>{mode.helper}</small></div>
        </div>
        <div className="signal-route">
          <span>LOCAL</span><i className="signal-line active" />
          <span>RELAY</span><i className={`signal-line ${connectivity === "CONNECTED" ? "active" : "dim"}`} />
          <span>HQ / NCPOR</span>
        </div>
        <div className="signal-aside">
          <span>SAFE OPERATING CAPACITY</span>
          <b>{capacity}%</b>
          <ArrowUpRight size={16} />
        </div>
      </div>
      <div className="metric-grid">
        <MetricCard icon={ThermometerSnowflake} label="TEMPERATURE" value={`${d.temp}`} unit="°C" note={envFreshness} liveLabel={liveStatusLabel(twin?.environment)} />
        <MetricCard icon={Wind} label="WIND SPEED" value={`${d.wind}`} unit=" kt" note={`${d.windDir} · ${envFreshness}`} tone="blue" liveLabel={liveStatusLabel(twin?.environment)} />
        <MetricCard icon={BatteryCharging} label="AVAILABLE POWER" value={`${d.power}`} unit=" kW" note="SIMULATED · generator online" tone="amber" liveLabel="SIMULATED" progress={Math.round((d.power / 900) * 100)} />
        <MetricCard icon={Fuel} label="FUEL STOCK" value={`${d.fuel}`} unit="%" note={`${d.days} days runway · SIMULATED`} tone="violet" liveLabel="SIMULATED" progress={d.fuel} />
      </div>
      <div className="dashboard-grid">
        <DomainPanel title="Safe operating capacity" code="DECISION SUPPORT / 01" icon={Gauge} action="View factors" accent="cyan">
          <div className="capacity-content">
            <RingGauge value={capacity} />
            <div className="capacity-factors">
              <p>Calculated using <b>rules, constraints</b> and risk evaluation — not an ML prediction.</p>
              {factorRows.map(([label, score, color]) => (
                <div className="factor" key={label}>
                  <div><span>{label}</span><b>{score !== null ? Math.round(score) : "—"}%</b></div>
                  <div className="factor-bar"><i className={`fill-${color}`} style={{ width: `${score ?? 0}%` }} /></div>
                </div>
              ))}
            </div>
          </div>
          <button className="btn btn-xs btn-outline border-slate-700 text-sky-400 hover:text-white mt-4" onClick={() => onOpen("Safe Operating Capacity")}>
            <span>Inspect calculation path</span>
            <ArrowUpRight size={13} />
          </button>
        </DomainPanel>
        <DomainPanel title="Autonomous decision stream" code="BOUNDED AUTONOMY / ACTIVE" icon={ShieldCheck} action="Live rules" accent={connectivity === "BLACKOUT" ? "danger" : "amber"}>
          <div className="decision-list">
            {recentDecisions.length === 0
              ? <div className="decision-item"><span className="decision-trigger">NO AUTONOMOUS ACTION</span><ArrowDownRight size={14} /><span>No rule threshold has been crossed</span><em className="status-chip muted">IDLE</em></div>
              : recentDecisions.map((entry) => <div className="decision-item" key={entry.id}><span className="decision-trigger">{entry.trigger.toUpperCase()}</span><ArrowDownRight size={14} /><span>{entry.action}</span><em className={`status-chip ${entry.status.toLowerCase()}`}>{entry.status}</em></div>)}
          </div>
          <div className="accountability-note"><LockKeyhole size={14} /><span>Every action is recorded and explained after reconnection.</span></div>
          <button className="btn btn-xs btn-outline border-slate-700 text-amber-400 hover:text-white mt-4" onClick={() => onOpen("Autonomous Mode")}>
            <span>Open autonomy controls</span>
            <ArrowUpRight size={13} />
          </button>
        </DomainPanel>
      </div>
      <div className="lower-grid">
        <DomainPanel title="Power telemetry" code="ENERGY / CURRENT READING" icon={Zap} action="Full energy view" accent="amber">
          <div className="chart-head"><div><b>{d.power} kW</b><span>AVAILABLE NOW</span></div></div>
          <Sparkline />
          <div className="chart-axis"><span>00:00</span><span>06:00</span><span>12:00</span><span>18:00</span><span>NOW</span></div>
        </DomainPanel>
        <DomainPanel title="Station state" code="INFRASTRUCTURE / SIMULATED" icon={Building2} action="Inspect systems" accent="green">
          <div className="state-list">
            <div><span><i className={`tiny-dot ${infra && infra.buildings_nominal === infra.buildings_total ? "good" : "amber"}`} /> Buildings</span><b>{infra ? `${String(infra.buildings_nominal).padStart(2, "0")} / ${String(infra.buildings_total).padStart(2, "0")}` : "—"}</b><small>{infra && infra.buildings_nominal === infra.buildings_total ? "Nominal" : "Check required"}</small></div>
            <div><span><i className={`tiny-dot ${infra && infra.utilities_nominal === infra.utilities_total ? "good" : "amber"}`} /> Utilities</span><b>{infra ? `${String(infra.utilities_nominal).padStart(2, "0")} / ${String(infra.utilities_total).padStart(2, "0")}` : "—"}</b><small>{infra && infra.utilities_nominal === infra.utilities_total ? "Nominal" : "Check required"}</small></div>
            <div><span><i className={`tiny-dot ${infra && infra.equipment_nominal === infra.equipment_total ? "good" : "amber"}`} /> Equipment</span><b>{infra ? `${String(infra.equipment_nominal).padStart(2, "0")} / ${String(infra.equipment_total).padStart(2, "0")}` : "—"}</b><small>{infra ? `${infra.equipment_total - infra.equipment_nominal} service flags` : "—"}</small></div>
            <div><span><i className={`tiny-dot ${infra && infra.critical_systems_nominal === infra.critical_systems_total ? "good" : "danger"}`} /> Critical systems</span><b>{infra ? `${String(infra.critical_systems_nominal).padStart(2, "0")} / ${String(infra.critical_systems_total).padStart(2, "0")}` : "—"}</b><small>{infra && infra.critical_systems_nominal === infra.critical_systems_total ? "Nominal" : "Attention needed"}</small></div>
          </div>
        </DomainPanel>
        <DomainPanel title="Supply horizon" code="LOGISTICS / SIMULATED" icon={Fuel} action="View logistics" accent="violet">
          <div className="supply-main">
            <div><span>RUNWAY</span><b>{d.days}<small> DAYS</small></b><em>at current burn rate</em></div>
            <div className="supply-ring" style={{ "--fuel": `${d.fuel * 3.6}deg` } as React.CSSProperties}><span>{d.fuel}%</span></div>
          </div>
          <div className="supply-bar"><i style={{ width: `${d.fuel}%` }} /></div>
          <div className="supply-foot"><span>Safety reserve <b>{d.reserve}%</b></span><span>Burn rate <b>{twin?.logistics.fuel_consumption_rate_percent_per_day ?? "—"}%</b></span></div>
        </DomainPanel>
      </div>
    </>
  );
}

function DetailPage({ page, station, onStationChange, connectivity, capacity, onOpen, liveByStation, decisions, now, lastSyncedAt, nextRefreshInMs }: { page: PageKey; station: StationKey; onStationChange: (station: StationKey) => void; connectivity: Connectivity; capacity: number; onOpen: (p: PageKey) => void; liveByStation?: LiveEnvironmentMap; decisions?: DecisionEntry[]; now: Date; lastSyncedAt: number | null; nextRefreshInMs: number | null }) {
  const twin = liveByStation?.[station];
  const d = mergeStationData(station, twin);
  const mode = statusCopy(connectivity, twin?.connectivity.latency_ms);
  const envFreshness = environmentFreshness(twin?.environment, now);
  const envAgeSeconds = twin?.environment && twin.environment.status === "LIVE" ? Math.max(0, Math.floor((now.getTime() - new Date(twin.environment.timestamp).getTime()) / 1000)) : null;
  const scores = twin?.safe_operating_capacity.domain_scores;
  const limitingReasons = new Map((twin?.safe_operating_capacity.limiting_factors ?? []).map((f) => [f.domain, f.reason]));
  const infra = twin?.infrastructure;
  const infraFreshness = infra ? `Updated ${formatAgo(now.getTime() - new Date(infra.timestamp).getTime())}` : "—";
  const infraIntegrity = infra
    ? Math.round(
        ((infra.buildings_nominal / infra.buildings_total +
          infra.utilities_nominal / infra.utilities_total +
          infra.equipment_nominal / infra.equipment_total +
          infra.critical_systems_nominal / infra.critical_systems_total) /
          4) *
          100
      )
    : null;
  if (page === "Overview") return <Overview station={station} connectivity={connectivity} capacity={capacity} onStationClick={() => onOpen("Digital Twin")} onOpen={onOpen} liveByStation={liveByStation} decisions={decisions} now={now} lastSyncedAt={lastSyncedAt} />;
  if (page === "Digital Twin") return <StationTwinExperience station={station} onStationChange={onStationChange} connectivity={connectivity} capacity={capacity} liveByStation={liveByStation} decisions={decisions} />;
  if (page === "Live Monitor") return <div className="detail-layout"><PageIntro kicker="LIVE MONITOR / NCPOR TELEMETRY" title="All signals, one operational picture." copy="Continuous telemetry from station domains, rendered against the current operating envelope." /><div className="monitor-grid"><DomainPanel title="Environment / live" code={liveStatusLabel(twin?.environment)} icon={CloudSnow} accent="cyan"><div className="wide-metrics"><MetricCard icon={ThermometerSnowflake} label="Temperature" value={`${d.temp}`} unit="°C" note={envFreshness} liveLabel={liveStatusLabel(twin?.environment)} /><MetricCard icon={Droplets} label="Humidity" value={`${d.humidity}`} unit="%" note={envFreshness} liveLabel={liveStatusLabel(twin?.environment)} /><MetricCard icon={Gauge} label="Pressure" value={`${d.pressure}`} unit=" hPa" note={envFreshness} liveLabel={liveStatusLabel(twin?.environment)} /><MetricCard icon={Wind} label="Wind" value={`${d.wind}`} unit=" kt" note={`${d.windDir} · ${envFreshness}`} tone="blue" liveLabel={liveStatusLabel(twin?.environment)} /></div></DomainPanel><DomainPanel title="Decision stream" code="MOST RECENT FIRST" icon={Activity} accent="amber"><div className="event-list">{(decisions ?? []).length === 0 ? <div><span className="event-time">—</span><i className="tiny-dot cyan" /><b>No autonomous action recorded</b><small>Bounded autonomy has not been triggered</small></div> : (decisions ?? []).slice(0, 3).map((entry) => <div key={entry.id}><span className="event-time">{new Date(entry.timestamp).toLocaleTimeString("en-IN", { hour12: false })}</span><i className={`tiny-dot ${entry.status === "AUTO" ? "amber" : "green"}`} /><b>{entry.trigger}</b><small>{entry.action}</small></div>)}</div></DomainPanel></div><div className="telemetry-foot"><span><Database size={14} /> Data freshness <b>{envAgeSeconds !== null ? `${envAgeSeconds}s` : "—"}</b></span><span><Cpu size={14} /> Fields monitored <b>4</b></span><span><Timer size={14} /> Next NCPOR refresh <b>{nextRefreshInMs !== null ? formatElapsedClock(nextRefreshInMs) : "—:--"}</b></span></div></div>;
  if (page === "Environment") return <div className="detail-layout"><PageIntro kicker="DOMAIN / ENVIRONMENT" title="The field sets the boundary." copy="Live environmental conditions from NCPOR define the outer limits for every downstream operating decision." /><div className="environment-layout"><div className="env-feature"><div className="env-orb"><Snowflake size={32} /><span>{d.temp}°</span><small>AMBIENT TEMPERATURE</small></div><div className="env-vector"><Wind size={18} /><div><b>{d.wind} kt</b><span>{d.windDir} · {envFreshness}</span></div><Compass size={38} className="compass" /></div></div><div className="env-readings"><MetricCard icon={Droplets} label="Relative humidity" value={`${d.humidity}`} unit="%" note={envFreshness} liveLabel={liveStatusLabel(twin?.environment)} /><MetricCard icon={Gauge} label="Air pressure" value={`${d.pressure}`} unit=" hPa" note={envFreshness} liveLabel={liveStatusLabel(twin?.environment)} /><MetricCard icon={CloudSnow} label="Visibility" value="8.4" unit=" km" note="Not supplied by NCPOR · SIMULATED" liveLabel="SIMULATED" /><div className="forecast-card"><span className="eyebrow">NEXT 06 HOURS · SIMULATED PROJECTION</span><div className="forecast-line"><span>18:00</span><b>-19°</b><i className="cloud-snow" /><span>00:00</span><b>-21°</b><i className="cloud-snow" /><span>06:00</span><b>-23°</b></div></div></div></div><div className="rule-note"><ShieldCheck size={16} /><div><b>Environmental constraint</b><span>Wind speed above 35 kt automatically lowers safe operating capacity and freezes external logistics actions.</span></div></div></div>;
  if (page === "Infrastructure") return <div className="detail-layout"><PageIntro kicker="DOMAIN / INFRASTRUCTURE" title="Station systems, mapped to reality." copy="A simulated systems inventory that gives HQ an accountable view of buildings, utilities, equipment and critical services." /><div className="infra-layout"><div className="systems-table"><div className="table-header"><span>ASSET GROUP</span><span>STATE</span><span>LAST CHECK</span><span>NOTES</span></div>{infra ? [
    ["Buildings", `${infra.buildings_nominal} / ${infra.buildings_total}`, infra.buildings_nominal === infra.buildings_total ? "NOMINAL" : "SERVICE FLAG", "Habitat + labs"],
    ["Utilities", `${infra.utilities_nominal} / ${infra.utilities_total}`, infra.utilities_nominal === infra.utilities_total ? "NOMINAL" : "SERVICE FLAG", "Water, waste, HVAC"],
    ["Equipment", `${infra.equipment_nominal} / ${infra.equipment_total}`, infra.equipment_nominal === infra.equipment_total ? "NOMINAL" : "SERVICE FLAG", `${infra.equipment_total - infra.equipment_nominal} scheduled checks`],
    ["Critical systems", `${infra.critical_systems_nominal} / ${infra.critical_systems_total}`, infra.critical_systems_nominal === infra.critical_systems_total ? "NOMINAL" : "SERVICE FLAG", "No exceptions"],
  ].map((r, i) => <div className="system-row" key={r[0]}><span><i className={`system-icon ${r[2] === "NOMINAL" ? "green" : "amber"}`} />{r[0]}</span><b>{r[1]}</b><em className={r[2] === "NOMINAL" ? "green-text" : "amber-text"}>{r[2]}</em><small>{r[3]}</small></div>) : <div className="system-row"><span>Loading…</span></div>}</div><div className="infra-callout"><Building2 size={20} /><span className="eyebrow">SYSTEM INTEGRITY</span><b>{infraIntegrity !== null ? `${infraIntegrity}%` : "—"}</b><p>{infraFreshness} · {infra && infra.equipment_total - infra.equipment_nominal > 0 ? `${infra.equipment_total - infra.equipment_nominal} non-critical equipment service flag(s) are being tracked inside the current safe operating envelope.` : "All systems nominal inside the current safe operating envelope."}</p><button className="btn btn-sm btn-neutral mt-2" onClick={() => onOpen("Decision Ledger")}><span>View ledger</span><ArrowUpRight size={14} /></button></div></div></div>;
  if (page === "Energy") {
    const available = twin?.energy.available_power_kw ?? d.power;
    const critical = twin?.energy.critical_load_kw ?? d.critical;
    const nonCritical = twin?.energy.non_critical_load_kw ?? 0;
    const totalConsumption = twin?.energy.total_consumption_kw ?? critical + nonCritical;
    const margin = Math.max(0, available - totalConsumption);
    const pct = (value: number) => Math.round((value / Math.max(available, 1)) * 100);
    return <div className="detail-layout"><PageIntro kicker="DOMAIN / ENERGY" title="Power is a decision surface." copy="The station’s energy state is simulated here to show how critical and non-critical loads shape operational autonomy." /><div className="energy-summary"><div className="energy-number"><span>AVAILABLE POWER</span><b>{available}<small> kW</small></b><div className="energy-delta">SIMULATED · {twin?.energy.generator_status ?? "—"}</div></div><div className="energy-flow"><div><span>GENERATOR OUTPUT</span><b>{twin?.energy.generator_output_kw ?? "—"} kW</b><i style={{ width: `${pct(totalConsumption)}%` }} /></div><div><span>TOTAL CONSUMPTION</span><b>{totalConsumption} kW</b><i style={{ width: `${pct(totalConsumption)}%` }} /></div><div><span>AVAILABLE MARGIN</span><b>{Math.round(margin)} kW</b><i style={{ width: `${pct(margin)}%` }} /></div></div><div className="critical-load"><span>CRITICAL LOAD</span><b>{critical} <small>kW</small></b><em>{pct(critical)}% of available</em></div></div><div className="load-grid"><DomainPanel title="Load allocation" code="SIMULATED / RULE-EVALUATED" icon={Bolt} accent="amber"><div className="load-row"><span>Critical systems</span><div><i style={{ width: `${pct(critical)}%` }} /></div><b>{critical} kW</b></div><div className="load-row"><span>Non-critical loads</span><div><i style={{ width: `${pct(nonCritical)}%` }} /></div><b>{nonCritical} kW</b></div><div className="load-row"><span>Available margin</span><div><i style={{ width: `${pct(margin)}%` }} /></div><b>{Math.round(margin)} kW</b></div></DomainPanel><DomainPanel title="Generator status" code="SIMULATED / SINGLE UNIT MODEL" icon={BatteryCharging} accent="green"><div className="generator-list"><div><span className={`tiny-dot ${twin?.energy.generator_status === "ONLINE" ? "green" : "amber"}`} /> Generator <b>{twin?.energy.generator_status ?? "—"}</b><small>{twin?.energy.generator_output_kw ?? "—"} kW · {pct(totalConsumption)}% load</small></div><div><span className="tiny-dot amber" /> Backup reserve <b>ARMED</b><small>Auto-start threshold 38%</small></div></div></DomainPanel></div></div>;
  }
  if (page === "Logistics") return <div className="detail-layout"><PageIntro kicker="DOMAIN / LOGISTICS" title="Every day of runway counts." copy="Fuel and essential supplies stay visible, bounded by a safety reserve that cannot be traded away by local autonomy." /><div className="logistics-hero"><div className="runway-big"><Fuel size={24} /><span>OPERATIONAL RUNWAY</span><b>{d.days}<small> days</small></b><em>at current consumption</em></div><div className="fuel-tank"><div className="tank-top"><span>FUEL STOCK</span><b>{d.fuel}%</b></div><div className="tank-visual"><i style={{ height: `${d.fuel}%` }} /></div><div className="tank-bottom"><span>Safety reserve <b>{d.reserve}%</b></span><span>Burn rate <b>{twin?.logistics.fuel_consumption_rate_percent_per_day ?? "—"}% / day</b></span></div></div><div className="supply-list"><span className="eyebrow">ESSENTIAL SUPPLIES · SIMULATED AGGREGATE {twin?.logistics.essential_supplies_percent ?? "—"}%</span><div><b>Medical</b><i /><em>92%</em></div><div><b>Food stores</b><i /><em>76%</em></div><div><b>Water treatment</b><i /><em>88%</em></div><div><b>Spare parts</b><i /><em>64%</em></div></div></div><div className="logistics-note"><Truck size={17} /><div><b>Logistics constraint</b><span>Fuel below safety reserve triggers discretionary load lock and requires HQ acknowledgement after reconnection.</span></div></div></div>;
  if (page === "Safe Operating Capacity") {
    const rows: [string, string, number | null, string][] = [
      ["Environment", limitingReasons.get("Environment") ?? "Wind and temperature within operating bands", scores?.Environment ?? null, "cyan"],
      ["Energy", limitingReasons.get("Energy") ?? "Critical load leaves a stable margin", scores?.Energy ?? null, "amber"],
      ["Logistics", limitingReasons.get("Logistics") ?? `${d.days} days runway · ${d.reserve}% reserve protected`, scores?.Logistics ?? null, "violet"],
      ["Infrastructure", limitingReasons.get("Infrastructure") ?? "All critical systems nominal", scores?.Infrastructure ?? null, "green"],
    ];
    return <div className="detail-layout"><PageIntro kicker="DECISION SUPPORT / SAFE OPERATING CAPACITY" title="How much can we safely operate?" copy="A transparent rule-based operating envelope. Every factor is visible, bounded and explainable." /><div className="capacity-page"><div className="capacity-big"><RingGauge value={capacity} /><b>SAFE TO OPERATE</b><span>Current evaluated state · {station}</span></div><div className="factor-detail"><span className="eyebrow">WHY THE VALUE CHANGED</span>{rows.map(([label, text, score, color]) => <div className="factor-detail-row" key={label}><div><b>{label}</b><span>{text}</span></div><strong className={`text-${color}`}>{score !== null ? Math.round(score) : "—"}%</strong><div className="factor-bar"><i className={`fill-${color}`} style={{ width: `${score ?? 0}%` }} /></div></div>)}</div></div><div className="method-note"><Settings2 size={16} /><span><b>Method</b> deterministic constraints + operational rules + risk evaluation. This is not an ML prediction.</span></div></div>;
  }
  if (page === "Autonomous Mode") return <div className="detail-layout"><PageIntro kicker="DECISION SUPPORT / BOUNDED AUTONOMY" title="What can operate without HQ?" copy="Pre-approved actions, hard safety limits and an accountable ledger keep local operation useful — never unbounded." /><div className={`autonomy-banner ${connectivity === "BLACKOUT" ? "active" : ""}`}><div className="autonomy-orb"><ShieldCheck size={28} /></div><div><span className="eyebrow">CURRENT CONNECTIVITY</span><b>{mode.label}</b><p>{mode.helper}</p></div><div className="autonomy-switch"><span>BOUNDED AUTONOMY</span><i className={connectivity === "BLACKOUT" ? "on" : ""}><b /></i>{connectivity === "BLACKOUT" ? "ACTIVE" : "ARMED"}</div></div><div className="autonomy-grid"><DomainPanel title="Approved rule set" code="PRE-APPROVED ACTIONS · FIXED CATALOG" icon={LockKeyhole} accent="cyan"><div className="rule-list"><div><b>POWER DROP</b><span>Reduce non-critical loads</span><em>margin below threshold</em></div><div><b>LOW FUEL</b><span>Protect safety reserve</span><em>fuel ≤ reserve</em></div><div><b>EXTREME WEATHER</b><span>Reduce non-essential operations</span><em>wind &gt; 35 kt</em></div><div><b>COMMUNICATION BLACKOUT</b><span>Activate local operation</span><em>connectivity = BLACKOUT</em></div></div></DomainPanel><DomainPanel title="Accountability chain" code="EVERY ACTION / EXPLAINED" icon={History} accent="amber"><div className="chain"><span>TRIGGER</span><ArrowDownRight size={15} /><span>RULE</span><ArrowDownRight size={15} /><span>ACTION</span><ArrowDownRight size={15} /><span>OUTCOME</span></div><p className="chain-copy">Actions remain local until reconnection, then reconcile with HQ supervision in the decision ledger.</p><button className="btn btn-xs btn-outline border-slate-700 text-amber-400 hover:text-white mt-4" onClick={() => onOpen("Decision Ledger")}><span>Open decision ledger</span><ArrowUpRight size={13} /></button></DomainPanel></div></div>;
  if (page === "What-If Simulator") return <WhatIfSimulator station={station} base={d} capacity={capacity} connectivity={connectivity} />;
  if (page === "Decision Ledger") {
    const rows = (decisions ?? []).map((entry) => ({
      time: new Date(entry.timestamp).toLocaleTimeString("en-IN", { hour12: false }),
      trigger: entry.trigger,
      decision: entry.rule,
      action: entry.action,
      result: entry.outcome,
      status: entry.status,
    }));
    return <div className="detail-layout"><PageIntro kicker="DECISION SUPPORT / DECISION LEDGER" title="A memory for every decision." copy="Chronological, accountable and ready for post-reconnection review." /><div className="ledger-toolbar"><div className="ledger-count"><History size={16} /><b>{rows.length}</b><span>recorded actions</span></div><div className="filter-chip active">ALL EVENTS</div><div className="filter-chip">AUTO</div><div className="filter-chip">RULE</div><div className="filter-chip">ACK</div></div><div className="ledger-table"><div className="ledger-head"><span>TIME</span><span>TRIGGER</span><span>DECISION</span><span>ACTION</span><span>RESULT</span><span>STATUS</span></div>{rows.length === 0 ? <div className="ledger-row"><span>—</span><b>No autonomous decisions yet</b><span>Bounded autonomy engages during BLACKOUT when a rule threshold is crossed</span><span>—</span><span>—</span><em className="status-chip muted">IDLE</em></div> : rows.map((row, i) => <div className="ledger-row" key={`${row.time}-${i}`}><span>{row.time}</span><b>{row.trigger}</b><span>{row.decision}</span><span>{row.action}</span><span>{row.result}</span><em className={`status-chip ${row.status.toLowerCase()}`}>{row.status}</em></div>)}</div><div className="ledger-foot"><LockKeyhole size={14} /> Immutable local record · FastAPI Decision Ledger</div></div>;
  }
  const maitriFreshness = environmentFreshness(liveByStation?.Maitri?.environment, now);
  const bharatiFreshness = environmentFreshness(liveByStation?.Bharati?.environment, now);
  const lastPacketLabel = lastSyncedAt !== null ? new Date(lastSyncedAt).toLocaleTimeString("en-IN", { hour12: false }) : "—";
  return <div className="detail-layout"><PageIntro kicker="SUPERVISION / HQ + NCPOR" title="A quiet link is still a link." copy="Supervision state, station synchronization and the handoff between HQ control and local operation." /><div className="hq-grid"><div className={`hq-status-card ${mode.tone}`}><div className="hq-radar"><span /><i /><b><Radio size={22} /></b></div><span className="eyebrow">CONNECTIVITY STATE</span><h3>{mode.label}</h3><p>{mode.helper}</p><div className="hq-meta"><span>Last packet <b>{lastPacketLabel}</b></span><span>Latency <b>{connectivity !== "BLACKOUT" ? `${twin?.connectivity.latency_ms ?? "—"} ms` : "—"}</b></span></div></div><DomainPanel title="Station sync" code="NCPOR SUPERVISION" icon={Network} accent="cyan"><div className="sync-list"><div><span>Maitri</span><i /><b>{liveByStation?.Maitri?.environment.status === "STALE" ? "STALE" : "SYNCED"}</b><small>{maitriFreshness}</small></div><div><span>Bharati</span><i /><b>{liveByStation?.Bharati?.environment.status === "STALE" ? "STALE" : "SYNCED"}</b><small>{bharatiFreshness}</small></div><div><span>Decision ledger</span><i /><b>LOCAL CACHE</b><small>{decisions?.length ?? 0} records</small></div></div></DomainPanel><DomainPanel title="Escalation posture" code="CURRENT OPERATING MODE" icon={LifeBuoy} accent="amber"><div className="escalation"><div><span className="tiny-dot green" /><b>Routine supervision</b><small>Within approved envelope</small></div><div><span className={`tiny-dot ${connectivity === "BLACKOUT" ? "danger" : "amber"}`} /><b>{connectivity === "BLACKOUT" ? "Awaiting reconnection" : "No escalations"}</b><small>{connectivity === "BLACKOUT" ? "Local autonomy active" : "All station events acknowledged"}</small></div></div></DomainPanel></div></div>;
}

function PageIntro({ kicker, title, copy }: { kicker: string; title: string; copy: string }) {
  return <div className="page-intro"><div className="page-intro-main"><span className="section-kicker"><CircleDot size={12} /> {kicker}</span><h2>{title}</h2><p>{copy}</p></div><div className="page-intro-mark"><span>OPERATIONAL VIEW</span><b>NCPOR / POLAR PROGRAMME</b><small>NCPOR ENVIRONMENT · SIMULATED DOMAINS</small></div></div>;
}

function StationTwinExperience({ station, onStationChange, connectivity, capacity, liveByStation, decisions, initialOverview = false }: { station: StationKey; onStationChange: (station: StationKey) => void; connectivity: Connectivity; capacity: number; liveByStation?: LiveEnvironmentMap; decisions?: DecisionEntry[]; initialOverview?: boolean }) {
  const [overview, setOverview] = useState(initialOverview);
  const [selectedComponent, setSelectedComponent] = useState("building");
  const [viewMode, setViewMode] = useState<"3d" | "blueprint">("3d");
  const d = mergeStationData(station, liveByStation?.[station]);
  const stationComponents = stationAssets(station);
  const component = stationComponents.find((item) => item.id === selectedComponent) ?? stationComponents[0];
  const ComponentIcon = component.icon;
  const isBlackout = connectivity === "BLACKOUT";
  const twin = liveByStation?.[station];
  const assetTag = lookupAssetTag(station, selectedComponent);
  const inspectorData = buildAssetInspectorData({
    assetKind: (selectedComponent as AssetKind) ?? "building",
    station,
    assetTag,
    assetType: component.assetType,
    twin,
    connectivity,
  });
  const selectStation = (key: StationKey) => { onStationChange(key); setOverview(false); setSelectedComponent("building"); };
  const scores = twin?.safe_operating_capacity.domain_scores;
  const limitingReasons = new Map((twin?.safe_operating_capacity.limiting_factors ?? []).map((f) => [f.domain, f.reason]));

  return (
    <div className="station-twin-page">
      {/* ── STATION HEADER ── */}
      <div className="twin-page-header">
        <div className="twin-header-left">
          <span className="section-kicker">
            <Layers3 size={13} /> DIGITAL TWIN / SPATIAL INTERFACE
          </span>
          <h2>{overview ? "ANTARCTICA CONTINENTAL OVERVIEW" : `${station.toUpperCase()} RESEARCH STATION`}</h2>
          <p>
            {overview
              ? "All Indian Antarctic Research Stations · Ground & Satellite Telemetry"
              : station === "Maitri"
              ? "Schirmacher Oasis · Queen Maud Land · 70°45′S / 11°44′E"
              : "Larsemann Hills · Princess Elizabeth Land · 69°24′S / 76°11′E"}
          </p>
        </div>

        <div className="twin-header-right">
          {/* Spatial View Mode Toggle (3D Digital Twin vs 2D Blueprint) */}
          {!overview && (
            <div className="twin-view-mode-toggle">
              <button
                type="button"
                className={`twin-mode-btn ${viewMode === "3d" ? "active" : ""}`}
                onClick={() => setViewMode("3d")}
              >
                <Box size={14} />
                <span>3D DIGITAL TWIN</span>
              </button>
              <button
                type="button"
                className={`twin-mode-btn ${viewMode === "blueprint" ? "active" : ""}`}
                onClick={() => setViewMode("blueprint")}
              >
                <Layers3 size={14} />
                <span>2D BLUEPRINT</span>
              </button>
            </div>
          )}

          {/* Station Switcher Tabs */}
          <div className="twin-station-switcher">
            <button
              type="button"
              className={`twin-station-btn ${!overview && station === "Maitri" ? "active" : ""}`}
              onClick={() => selectStation("Maitri")}
            >
              MAITRI
            </button>
            <button
              type="button"
              className={`twin-station-btn ${!overview && station === "Bharati" ? "active" : ""}`}
              onClick={() => selectStation("Bharati")}
            >
              BHARATI
            </button>
            <button
              type="button"
              className={`twin-station-btn ${overview ? "active" : ""}`}
              onClick={() => setOverview(true)}
            >
              <Globe2 size={13} />
              <span>OVERVIEW</span>
            </button>
          </div>
        </div>
      </div>

      {overview ? (
        <div className="station-overview-frame">
          <DigitalTwinCanvas station={station} connectivity={connectivity} onStationClick={selectStation} />
          <div className="overview-instruction">
            <CircleDot size={14} />
            <span>Select a station marker to open its station-level Digital Twin view.</span>
            <span className="overview-hint">MAITRI · SCHIRMACHER OASIS&nbsp;&nbsp; / &nbsp;&nbsp;BHARATI · LARSEMANN HILLS</span>
          </div>
        </div>
      ) : (
        <>
          {/* ── TOP SECTION: PRIMARY SPATIAL WORKSPACE + RIGHT COMPACT OVERVIEW & INSPECTOR ── */}
          <div className={`station-detail-layout ${isBlackout ? "station-blackout" : ""}`}>
            {/* Left / Primary Spatial Workspace */}
            <div className="station-scene-panel">
              {viewMode === "3d" ? (
                station === "Maitri" ? (
                  <MaitriStation3D
                    connectivity={connectivity}
                    liveState={liveByStation?.Maitri}
                    selectedComponent={selectedComponent}
                    onSelectComponent={setSelectedComponent}
                    height="100%"
                    className="flex-1 min-h-0"
                  />
                ) : (
                  <BharatiStation3D
                    connectivity={connectivity}
                    liveState={liveByStation?.Bharati}
                    selectedComponent={selectedComponent}
                    onSelectComponent={setSelectedComponent}
                    height="100%"
                    className="flex-1 min-h-0"
                  />
                )
              ) : (
                <StationBlueprint
                  station={station}
                  connectivity={connectivity}
                  twin={twin}
                  selectedComponent={selectedComponent}
                  onSelectComponent={setSelectedComponent}
                />
              )}

              <div className="scene-footer">
                <button type="button" className="btn btn-xs btn-neutral" onClick={() => setOverview(true)}>
                  <ArrowDownRight size={13} /> ANTARCTICA OVERVIEW
                </button>
                <span>
                  <CircleDot size={11} /> {viewMode === "3d" ? "3D Interactive Model" : "2D Operational Site Plan"} · {d.coords} · {station === "Maitri" ? "Schirmacher Oasis" : "Larsemann Hills"}
                </span>
                <span className="active-view-tag">
                  {viewMode === "3d" ? "3D TWIN ACTIVE" : "2D BLUEPRINT ACTIVE"}
                </span>
              </div>
            </div>

            {/* Right Side: Compact Station Overview + Selected Asset Inspector */}
            <div className="station-info-column">
              {/* 1. Compact Station Overview */}
              <div className="compact-station-card">
                <div className="compact-station-header">
                  <div className="compact-station-title">
                    <span className="eyebrow">STATION OVERVIEW</span>
                    <h4>{station.toUpperCase()}</h4>
                  </div>
                  <div className={`compact-status-badge ${isBlackout ? "badge-blackout" : connectivity === "DEGRADED" ? "badge-degraded" : "badge-operational"}`}>
                    <span className="status-dot" />
                    <b>{isBlackout ? "LOCAL AUTONOMOUS" : connectivity === "DEGRADED" ? "DEGRADED" : "OPERATIONAL"}</b>
                  </div>
                </div>

                <div className="compact-metrics-grid">
                  <div className="compact-metric-cell">
                    <div className="cell-top">
                      <Bolt size={12} className="text-sky-400" />
                      <span>POWER</span>
                    </div>
                    <b>{d.power} <small>kW</small></b>
                    <small className="cell-sub">Avail · {d.critical} kW crit</small>
                  </div>

                  <div className="compact-metric-cell">
                    <div className="cell-top">
                      <Fuel size={12} className="text-sky-400" />
                      <span>FUEL</span>
                    </div>
                    <b>{d.fuel}<small>%</small></b>
                    <small className="cell-sub">{d.days}d ({d.reserve}% res)</small>
                  </div>

                  <div className="compact-metric-cell">
                    <div className="cell-top">
                      <ThermometerSnowflake size={12} className="text-sky-400" />
                      <span>TEMP</span>
                    </div>
                    <b>{d.temp}<small>°C</small></b>
                    <small className="cell-sub">{d.wind} kt {d.windDir}</small>
                  </div>

                  <div className="compact-metric-cell">
                    <div className="cell-top">
                      <Radio size={12} className="text-sky-400" />
                      <span>COMMS</span>
                    </div>
                    <b>{isBlackout ? "0" : `${twin?.connectivity.latency_ms ?? 42}`}<small>{isBlackout ? "" : "ms"}</small></b>
                    <small className="cell-sub">{connectivity}</small>
                  </div>
                </div>

                {/* Quick Asset Select Strip */}
                <div className="compact-asset-picker">
                  <span className="asset-picker-label">ASSET:</span>
                  <div className="asset-picker-pills">
                    {stationComponents.map((item) => {
                      const Icon = item.icon;
                      const isSelected = selectedComponent === item.id;
                      const tag = lookupAssetTag(station, item.id);
                      return (
                        <button
                          key={item.id}
                          type="button"
                          className={`asset-picker-pill ${isSelected ? "active" : ""}`}
                          onClick={() => setSelectedComponent(item.id)}
                          title={`${item.label} (${tag})`}
                        >
                          <Icon size={11} />
                          <span>{tag}</span>
                        </button>
                      );
                    })}
                  </div>
                </div>
              </div>

              {/* 2. Selected Asset Inspector */}
              <div className="station-inspector-wrapper">
                <AssetInspector
                  icon={ComponentIcon}
                  tag={assetTag}
                  title={component.title}
                  station={`${station.toUpperCase()} RESEARCH STATION`}
                  data={inspectorData}
                />
              </div>
            </div>
          </div>

          {/* ── MIDDLE SECTION: FOUR DOMAIN STATUS (FULL WIDTH) ── */}
          <div className="station-domain-strip-full">
            <div className="domain-strip-header">
              <span className="eyebrow">FOUR DOMAIN STATUS</span>
              <span className="domain-strip-sub">NCPOR LIVE TELEMETRY & DETERMINISTIC DOMAIN RULES</span>
            </div>
            <div className="domain-cards-grid">
              <div className="domain-card domain-env">
                <div className="domain-card-top">
                  <div className="domain-card-title">
                    <CloudSnow size={15} className="text-sky-400" />
                    <b>ENVIRONMENT</b>
                  </div>
                  <span className="domain-source-tag live">{liveStatusLabel(twin?.environment)}</span>
                </div>
                <div className="domain-card-score">
                  <span className="score-val">{Math.round(scores?.Environment ?? 88)}%</span>
                  <div className="domain-bar-bg"><i style={{ width: `${scores?.Environment ?? 88}%` }} className="domain-fill" /></div>
                </div>
                <div className="domain-card-detail">
                  <span>{d.temp}°C · {d.wind} kt {d.windDir} · {d.pressure} hPa</span>
                </div>
              </div>

              <div className="domain-card domain-infra">
                <div className="domain-card-top">
                  <div className="domain-card-title">
                    <Building2 size={15} className="text-sky-400" />
                    <b>INFRASTRUCTURE</b>
                  </div>
                  <span className="domain-source-tag">SIMULATED</span>
                </div>
                <div className="domain-card-score">
                  <span className="score-val">{Math.round(scores?.Infrastructure ?? 92)}%</span>
                  <div className="domain-bar-bg"><i style={{ width: `${scores?.Infrastructure ?? 92}%` }} className="domain-fill" /></div>
                </div>
                <div className="domain-card-detail">
                  <span>{limitingReasons.get("Infrastructure") ?? "All critical systems nominal"}</span>
                </div>
              </div>

              <div className="domain-card domain-energy">
                <div className="domain-card-top">
                  <div className="domain-card-title">
                    <Bolt size={15} className="text-sky-400" />
                    <b>ENERGY</b>
                  </div>
                  <span className="domain-source-tag">SIMULATED</span>
                </div>
                <div className="domain-card-score">
                  <span className="score-val">{Math.round(scores?.Energy ?? 85)}%</span>
                  <div className="domain-bar-bg"><i style={{ width: `${scores?.Energy ?? 85}%` }} className="domain-fill" /></div>
                </div>
                <div className="domain-card-detail">
                  <span>{d.power} kW Avail · {d.critical} kW Critical Load</span>
                </div>
              </div>

              <div className="domain-card domain-logistics">
                <div className="domain-card-top">
                  <div className="domain-card-title">
                    <Truck size={15} className="text-sky-400" />
                    <b>LOGISTICS</b>
                  </div>
                  <span className="domain-source-tag">SIMULATED</span>
                </div>
                <div className="domain-card-score">
                  <span className="score-val">{Math.round(scores?.Logistics ?? 78)}%</span>
                  <div className="domain-bar-bg"><i style={{ width: `${scores?.Logistics ?? 78}%` }} className="domain-fill" /></div>
                </div>
                <div className="domain-card-detail">
                  <span>{d.days} days runway · {d.fuel}% fuel ({d.reserve}% reserve)</span>
                </div>
              </div>
            </div>
          </div>

          {/* ── BOTTOM SECTION: DECISION LEDGER (LEFT) + SAFE OPERATING CAPACITY (RIGHT) ── */}
          <div className="station-bottom-grid">
            {/* Left: Decision Ledger */}
            <div className="station-ledger-card">
              <div className="ledger-card-header">
                <div className="ledger-card-title">
                  <History size={15} className="text-sky-400" />
                  <b>DECISION LEDGER</b>
                </div>
                <span className="ledger-card-badge">{(decisions ?? []).length} RECORDED</span>
              </div>

              <div className="ledger-table-wrap">
                <div className="ledger-table-head">
                  <span>TIME</span>
                  <span>TRIGGER</span>
                  <span>ACTION</span>
                  <span>STATUS</span>
                </div>
                {(decisions ?? []).length === 0 ? (
                  <div className="ledger-empty-row">
                    <span>—</span>
                    <b>No autonomous action recorded</b>
                    <span>Bounded autonomy engages during BLACKOUT</span>
                    <em className="status-chip muted">IDLE</em>
                  </div>
                ) : (
                  (decisions ?? []).slice(0, 3).map((entry) => (
                    <div className="ledger-card-row" key={entry.id}>
                      <span className="ledger-time">
                        {new Date(entry.timestamp).toLocaleTimeString("en-IN", { hour12: false })}
                      </span>
                      <b className="ledger-trigger">{entry.trigger}</b>
                      <span className="ledger-action">{entry.action}</span>
                      <em className={`status-chip ${entry.status === "AUTO" ? "amber" : "green"}`}>{entry.status}</em>
                    </div>
                  ))
                )}
              </div>

              {isBlackout && (
                <div className="autonomous-station-panel">
                  <div className="autonomous-station-head">
                    <ShieldCheck size={15} />
                    <b>LOCAL AUTONOMOUS OPERATION ACTIVE</b>
                    <em>BLACKOUT MODE</em>
                  </div>
                  <div className="autonomous-trigger">
                    <span>TRIGGER</span>
                    <b>Comms link drop</b>
                    <span>ENVELOPE</span>
                    <b>Deterministic bounds</b>
                    <span>ACTION</span>
                    <b>Critical load protection</b>
                  </div>
                </div>
              )}
            </div>

            {/* Right: Safe Operating Capacity */}
            <div className="station-capacity-card">
              <div className="capacity-card-header">
                <div className="capacity-card-title">
                  <Gauge size={15} className="text-sky-400" />
                  <b>SAFE OPERATING CAPACITY</b>
                </div>
                <span className="capacity-tag">DETERMINISTIC RULES</span>
              </div>

              <div className="capacity-main-row">
                <div className="capacity-gauge-wrap">
                  <RingGauge value={capacity} size="large" label="SAFE TO OPERATE" />
                </div>
                <div className="capacity-factors-list">
                  <div className="factor-row">
                    <div className="factor-head">
                      <span>Environment</span>
                      <b>{Math.round(scores?.Environment ?? 88)}%</b>
                    </div>
                    <div className="factor-bar-track">
                      <i className="factor-fill" style={{ width: `${scores?.Environment ?? 88}%` }} />
                    </div>
                  </div>

                  <div className="factor-row">
                    <div className="factor-head">
                      <span>Infrastructure</span>
                      <b>{Math.round(scores?.Infrastructure ?? 92)}%</b>
                    </div>
                    <div className="factor-bar-track">
                      <i className="factor-fill" style={{ width: `${scores?.Infrastructure ?? 92}%` }} />
                    </div>
                  </div>

                  <div className="factor-row">
                    <div className="factor-head">
                      <span>Energy</span>
                      <b>{Math.round(scores?.Energy ?? 85)}%</b>
                    </div>
                    <div className="factor-bar-track">
                      <i className="factor-fill" style={{ width: `${scores?.Energy ?? 85}%` }} />
                    </div>
                  </div>

                  <div className="factor-row">
                    <div className="factor-head">
                      <span>Logistics</span>
                      <b>{Math.round(scores?.Logistics ?? 78)}%</b>
                    </div>
                    <div className="factor-bar-track">
                      <i className="factor-fill" style={{ width: `${scores?.Logistics ?? 78}%` }} />
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </>
      )}
    </div>
  );
}

function WhatIfSimulator({ station, base, capacity, connectivity }: { station: StationKey; base: typeof stationData.Maitri; capacity: number; connectivity: Connectivity }) {
  const [wind, setWind] = useState(base.wind);
  const [temp, setTemp] = useState(base.temp);
  const [power, setPower] = useState(base.power);
  const [fuel, setFuel] = useState(base.fuel);
  const [simConnection, setSimConnection] = useState<Connectivity>(connectivity);
  const [simResult, setSimResult] = useState<Awaited<ReturnType<typeof api.simulate>> | null>(null);
  useEffect(() => {
    let cancelled = false;
    const handle = setTimeout(() => {
      api
        .simulate(station, {
          wind_speed_knots: wind,
          temperature_c: temp,
          available_power_kw: power,
          fuel_level_percent: fuel,
          connectivity: simConnection,
        })
        .then((result) => {
          if (!cancelled) setSimResult(result);
        })
        .catch(() => {});
    }, 300);
    return () => {
      cancelled = true;
      clearTimeout(handle);
    };
  }, [station, wind, temp, power, fuel, simConnection]);
  const simulated = simResult?.simulated_state.safe_operating_capacity.safe_capacity_percent ?? capacity;
  const recommendation = simResult?.simulated_state.safe_operating_capacity.recommended_action ?? "Evaluating rules engine…";
  return <div className="detail-layout"><PageIntro kicker="DECISION SUPPORT / WHAT-IF SIMULATOR" title="Stress the operating envelope." copy="Change the inputs, see the rules recalculate the safe state. Current telemetry stays visible beside the scenario." /><div className="sim-layout"><div className="sim-controls"><div className="sim-control-head"><span className="eyebrow">SIMULATION INPUTS</span><span className="sim-tag"><Sparkles size={12} /> RULES ENGINE</span></div><SliderControl label="Wind speed" value={wind} min={0} max={60} suffix=" kt" onChange={setWind} /><SliderControl label="Temperature" value={temp} min={-40} max={5} suffix="°C" onChange={setTemp} /><SliderControl label="Available power" value={power} min={300} max={900} suffix=" kW" onChange={setPower} /><SliderControl label="Fuel level" value={fuel} min={0} max={100} suffix="%" onChange={setFuel} /><div className="select-control"><span className="block mb-2 font-semibold text-slate-300">Connectivity Mode</span><div className="flex gap-2">{(["CONNECTED", "DEGRADED", "BLACKOUT"] as Connectivity[]).map((c) => <button className={`btn btn-sm flex-1 ${simConnection === c ? "btn-primary" : "btn-neutral"}`} onClick={() => setSimConnection(c)} key={c}>{c}</button>)}</div></div></div><div className="sim-output"><div className="sim-output-head"><span className="eyebrow">OPERATING CAPACITY</span><span className="sim-state"><i /> SIMULATED STATE</span></div><div className="compare-row"><div><span>CURRENT STATE</span><RingGauge value={capacity} size="small" /><b>{station}</b></div><div className="compare-arrow"><ArrowUpRight size={20} /></div><div className="simulated-gauge"><span>SIMULATED STATE</span><RingGauge value={simulated} size="small" /><b>{simConnection}</b></div></div><div className="recommendation"><div className="recommend-icon"><TriangleAlert size={17} /></div><div><span>RECOMMENDED BOUNDED ACTION</span><b>{recommendation}</b><small>Based on the current rules, constraints and risk evaluation.</small></div></div></div></div><div className="sim-summary"><span><Wind size={14} /> Wind <b>{wind} kt</b></span><span><ThermometerSnowflake size={14} /> Temp <b>{temp}°C</b></span><span><Bolt size={14} /> Power <b>{power} kW</b></span><span><Fuel size={14} /> Fuel <b>{fuel}%</b></span><span><Radio size={14} /> Link <b>{simConnection}</b></span></div></div>;
}

function SliderControl({ label, value, min, max, suffix, onChange }: { label: string; value: number; min: number; max: number; suffix: string; onChange: (v: number) => void }) {
  return <label className="slider-control"><div><span>{label}</span><b>{value}{suffix}</b></div><input type="range" min={min} max={max} value={value} onChange={(e) => onChange(Number(e.target.value))} /></label>;
}

export default function Home() {
  const [activePage, setActivePage] = useState<PageKey>("Overview");
  const [station, setStation] = useState<StationKey>("Maitri");
  const [connectivity, setConnectivity] = useState<Connectivity>("CONNECTED");
  const [mobileNav, setMobileNav] = useState(false);
  // Real, ticking wall-clock time - independent of any data fetch. Distinct
  // from "data last updated" (environment timestamp) and "model sync" (time
  // since the last successful backend response).
  const [now, setNow] = useState(() => new Date());
  useEffect(() => {
    const id = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(id);
  }, []);
  const maitriTwin = useQuery({ queryKey: ["digital-twin", "Maitri"], queryFn: () => api.digitalTwin("Maitri"), refetchInterval: NCPOR_REFRESH_INTERVAL_MS, staleTime: Math.min(NCPOR_REFRESH_INTERVAL_MS / 2, 300_000), retry: 1 });
  const bharatiTwin = useQuery({ queryKey: ["digital-twin", "Bharati"], queryFn: () => api.digitalTwin("Bharati"), refetchInterval: NCPOR_REFRESH_INTERVAL_MS, staleTime: Math.min(NCPOR_REFRESH_INTERVAL_MS / 2, 300_000), retry: 1 });
  const liveByStation: LiveEnvironmentMap = { Maitri: maitriTwin.data, Bharati: bharatiTwin.data };
  const decisionsQuery = useQuery({ queryKey: ["decisions", station], queryFn: () => api.decisions(station), refetchInterval: 15_000, retry: 1 });
  useEffect(() => {
    api.setConnectivity(station, connectivity).catch(() => {});
    // Notifies the backend FSM + bounded autonomy engine of the selected
    // connectivity mode; the UI itself stays driven by local state above.
  }, [station, connectivity]);
  const d = mergeStationData(station, liveByStation[station]);
  const selectedTwinQuery = station === "Maitri" ? maitriTwin : bharatiTwin;
  // safe_capacity_percent comes straight from the backend's deterministic
  // rule/constraint evaluation - no client-side adjustment is layered on top,
  // so the same station state always produces the same displayed number.
  const capacity = d.capacity;
  const lastSyncedAt = selectedTwinQuery.dataUpdatedAt || null;
  const nextRefreshInMs = lastSyncedAt !== null ? Math.max(0, lastSyncedAt + NCPOR_REFRESH_INTERVAL_MS - now.getTime()) : null;
  const mode = statusCopy(connectivity, liveByStation[station]?.connectivity.latency_ms);
  const clock = now.toLocaleTimeString("en-IN", { hour12: false });
  const lastSyncLabel = lastSyncedAt !== null ? new Date(lastSyncedAt).toLocaleTimeString("en-IN", { hour12: false }) : "SYNCING";
  const go = (page: PageKey) => { setActivePage(page); setMobileNav(false); window.scrollTo({ top: 0, behavior: "smooth" }); };
  return <div className={`app-shell ${connectivity === "BLACKOUT" ? "autonomous-theme" : ""}`}>
    <aside className={`sidebar ${mobileNav ? "open" : ""}`}><div className="brand"><div className="brand-mark"><Snowflake size={22} /></div><div><b>NCPOR <span>OPS</span></b><small>ANTARCTIC OPERATIONS</small></div><button className="mobile-close" onClick={() => setMobileNav(false)}><X size={17} /></button></div><div className="sidebar-station"><span className="eyebrow">ACTIVE STATION</span><div className="station-select"><select value={station} onChange={(e) => { setStation(e.target.value as StationKey); setActivePage("Overview"); }}><option>Maitri</option><option>Bharati</option></select><ChevronDown size={15} /><span className="select-status" /></div><small>{d.coords}</small></div><nav>{navGroups.map((group) => <div className="nav-group" key={group.label}><span className="nav-label">{group.label}</span>{group.items.map(({ label, icon: Icon }) => <button key={label} className={`nav-item ${activePage === label ? "active" : ""}`} onClick={() => go(label)}><Icon size={16} /><span>{label}</span>{label === "Decision Ledger" && <em>{decisionsQuery.data?.length ?? 0}</em>}</button>)}</div>)}</nav><div className="sidebar-foot"><div className="ops-badge"><div className="avatar-ring">I</div><div><b>NCPOR / MOES</b><small>Operations supervision</small></div><Settings2 size={15} /></div><span className="version">NCPOR · ANTARCTIC PROGRAMME</span></div></aside>
    {mobileNav && <button className="nav-scrim" onClick={() => setMobileNav(false)} aria-label="Close navigation" />}
    <main className="main-area"><header className="topbar"><div className="topbar-left"><button className="mobile-menu" onClick={() => setMobileNav(true)}><Menu size={19} /></button><div className="top-title"><span>NCPOR · ANTARCTIC OPERATIONS</span><b>/{activePage.toUpperCase()}</b></div></div><div className="topbar-right"><div className="connection-picker"><i className={`conn-dot ${mode.tone}`} /><select value={connectivity} onChange={(e) => setConnectivity(e.target.value as Connectivity)}><option>CONNECTED</option><option>DEGRADED</option><option>BLACKOUT</option></select><ChevronDown size={13} /></div><div className="weather-pill"><ThermometerSnowflake size={14} /><b>{d.temp}°C</b><span>{d.wind} kt</span></div><div className="top-time"><span>{now.toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" }).toUpperCase()}</span><b>{clock} <small>IST</small></b></div><button className="icon-button"><Bell size={17} /><i /></button></div></header><div className="content-scroll"><div className="content-inner"><div className="content-heading"><div><span className="eyebrow">NCPOR · OPERATIONAL PICTURE</span><h2>{activePage === "Overview" ? "Antarctic station operational status" : activePage}</h2></div><div className={`mode-badge ${mode.tone}`}><span className="mode-pulse" /><div><b>{mode.label}</b><small>{mode.helper}</small></div></div></div><DetailPage page={activePage} station={station} onStationChange={setStation} connectivity={connectivity} capacity={capacity} onOpen={go} liveByStation={liveByStation} decisions={decisionsQuery.data} now={now} lastSyncedAt={lastSyncedAt} nextRefreshInMs={nextRefreshInMs} /></div></div><footer className="footer-status"><span><i className="tiny-dot green" /> SYSTEMS NOMINAL</span><span><Database size={13} /> NCPOR ENVIRONMENT · SIMULATED DOMAINS</span><span><LockKeyhole size={13} /> RULE-BASED OPERATIONS</span><span className="footer-right">LAST SYNC {lastSyncLabel} IST · SYSTEM v2.4.0</span></footer></main>
  </div>;
}

export { Overview };
