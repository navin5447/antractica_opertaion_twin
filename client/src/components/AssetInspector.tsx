import type { AssetInspectorData } from "@/lib/assetTelemetry";
import { STATUS_COLOR } from "@/lib/assetTelemetry";

type IconType = React.ComponentType<{ size?: number | string; className?: string }>;

interface AssetInspectorProps {
  icon: IconType;
  tag: string;
  title: string;
  station: string;
  data: AssetInspectorData;
  onClose?: () => void;
}

// A professional per-asset inspector: identity, status, live telemetry,
// asset metadata, current condition and known system relationships - all
// derived from the same DigitalTwinState already flowing through this page
// (see client/src/lib/assetTelemetry.ts). No values here are invented; a
// section is simply omitted if the backend has nothing to show for it.
export function AssetInspector({ icon: Icon, tag, title, station, data, onClose }: AssetInspectorProps) {
  const color = STATUS_COLOR[data.status];
  return (
    <div className="asset-inspector" style={{ "--status-color": color } as React.CSSProperties}>
      <div className="asset-inspector-head">
        <span className="asset-inspector-icon">
          <Icon size={16} />
        </span>
        <div className="asset-inspector-identity">
          <b>{tag}</b>
          <span>{title}</span>
          <em>{station}</em>
        </div>
        {onClose && (
          <button className="asset-inspector-close" onClick={onClose} title="Close inspector" aria-label="Close asset inspector">
            ×
          </button>
        )}
      </div>

      <div className="asset-inspector-status">
        <i className="asset-inspector-status-dot" />
        <span>{data.statusLabel}</span>
        <div className="asset-inspector-opstate">
          <span>OPERATIONAL STATE</span>
          <b>{data.operationalState}</b>
        </div>
      </div>

      {data.telemetry.length > 0 && (
        <div className="asset-inspector-section">
          <span className="asset-inspector-eyebrow">Telemetry</span>
          <div className="asset-inspector-grid">
            {data.telemetry.map((f) => (
              <div key={f.label}>
                <span>{f.label}</span>
                <b>{f.value}</b>
              </div>
            ))}
          </div>
        </div>
      )}

      <div className="asset-inspector-section">
        <span className="asset-inspector-eyebrow">Asset Information</span>
        <div className="asset-inspector-grid asset-inspector-grid-compact">
          {data.info.map((f) => (
            <div key={f.label}>
              <span>{f.label}</span>
              <b>{f.value}</b>
            </div>
          ))}
        </div>
      </div>

      <div className="asset-inspector-condition">
        <span className="asset-inspector-eyebrow">Current Condition</span>
        <p>{data.condition}</p>
      </div>

      {(data.affects.length > 0 || data.relatedSystems.length > 0) && (
        <div className="asset-inspector-related">
          {data.affects.length > 0 && (
            <div>
              <span className="asset-inspector-eyebrow">Affects</span>
              <div className="asset-inspector-chips">
                {data.affects.map((a) => (
                  <em key={a}>{a}</em>
                ))}
              </div>
            </div>
          )}
          {data.relatedSystems.length > 0 && (
            <div>
              <span className="asset-inspector-eyebrow">Related Systems</span>
              <div className="asset-inspector-chips">
                {data.relatedSystems.map((s) => (
                  <em key={s}>{s}</em>
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
