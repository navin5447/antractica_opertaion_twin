import { useCallback, useRef, useState } from "react";
import type { ConnectivityState, DigitalTwinState, StationKey } from "@/lib/api";
import { buildAssetInspectorData, STATUS_COLOR } from "@/lib/assetTelemetry";
import { stationAssets, type AssetDefinition } from "@/lib/stationRegistry";

interface StationBlueprintProps {
  station: StationKey;
  connectivity: ConnectivityState;
  twin?: DigitalTwinState;
  selectedComponent: string;
  onSelectComponent: (id: string) => void;
}

// ─── SVG viewport ────────────────────────────────────────────────────────────
const VW = 860;
const VH = 520;

// ─── Layout types ─────────────────────────────────────────────────────────────
type ZoneDef  = { id: string; label: string; x: number; y: number; w: number; h: number; accent: string };
type PinDef   = { assetId: string; x: number; y: number };
type LineDef  = { from: [number, number]; to: [number, number]; label: string; dashed?: boolean };
type Layout   = { locationLabel: string; zones: ZoneDef[]; pins: PinDef[]; lines: LineDef[] };

// ─── Station spatial layouts ──────────────────────────────────────────────────
// All coordinates fit inside 860×520. Zone colours use a unified, calm polar
// architectural palette to avoid visual noise.
const LAYOUTS: Record<StationKey, Layout> = {
  Maitri: {
    locationLabel: "SCHIRMACHER OASIS · 70°45.9′S 11°44.1′E",
    zones: [
      { id: "main",      label: "MAIN FACILITY",          x: 290, y: 130, w: 280, h: 190, accent: "#38bdf8" },
      { id: "power",     label: "POWER PLANT",            x:  60, y: 160, w: 175, h: 125, accent: "#0284c7" },
      { id: "fuel",      label: "BULK FUEL FARM",         x:  60, y: 330, w: 175, h: 115, accent: "#64748b" },
      { id: "comms",     label: "SATCOM / ANTENNA",       x: 615, y:  80, w: 195, h: 100, accent: "#60a5fa" },
      { id: "env",       label: "AWS / ENV SENSOR",       x: 615, y: 210, w: 195, h: 100, accent: "#38bdf8" },
      { id: "logistics", label: "STORES & WORKSHOP",      x: 420, y: 360, w: 190, h: 100, accent: "#64748b" },
    ],
    pins: [
      { assetId: "building",      x: 430, y: 225 },
      { assetId: "power",         x: 147, y: 222 },
      { assetId: "fuel",          x: 147, y: 387 },
      { assetId: "communication", x: 712, y: 130 },
      { assetId: "environment",   x: 712, y: 260 },
      { assetId: "logistics",     x: 515, y: 410 },
    ],
    lines: [
      { from: [147, 330], to: [147, 285],   label: "DIESEL FEED" },
      { from: [235, 222], to: [290, 222],   label: "POWER BUS" },
      { from: [615, 130], to: [570, 195],   label: "SATCOM LINK",  dashed: true },
      { from: [615, 260], to: [570, 255],   label: "SENSOR FEED",  dashed: true },
    ],
  },
  Bharati: {
    locationLabel: "LARSEMANN HILLS · 69°24.4′S 76°11.6′E",
    zones: [
      { id: "main",      label: "MAIN FACILITY",          x: 285, y: 120, w: 285, h: 200, accent: "#38bdf8" },
      { id: "power",     label: "POWER PLANT",            x:  55, y: 150, w: 175, h: 125, accent: "#0284c7" },
      { id: "fuel",      label: "BULK FUEL FARM",         x:  55, y: 325, w: 175, h: 115, accent: "#64748b" },
      { id: "comms",     label: "SATCOM / ANTENNA",       x: 615, y:  70, w: 195, h: 100, accent: "#60a5fa" },
      { id: "env",       label: "AWS / ENV SENSOR",       x: 615, y: 200, w: 195, h: 100, accent: "#38bdf8" },
      { id: "logistics", label: "STORES & WORKSHOP",      x: 415, y: 355, w: 190, h: 100, accent: "#64748b" },
      { id: "support",   label: "SEAWATER PUMP / AUX",   x: 615, y: 330, w: 195, h: 110, accent: "#64748b" },
    ],
    pins: [
      { assetId: "building",      x: 427, y: 220 },
      { assetId: "power",         x: 142, y: 212 },
      { assetId: "fuel",          x: 142, y: 382 },
      { assetId: "communication", x: 712, y: 120 },
      { assetId: "environment",   x: 712, y: 250 },
      { assetId: "logistics",     x: 510, y: 405 },
      { assetId: "support",       x: 712, y: 385 },
    ],
    lines: [
      { from: [142, 325], to: [142, 275],   label: "DIESEL FEED" },
      { from: [230, 212], to: [285, 220],   label: "POWER BUS" },
      { from: [615, 120], to: [570, 185],   label: "SATCOM LINK",    dashed: true },
      { from: [615, 250], to: [570, 255],   label: "SENSOR FEED",    dashed: true },
      { from: [615, 385], to: [570, 310],   label: "AUX UTILITIES",  dashed: true },
    ],
  },
};

// ─── Domain filter tabs ───────────────────────────────────────────────────────
const FILTER_TABS = [
  { label: "ALL",   domains: [] as string[] },
  { label: "POWER", domains: ["ENERGY"] },
  { label: "FUEL",  domains: ["LOGISTICS"] },
  { label: "COMMS", domains: ["COMMUNICATION"] },
  { label: "ENV",   domains: ["ENVIRONMENT"] },
  { label: "INFRA", domains: ["INFRASTRUCTURE"] },
];

// ─── Component ────────────────────────────────────────────────────────────────
export function StationBlueprint({
  station, connectivity, twin, selectedComponent, onSelectComponent,
}: StationBlueprintProps) {
  const assets    = stationAssets(station);
  const layout    = LAYOUTS[station];
  const scores    = twin?.safe_operating_capacity?.domain_scores;
  const assetMap  = Object.fromEntries(assets.map((a) => [a.id, a]));

  // zoom / pan
  const [zoom, setZoom] = useState(1);
  const [pan,  setPan]  = useState({ x: 0, y: 0 });
  const dragging   = useRef(false);
  const dragStart  = useRef({ mx: 0, my: 0, px: 0, py: 0 });
  const svgRef     = useRef<SVGSVGElement>(null);

  // hover tooltip
  const [hovered, setHovered] = useState<string | null>(null);
  const [tipPos,  setTipPos]  = useState({ x: 0, y: 0 });

  // filter
  const [filterIdx, setFilterIdx] = useState(0);
  const activeFilter = FILTER_TABS[filterIdx];

  // helpers
  const statusFor = useCallback(
    (a: AssetDefinition) =>
      buildAssetInspectorData({ assetKind: a.id, station, assetTag: a.tag, assetType: a.assetType, twin, connectivity }),
    [station, twin, connectivity]
  );

  const isVisible = (assetId: string) => {
    if (activeFilter.domains.length === 0) return true;
    const a = assetMap[assetId];
    return a ? activeFilter.domains.includes(a.domain) : false;
  };

  // pan / zoom
  const onWheel = (e: React.WheelEvent) => {
    e.preventDefault();
    setZoom((z) => Math.min(2.5, Math.max(0.5, z - e.deltaY * 0.001)));
  };
  const onMouseDown = (e: React.MouseEvent<SVGSVGElement>) => {
    if ((e.target as SVGElement).closest("[data-pin]")) return;
    dragging.current = true;
    dragStart.current = { mx: e.clientX, my: e.clientY, px: pan.x, py: pan.y };
  };
  const onMouseMove = (e: React.MouseEvent<SVGSVGElement>) => {
    if (!dragging.current) return;
    setPan({ x: dragStart.current.px + e.clientX - dragStart.current.mx, y: dragStart.current.py + e.clientY - dragStart.current.my });
  };
  const onMouseUp = () => { dragging.current = false; };

  // tooltip position
  const handlePinEnter = (assetId: string, e: React.MouseEvent) => {
    setHovered(assetId);
    const r = svgRef.current?.getBoundingClientRect();
    if (r) setTipPos({ x: e.clientX - r.left + 14, y: e.clientY - r.top - 8 });
  };
  const handlePinMove = (e: React.MouseEvent) => {
    const r = svgRef.current?.getBoundingClientRect();
    if (r) setTipPos({ x: e.clientX - r.left + 14, y: e.clientY - r.top - 8 });
  };

  const hoveredAsset = hovered ? assetMap[hovered] : null;
  const hoveredData  = hoveredAsset ? statusFor(hoveredAsset) : null;

  // domain score bar data - calm, consistent polar theme
  const domainBars = [
    { label: "ENVIRONMENT",    key: "Environment",    color: "#38bdf8" },
    { label: "ENERGY",         key: "Energy",         color: "#38bdf8" },
    { label: "LOGISTICS",      key: "Logistics",      color: "#38bdf8" },
    { label: "INFRASTRUCTURE", key: "Infrastructure", color: "#38bdf8" },
  ] as const;

  return (
    <div className="sbp-root">
      {/* ── Toolbar ─────────────────────────────────────────────────────── */}
      <div className="sbp-toolbar">
        <div className="sbp-toolbar-left">
          <span className="sbp-title">{station.toUpperCase()} OPERATIONAL BLUEPRINT</span>
          <span className="sbp-coords">{layout.locationLabel}</span>
        </div>
        <div className="sbp-domain-tabs">
          {FILTER_TABS.map((tab, i) => (
            <button key={tab.label} className={`sbp-tab ${filterIdx === i ? "sbp-tab-active" : ""}`} onClick={() => setFilterIdx(i)}>
              {tab.label}
            </button>
          ))}
        </div>
        <div className="sbp-toolbar-right">
          <button className="sbp-ctrl-btn" onClick={() => setZoom((z) => Math.min(2.5, +(z + 0.15).toFixed(2)))} title="Zoom in">＋</button>
          <span className="sbp-zoom-label">{Math.round(zoom * 100)}%</span>
          <button className="sbp-ctrl-btn" onClick={() => setZoom((z) => Math.max(0.5, +(z - 0.15).toFixed(2)))} title="Zoom out">－</button>
          <button className="sbp-ctrl-btn sbp-ctrl-reset" onClick={() => { setZoom(1); setPan({ x: 0, y: 0 }); }}>RESET</button>
        </div>
      </div>

      {/* ── SVG Canvas ──────────────────────────────────────────────────── */}
      <div className="sbp-canvas-wrap" style={{ position: "relative" }}>
        <svg
          ref={svgRef}
          className="sbp-svg"
          viewBox={`0 0 ${VW} ${VH}`}
          onWheel={onWheel}
          onMouseDown={onMouseDown}
          onMouseMove={onMouseMove}
          onMouseUp={onMouseUp}
          onMouseLeave={onMouseUp}
          style={{ cursor: "grab" }}
        >
          <defs>
            {/* Subtle grid */}
            <pattern id="bp-grid-sm" width="30" height="30" patternUnits="userSpaceOnUse">
              <path d="M30 0L0 0 0 30" fill="none" stroke="#1a2e4a" strokeWidth="0.5" />
            </pattern>
            <pattern id="bp-grid-lg" width="120" height="120" patternUnits="userSpaceOnUse">
              <rect width="120" height="120" fill="url(#bp-grid-sm)" />
              <path d="M120 0L0 0 0 120" fill="none" stroke="#243d5e" strokeWidth="1" />
            </pattern>

            {/* Arrow markers — bright enough to see */}
            <marker id="bp-arr-solid" markerWidth="7" markerHeight="7" refX="6" refY="3.5" orient="auto">
              <path d="M0,0 L0,7 L7,3.5 z" fill="#60a5fa" />
            </marker>
            <marker id="bp-arr-dashed" markerWidth="7" markerHeight="7" refX="6" refY="3.5" orient="auto">
              <path d="M0,0 L0,7 L7,3.5 z" fill="#60a5fa" opacity="0.7" />
            </marker>

            {/* Glow for selected pin */}
            <filter id="bp-glow">
              <feGaussianBlur in="SourceGraphic" stdDeviation="4" result="b" />
              <feMerge><feMergeNode in="b" /><feMergeNode in="SourceGraphic" /></feMerge>
            </filter>

            {/* Text background rect helper — drawn inline per label */}
          </defs>

          {/* Dark background */}
          <rect width={VW} height={VH} fill="#060e1b" />
          {/* Grid */}
          <rect width={VW} height={VH} fill="url(#bp-grid-lg)" />

          {/* All content in pan/zoom group */}
          <g transform={`translate(${pan.x} ${pan.y}) scale(${zoom})`} style={{ transformOrigin: "0 0" }}>

            {/* ── Zones ──────────────────────────────────────────────── */}
            {layout.zones.map((z) => (
              <g key={z.id}>
                {/* Filled zone */}
                <rect
                  x={z.x} y={z.y} width={z.w} height={z.h}
                  fill={z.accent} fillOpacity={0.07}
                  stroke={z.accent} strokeOpacity={0.6}
                  strokeWidth={1.5}
                  strokeDasharray="6 3"
                  rx={5}
                />
                {/* Zone label pill */}
                <rect
                  x={z.x + 7} y={z.y + 6}
                  width={z.label.length * 6 + 12} height={14}
                  fill={z.accent} fillOpacity={0.18}
                  rx={3}
                />
                <text
                  x={z.x + 13} y={z.y + 17}
                  fontSize={8} fontWeight={700} letterSpacing={0.8}
                  fill={z.accent}
                  style={{ fontFamily: "'JetBrains Mono', monospace", userSelect: "none" }}
                >
                  {z.label}
                </text>
              </g>
            ))}

            {/* ── Flow Lines ─────────────────────────────────────────── */}
            {layout.lines.map((ln, i) => {
              const mx = (ln.from[0] + ln.to[0]) / 2;
              const my = (ln.from[1] + ln.to[1]) / 2;
              const lw = ln.label.length * 5.2 + 8;
              return (
                <g key={i}>
                  <line
                    x1={ln.from[0]} y1={ln.from[1]}
                    x2={ln.to[0]}   y2={ln.to[1]}
                    stroke="#60a5fa"
                    strokeWidth={ln.dashed ? 1.5 : 2}
                    strokeDasharray={ln.dashed ? "6 4" : undefined}
                    markerEnd={ln.dashed ? "url(#bp-arr-dashed)" : "url(#bp-arr-solid)"}
                    opacity={0.75}
                  />
                  {/* Line label with opaque background */}
                  <rect x={mx - lw / 2} y={my - 9} width={lw} height={12} fill="#060e1b" rx={2} opacity={0.9} />
                  <text
                    x={mx} y={my}
                    textAnchor="middle" fontSize={7} fontWeight={700} letterSpacing={0.5}
                    fill="#60a5fa"
                    style={{ fontFamily: "'JetBrains Mono', monospace", userSelect: "none" }}
                  >
                    {ln.label}
                  </text>
                </g>
              );
            })}

            {/* ── Asset Pins ─────────────────────────────────────────── */}
            {layout.pins.map((pin) => {
              const asset   = assetMap[pin.assetId];
              if (!asset) return null;
              const data      = statusFor(asset);
              const sColor    = STATUS_COLOR[data.status];
              const isSelected = selectedComponent === pin.assetId;
              const visible   = isVisible(pin.assetId);
              const isRoot    = pin.assetId === "building";
              const r         = isRoot ? 26 : 20;
              const tagW      = asset.tag.length * 6.2 + 10;

              return (
                <g
                  key={pin.assetId}
                  data-pin="true"
                  transform={`translate(${pin.x} ${pin.y})`}
                  opacity={visible ? 1 : 0.15}
                  filter={isSelected ? "url(#bp-glow)" : undefined}
                  onClick={() => visible && onSelectComponent(pin.assetId)}
                  onMouseEnter={(e) => handlePinEnter(pin.assetId, e)}
                  onMouseMove={handlePinMove}
                  onMouseLeave={() => setHovered(null)}
                  style={{ cursor: visible ? "pointer" : "default" }}
                  role="button"
                  aria-label={`${asset.tag} — ${data.statusLabel}`}
                  tabIndex={visible ? 0 : -1}
                  onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") onSelectComponent(pin.assetId); }}
                >
                  {/* Spinning selection ring */}
                  {isSelected && (
                    <circle r={r + 8} fill="none" stroke={sColor} strokeWidth={2} strokeDasharray="4 3" opacity={0.9}>
                      <animateTransform attributeName="transform" type="rotate" from="0" to="360" dur="10s" repeatCount="indefinite" />
                    </circle>
                  )}

                  {/* Outer glow ring */}
                  <circle r={r + 2} fill="none" stroke={sColor} strokeWidth={0.8} opacity={isSelected ? 0.6 : 0.25} />

                  {/* Pin body — darker fill so it reads as a distinct object */}
                  <circle
                    r={r}
                    fill={isRoot ? "#0d1f38" : "#0a1828"}
                    stroke={isSelected ? sColor : "#2d4a6e"}
                    strokeWidth={isSelected ? 2.5 : 1.5}
                  />

                  {/* Status pulse dot — top-right corner */}
                  <circle cx={r - 5} cy={-(r - 5)} r={5} fill={sColor}>
                    {data.status !== "NORMAL" && (
                      <animate attributeName="opacity" values="1;0.25;1" dur="1.6s" repeatCount="indefinite" />
                    )}
                  </circle>
                  {/* White inner dot for status dot visibility */}
                  <circle cx={r - 5} cy={-(r - 5)} r={2.5} fill="white" opacity={0.4} />

                  {/* Tag label — pill background so it's always readable */}
                  <rect x={-tagW / 2} y={r + 5} width={tagW} height={13} fill="#0a1828" stroke="#2d4a6e" strokeWidth={0.8} rx={3} />
                  <text
                    y={r + 15}
                    textAnchor="middle"
                    fontSize={8} fontWeight={700} letterSpacing={0.6}
                    fill={isSelected ? sColor : "#94b4d4"}
                    style={{ fontFamily: "'JetBrains Mono', monospace", userSelect: "none" }}
                  >
                    {asset.tag}
                  </text>

                  {/* Status label */}
                  <text
                    y={r + 28}
                    textAnchor="middle"
                    fontSize={7} fontWeight={600}
                    fill={sColor}
                    style={{ fontFamily: "'JetBrains Mono', monospace", userSelect: "none" }}
                  >
                    {data.statusLabel}
                  </text>
                </g>
              );
            })}

            {/* ── North Arrow (top-left) ───────────────────────────── */}
            <g transform="translate(42 48)">
              <circle r={22} fill="#0a1828" stroke="#2d4a6e" strokeWidth={1.5} />
              {/* N indicator */}
              <line x1={0} y1={16} x2={0} y2={-16} stroke="#38bdf8" strokeWidth={2} strokeLinecap="round" />
              <polygon points="0,-16 -5,-4 0,-9 5,-4" fill="#38bdf8" />
              <polygon points="0,16 -5,4 0,9 5,4"   fill="#2d4a6e" />
              <text y={-19} textAnchor="middle" fontSize={8} fontWeight={800} fill="#38bdf8"
                style={{ fontFamily: "'JetBrains Mono', monospace", userSelect: "none" }}>N</text>
            </g>

            {/* ── Scale Bar (bottom-right) ─────────────────────────── */}
            <g transform={`translate(${VW - 155} ${VH - 28})`}>
              <line x1={0} y1={0} x2={90} y2={0} stroke="#2d4a6e" strokeWidth={2} strokeLinecap="round" />
              <line x1={0} y1={-5} x2={0} y2={5} stroke="#2d4a6e" strokeWidth={1.5} />
              <line x1={90} y1={-5} x2={90} y2={5} stroke="#2d4a6e" strokeWidth={1.5} />
              <rect x={10} y={-20} width={70} height={13} fill="#060e1b" rx={2} opacity={0.9} />
              <text x={45} y={-10} textAnchor="middle" fontSize={7} fontWeight={600} fill="#60a5fa"
                style={{ fontFamily: "'JetBrains Mono', monospace", userSelect: "none" }}>~500 m SCHEMATIC</text>
              <text x={0}  y={13} textAnchor="middle" fontSize={7} fill="#4a6080"
                style={{ fontFamily: "'JetBrains Mono', monospace", userSelect: "none" }}>0</text>
              <text x={90} y={13} textAnchor="middle" fontSize={7} fill="#4a6080"
                style={{ fontFamily: "'JetBrains Mono', monospace", userSelect: "none" }}>500</text>
            </g>

          </g>{/* end zoom/pan group */}
        </svg>

        {/* ── Hover Tooltip ─────────────────────────────────────────────── */}
        {hoveredAsset && hoveredData && (
          <div className="sbp-tooltip" style={{ left: tipPos.x, top: tipPos.y }} aria-hidden="true">
            <div className="sbp-tooltip-tag">{hoveredAsset.tag}</div>
            <div className="sbp-tooltip-title">{hoveredAsset.title}</div>
            {hoveredData.telemetry.slice(0, 2).map((t) => (
              <div key={t.label} className="sbp-tooltip-telem">{t.label}: <b>{t.value}</b></div>
            ))}
            <div className="sbp-tooltip-status" style={{ color: STATUS_COLOR[hoveredData.status] }}>
              ● {hoveredData.statusLabel}
            </div>
          </div>
        )}
      </div>

      {/* ── Domain Score Strip ───────────────────────────────────────────── */}
      <div className="sbp-score-strip">
        {domainBars.map((d) => {
          const val = scores ? Math.round((scores as Record<string, number>)[d.key] ?? 0) : null;
          return (
            <div key={d.key} className="sbp-score-item">
              <span className="sbp-score-label">{d.label}</span>
              <div className="sbp-score-bar-bg">
                <div className="sbp-score-bar-fill" style={{ width: val !== null ? `${val}%` : "0%", background: d.color }} />
              </div>
              <span className="sbp-score-val" style={{ color: d.color }}>{val !== null ? `${val}%` : "—"}</span>
            </div>
          );
        })}
        <div className="sbp-score-disclaimer">
          Schematic only · not a surveyed site plan · asset positions are operational, not geographic
        </div>
      </div>

      {/* ── Legend ───────────────────────────────────────────────────────── */}
      <div className="sbp-legend">
        {(["NORMAL", "WARNING", "CRITICAL"] as const).map((s) => (
          <span key={s} className="sbp-legend-item">
            <i className="sbp-legend-dot" style={{ background: STATUS_COLOR[s] }} />{s}
          </span>
        ))}
        <span className="sbp-legend-hint">Click a pin to select · scroll/drag to navigate</span>
      </div>
    </div>
  );
}
