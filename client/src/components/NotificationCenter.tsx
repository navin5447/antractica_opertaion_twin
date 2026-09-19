import { useMemo, useState, useEffect, useRef } from "react";
import type { DecisionEntry, DigitalTwinState } from "@/lib/api";
import {
  Bell,
  AlertTriangle,
  ShieldCheck,
  Radio,
  CloudSnow,
  Bolt,
  Fuel,
  History,
  CheckCircle2,
  X,
  ExternalLink,
  CheckCheck,
  Trash2,
  Layers3,
  Gauge,
} from "lucide-react";

type StationKey = "Maitri" | "Bharati";
type Connectivity = "CONNECTED" | "DEGRADED" | "BLACKOUT";

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

export interface NotificationItem {
  id: string;
  type: "critical" | "warning" | "info" | "decision" | "success";
  category: "ALERTS" | "DECISIONS" | "DOMAINS" | "SYSTEM";
  title: string;
  message: string;
  timestamp: number;
  targetPage: PageKey;
  station: StationKey;
  actionLabel: string;
  icon: typeof AlertTriangle;
}

interface NotificationCenterProps {
  isOpen: boolean;
  onClose: () => void;
  station: StationKey;
  connectivity: Connectivity;
  capacity: number;
  twin?: DigitalTwinState;
  decisions?: DecisionEntry[];
  now: Date;
  onNavigate: (page: PageKey) => void;
  unreadCount: number;
  onUpdateUnreadCount: (count: number) => void;
}

export function NotificationCenter({
  isOpen,
  onClose,
  station,
  connectivity,
  capacity,
  twin,
  decisions,
  now,
  onNavigate,
  onUpdateUnreadCount,
}: NotificationCenterProps) {
  const [readIds, setReadIds] = useState<Set<string>>(() => new Set());
  const [dismissedIds, setDismissedIds] = useState<Set<string>>(() => new Set());
  const [activeTab, setActiveTab] = useState<"ALL" | "ALERTS" | "DECISIONS" | "DOMAINS">("ALL");
  const panelRef = useRef<HTMLDivElement>(null);

  // Generate dynamic, live operational notifications derived from real station telemetry
  const allNotifications = useMemo<NotificationItem[]>(() => {
    const items: NotificationItem[] = [];

    // 1. Connectivity & Blackout Alert
    if (connectivity === "BLACKOUT") {
      items.push({
        id: `conn-blackout-${station}`,
        type: "critical",
        category: "ALERTS",
        title: "Communication Blackout Engaged",
        message: "Satellite uplink offline. Autonomous Bounded Rule Engine is now protecting critical loads locally.",
        timestamp: Date.now() - 60000,
        targetPage: "Autonomous Mode",
        station,
        actionLabel: "View Autonomy Posture",
        icon: ShieldCheck,
      });
    } else if (connectivity === "DEGRADED") {
      items.push({
        id: `conn-degraded-${station}`,
        type: "warning",
        category: "ALERTS",
        title: "Telemetry Link Latency Degraded",
        message: `High latency on NCPOR telemetry link (${twin?.connectivity.latency_ms ?? 340}ms). Operating in assisted supervision mode.`,
        timestamp: Date.now() - 180000,
        targetPage: "HQ / NCPOR",
        station,
        actionLabel: "Check Link Status",
        icon: Radio,
      });
    } else {
      items.push({
        id: `conn-ok-${station}`,
        type: "success",
        category: "SYSTEM",
        title: "NCPOR Satcom Link Nominal",
        message: `Live telemetry synchronized with NCPOR headquarters (${twin?.connectivity.latency_ms ?? 42}ms latency).`,
        timestamp: Date.now() - 300000,
        targetPage: "HQ / NCPOR",
        station,
        actionLabel: "View Link Diagnostics",
        icon: CheckCircle2,
      });
    }

    // 2. Safe Operating Capacity Threshold Alerts
    if (capacity < 70) {
      items.push({
        id: `cap-low-${station}`,
        type: "critical",
        category: "ALERTS",
        title: `Safe Capacity Dropped to ${capacity}%`,
        message: `Deterministic constraints have lowered the safe operating envelope for ${station}. Discretionary actions restricted.`,
        timestamp: Date.now() - 120000,
        targetPage: "Safe Operating Capacity",
        station,
        actionLabel: "Inspect Constraints",
        icon: Gauge,
      });
    } else if (capacity < 80) {
      items.push({
        id: `cap-warn-${station}`,
        type: "warning",
        category: "ALERTS",
        title: `Safe Operating Capacity: ${capacity}%`,
        message: `Weather or logistics reserve constraints are shaping the safe operating threshold.`,
        timestamp: Date.now() - 240000,
        targetPage: "Safe Operating Capacity",
        station,
        actionLabel: "Review Capacity Factors",
        icon: Gauge,
      });
    }

    // 3. Environment Alerts (Wind, Temperature)
    const wind = twin?.environment.wind_speed_knots ?? (station === "Maitri" ? 19 : 24);
    const temp = twin?.environment.temperature_c ?? (station === "Maitri" ? -18.6 : -14.2);
    if (wind >= 25) {
      items.push({
        id: `env-wind-${station}`,
        type: "warning",
        category: "DOMAINS",
        title: `High Wind Speed: ${wind} kt`,
        message: `Sub-gale winds recorded at ${station}. Outdoor research and external logistics operations are bounded.`,
        timestamp: Date.now() - 400000,
        targetPage: "Environment",
        station,
        actionLabel: "View Environment",
        icon: CloudSnow,
      });
    }
    if (temp <= -20) {
      items.push({
        id: `env-temp-${station}`,
        type: "info",
        category: "DOMAINS",
        title: `Extreme Cold: ${temp}°C`,
        message: `Ambient temperatures have dropped below -20°C. Habitat thermal heating loads elevated.`,
        timestamp: Date.now() - 600000,
        targetPage: "Environment",
        station,
        actionLabel: "View Thermal Telemetry",
        icon: CloudSnow,
      });
    }

    // 4. Energy & Logistics Alerts
    const fuel = twin?.logistics.fuel_stock_percent ?? (station === "Maitri" ? 68 : 74);
    const reserve = twin?.logistics.safety_reserve_percent ?? (station === "Maitri" ? 42 : 45);
    const days = twin?.logistics.remaining_operational_days ?? (station === "Maitri" ? 19 : 23);
    if (fuel - reserve < 25) {
      items.push({
        id: `log-fuel-${station}`,
        type: "warning",
        category: "DOMAINS",
        title: `Fuel Runway Notice: ${days} Days`,
        message: `Fuel stock is at ${fuel}% with a protected ${reserve}% safety reserve threshold.`,
        timestamp: Date.now() - 500000,
        targetPage: "Logistics",
        station,
        actionLabel: "View Logistics",
        icon: Fuel,
      });
    }

    const availablePower = twin?.energy.available_power_kw ?? (station === "Maitri" ? 724 : 648);
    const criticalLoad = twin?.energy.critical_load_kw ?? (station === "Maitri" ? 402 : 388);
    items.push({
      id: `energy-status-${station}`,
      type: "info",
      category: "DOMAINS",
      title: `Power Generation: ${availablePower} kW`,
      message: `Diesel generators operating nominally. Critical load leaves a stable ${availablePower - criticalLoad} kW operating margin.`,
      timestamp: Date.now() - 700000,
      targetPage: "Energy",
      station,
      actionLabel: "View Energy Grid",
      icon: Bolt,
    });

    // 5. Decision Ledger stream events
    (decisions ?? []).slice(0, 3).forEach((dec, idx) => {
      items.push({
        id: `dec-${dec.id || idx}-${dec.timestamp}`,
        type: "decision",
        category: "DECISIONS",
        title: `Rule Evaluated: ${dec.trigger}`,
        message: `Action executed: "${dec.action}". Outcome: ${dec.outcome}`,
        timestamp: new Date(dec.timestamp).getTime(),
        targetPage: "Decision Ledger",
        station,
        actionLabel: "Open Decision Ledger",
        icon: History,
      });
    });

    return items;
  }, [station, connectivity, capacity, twin, decisions]);

  // Active visible notifications
  const visibleNotifications = useMemo(() => {
    return allNotifications.filter((item) => !dismissedIds.has(item.id));
  }, [allNotifications, dismissedIds]);

  // Filtered by tab
  const filteredNotifications = useMemo(() => {
    if (activeTab === "ALL") return visibleNotifications;
    return visibleNotifications.filter((item) => item.category === activeTab);
  }, [visibleNotifications, activeTab]);

  // Calculate unread count
  const unreadCount = useMemo(() => {
    return visibleNotifications.filter((item) => !readIds.has(item.id)).length;
  }, [visibleNotifications, readIds]);

  useEffect(() => {
    onUpdateUnreadCount(unreadCount);
  }, [unreadCount, onUpdateUnreadCount]);

  // Mark all as read
  const handleMarkAllRead = () => {
    const next = new Set(readIds);
    visibleNotifications.forEach((n) => next.add(n.id));
    setReadIds(next);
  };

  // Clear all
  const handleClearAll = () => {
    const next = new Set(dismissedIds);
    allNotifications.forEach((n) => next.add(n.id));
    setDismissedIds(next);
  };

  // Dismiss single notification
  const handleDismissOne = (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    setDismissedIds((prev) => {
      const next = new Set(prev);
      next.add(id);
      return next;
    });
  };

  // Navigate & close
  const handleItemClick = (item: NotificationItem) => {
    setReadIds((prev) => {
      const next = new Set(prev);
      next.add(item.id);
      return next;
    });
    onNavigate(item.targetPage);
    onClose();
  };

  // Close on Escape or click outside
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape" && isOpen) {
        onClose();
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  return (
    <>
      {/* Dimmed backdrop */}
      <div className="notification-backdrop" onClick={onClose} aria-hidden="true" />

      {/* Flyout Panel */}
      <aside className="notification-panel" ref={panelRef} aria-label="Notifications panel">
        {/* Header */}
        <div className="notification-header">
          <div className="notification-header-title">
            <div className="flex items-center gap-2">
              <span className="notif-bell-badge">
                <Bell size={15} />
              </span>
              <h3>OPERATIONAL ALERTS</h3>
            </div>
            {unreadCount > 0 && (
              <span className="notif-unread-pill">{unreadCount} UNREAD</span>
            )}
          </div>
          <button className="notif-close-btn" onClick={onClose} aria-label="Close notification panel">
            <X size={16} />
          </button>
        </div>

        {/* Filter Tabs & Quick Actions */}
        <div className="notification-toolbar">
          <div className="notif-filter-tabs">
            {(["ALL", "ALERTS", "DECISIONS", "DOMAINS"] as const).map((tab) => {
              const count =
                tab === "ALL"
                  ? visibleNotifications.length
                  : visibleNotifications.filter((n) => n.category === tab).length;
              return (
                <button
                  key={tab}
                  type="button"
                  className={`notif-tab ${activeTab === tab ? "active" : ""}`}
                  onClick={() => setActiveTab(tab)}
                >
                  <span>{tab}</span>
                  <span className="notif-tab-count">{count}</span>
                </button>
              );
            })}
          </div>

          <div className="notif-actions-bar">
            <button
              type="button"
              className="notif-action-btn"
              onClick={handleMarkAllRead}
              disabled={unreadCount === 0}
              title="Mark all notifications as read"
            >
              <CheckCheck size={12} />
              <span>Mark read</span>
            </button>
            <button
              type="button"
              className="notif-action-btn text-rose-400 hover:text-rose-300"
              onClick={handleClearAll}
              disabled={visibleNotifications.length === 0}
              title="Clear all notifications"
            >
              <Trash2 size={12} />
              <span>Clear</span>
            </button>
          </div>
        </div>

        {/* Notifications List */}
        <div className="notification-list">
          {filteredNotifications.length === 0 ? (
            <div className="notif-empty-state">
              <CheckCircle2 size={32} className="text-emerald-400 opacity-80" />
              <b>All Caught Up</b>
              <p>No active operational alerts in this category.</p>
              <span className="text-xs text-slate-500 font-mono">
                {station.toUpperCase()} RESEARCH STATION · NOMINAL STATE
              </span>
            </div>
          ) : (
            filteredNotifications.map((item) => {
              const Icon = item.icon;
              const isUnread = !readIds.has(item.id);
              const minutesAgo = Math.max(1, Math.floor((now.getTime() - item.timestamp) / 60000));
              const timeLabel =
                minutesAgo < 60 ? `${minutesAgo}m ago` : `${Math.floor(minutesAgo / 60)}h ago`;

              return (
                <article
                  key={item.id}
                  className={`notif-card notif-type-${item.type} ${isUnread ? "unread" : ""}`}
                  onClick={() => handleItemClick(item)}
                >
                  <div className="notif-card-header">
                    <span className={`notif-icon-wrap notif-icon-${item.type}`}>
                      <Icon size={14} />
                    </span>
                    <div className="notif-card-meta">
                      <span className="notif-type-tag">{item.type.toUpperCase()}</span>
                      <span className="notif-dot-sep">·</span>
                      <span className="notif-time">{timeLabel}</span>
                    </div>
                    {isUnread && <span className="notif-unread-dot" title="Unread" />}
                    <button
                      type="button"
                      className="notif-dismiss-btn"
                      onClick={(e) => handleDismissOne(item.id, e)}
                      title="Dismiss alert"
                    >
                      <X size={13} />
                    </button>
                  </div>

                  <h4 className="notif-card-title">{item.title}</h4>
                  <p className="notif-card-message">{item.message}</p>

                  <div className="notif-card-footer">
                    <span className="notif-station-badge">{item.station}</span>
                    <span className="notif-nav-link">
                      <span>{item.actionLabel}</span>
                      <ExternalLink size={11} />
                    </span>
                  </div>
                </article>
              );
            })
          )}
        </div>

        {/* Footer */}
        <div className="notification-footer">
          <div className="flex items-center gap-1.5 text-[10px] text-slate-400 font-mono">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
            <span>NCPOR REAL-TIME EVENT STREAM</span>
          </div>
          <button
            type="button"
            className="text-[10.5px] font-mono text-sky-400 hover:text-sky-300 font-semibold"
            onClick={() => {
              onNavigate("Decision Ledger");
              onClose();
            }}
          >
            DECISION LEDGER →
          </button>
        </div>
      </aside>
    </>
  );
}
