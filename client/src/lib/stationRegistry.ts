// Single shared registry of per-station Digital Twin assets. This is the
// SAME set of asset ids/tags used by the 3D scenes' own HOTSPOTS arrays
// (MaitriStation3D.tsx / BharatiStation3D.tsx) - it does not invent new
// assets, it just makes the identity data (id, tag, label, icon, domain)
// available to more than one UI surface (the sidebar asset list, and the
// 2D operational blueprint) without duplicating it a third time.
//
// If a 3D hotspot is ever added/renamed, update it here too - this and the
// two 3D components' HOTSPOTS arrays describe the same physical assets.

import { Bolt, Building2, CloudSnow, Fuel, Radio, ShieldCheck, Truck } from "lucide-react";
import type { AssetKind } from "@/lib/assetTelemetry";
import type { StationKey } from "@/lib/api";

export type IconType = React.ComponentType<{ size?: number | string; className?: string }>;

export interface AssetDefinition {
  id: AssetKind;
  tag: string;
  label: string;
  icon: IconType;
  title: string;
  assetType: string;
  /** Matches the `domain` field already used by the 3D hotspots' popup badges. */
  domain: string;
}

// Assets common to both stations' 3D scenes.
const SHARED_ASSETS: Omit<AssetDefinition, "tag">[] = [
  { id: "building", label: "BUILDING", icon: Building2, title: "Station buildings", assetType: "Infrastructure", domain: "INFRASTRUCTURE" },
  { id: "power", label: "POWER / GENERATOR", icon: Bolt, title: "Power generation", assetType: "Generator", domain: "ENERGY" },
  { id: "communication", label: "COMMUNICATION", icon: Radio, title: "Connectivity", assetType: "Communication", domain: "COMMUNICATION" },
  { id: "fuel", label: "FUEL", icon: Fuel, title: "Fuel stores", assetType: "Fuel Storage", domain: "LOGISTICS" },
  { id: "logistics", label: "LOGISTICS / STORES", icon: Truck, title: "Expedition stores", assetType: "Logistics", domain: "LOGISTICS" },
  { id: "environment", label: "ENVIRONMENT", icon: CloudSnow, title: "Environmental conditions", assetType: "Environmental Sensor", domain: "ENVIRONMENT" },
];

// Bharati's 3D twin has one extra hotspot (seawater pump & auxiliary
// modules) that Maitri's model doesn't have.
const BHARATI_SUPPORT: Omit<AssetDefinition, "tag"> = {
  id: "support",
  label: "AUX / SUPPORT",
  icon: ShieldCheck,
  title: "Seawater pump & auxiliary modules",
  assetType: "Auxiliary Infrastructure",
  domain: "INFRASTRUCTURE",
};

// Per-station tag strings, matching the HOTSPOTS registry in each 3D twin
// component exactly (BLD-001 vs BLD-BH01, etc).
const TAGS: Record<StationKey, Record<string, string>> = {
  Maitri: { building: "BLD-001", power: "ENE-001", communication: "COM-001", fuel: "FUEL-001", logistics: "LOG-001", environment: "ENV-001" },
  Bharati: { building: "BLD-BH01", power: "ENE-BH01", communication: "COM-BH01", fuel: "FUEL-BH01", logistics: "LOG-BH01", environment: "ENV-BH01", support: "SUP-BH01" },
};

export function assetTag(station: StationKey, id: string): string {
  return TAGS[station][id] ?? id.toUpperCase();
}

export function stationAssets(station: StationKey): AssetDefinition[] {
  const base = SHARED_ASSETS.map((a) => ({ ...a, tag: assetTag(station, a.id) }));
  if (station === "Bharati") base.push({ ...BHARATI_SUPPORT, tag: assetTag(station, BHARATI_SUPPORT.id) });
  return base;
}
