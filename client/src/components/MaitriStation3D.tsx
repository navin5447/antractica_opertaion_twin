import React, { useEffect, useRef, useState, useCallback } from "react";
import * as THREE from "three";
import { OrbitControls } from "three/examples/jsm/controls/OrbitControls.js";
import { GLTFLoader } from "three/examples/jsm/loaders/GLTFLoader.js";
import {
  Activity,
  ArrowUpRight,
  BatteryCharging,
  Bolt,
  Building2,
  Camera,
  Check,
  ChevronRight,
  CircleDot,
  CloudSnow,
  Compass,
  Eye,
  Flame,
  Fuel,
  Gauge,
  Layers3,
  Maximize2,
  Minimize2,
  Moon,
  Radio,
  RotateCcw,
  RotateCw,
  Scan,
  ShieldCheck,
  Sparkles,
  Sun,
  ThermometerSnowflake,
  Truck,
  Wind,
  X,
  Zap,
} from "lucide-react";
import type { DigitalTwinState, ConnectivityState } from "@/lib/api";
import { buildAssetInspectorData, STATUS_COLOR, type AssetStatus } from "@/lib/assetTelemetry";

export type SubsystemId =
  | "building"
  | "power"
  | "communication"
  | "fuel"
  | "logistics"
  | "environment";

export type RenderMode = "pbr" | "hologram" | "thermal" | "night";

export interface HotspotData {
  id: SubsystemId;
  label: string;
  tag: string;
  worldPos: THREE.Vector3;
  icon: typeof Building2;
  title: string;
  summary: string;
  domain: string;
}

interface MaitriStation3DProps {
  connectivity: ConnectivityState;
  liveState?: DigitalTwinState;
  selectedComponent: string;
  onSelectComponent: (id: string) => void;
  className?: string;
  height?: string | number;
}

// Subsystem hotspot markers matching maitri-station.glb 3D world space
const HOTSPOTS: HotspotData[] = [
  {
    id: "building",
    label: "MAIN FACILITY",
    tag: "BLD-001",
    worldPos: new THREE.Vector3(0, 11.2, 0),
    icon: Building2,
    title: "Maitri Main Facility",
    summary: "2-Story steel-framed living & research complex · Tricolor facade on stilts",
    domain: "INFRASTRUCTURE",
  },
  {
    id: "power",
    label: "POWER & GENERATORS",
    tag: "ENE-001",
    worldPos: new THREE.Vector3(16.5, 4.2, -8.0),
    icon: Bolt,
    title: "Generator & Heating Bay",
    summary: "Dual diesel generators A+B · 724 kW total output capacity",
    domain: "ENERGY",
  },
  {
    id: "communication",
    label: "ISRO SATCOM & RADOME",
    tag: "COM-001",
    worldPos: new THREE.Vector3(7.0, 18.8, 0.0),
    icon: Radio,
    title: "Satellite Dish & Radome",
    summary: "ISRO high-gain satellite uplink · 42 ms latency nominal",
    domain: "COMMUNICATION",
  },
  {
    id: "fuel",
    label: "BULK FUEL FARM",
    tag: "FUEL-001",
    worldPos: new THREE.Vector3(-12.0, 3.8, -9.0),
    icon: Fuel,
    title: "Bulk Fuel Farm",
    summary: "4 bulk storage tanks + pipeline network · 68% stock",
    domain: "LOGISTICS",
  },
  {
    id: "logistics",
    label: "EXPEDITION STORES",
    tag: "LOG-001",
    worldPos: new THREE.Vector3(-10.0, 3.2, 11.5),
    icon: Truck,
    title: "Expedition Containers",
    summary: "Insulated ISO storage modules · Food rations & critical spares",
    domain: "LOGISTICS",
  },
  {
    id: "environment",
    label: "WEATHER MAST & OASIS",
    tag: "ENV-001",
    worldPos: new THREE.Vector3(24.0, 6.8, 4.0),
    icon: CloudSnow,
    title: "NCPOR Met Mast & Lake",
    summary: "Continuous anemometer, barometer & Schirmacher terrain telemetry",
    domain: "ENVIRONMENT",
  },
];

// Presets calibrated for optimal view of maitri-station.glb geometry
const CAMERA_PRESETS = [
  { name: "Overview", pos: [34, 24, 38], target: [0, 5.5, 0] },
  { name: "Main Facility", pos: [0, 16, 26], target: [0, 10, 0] },
  { name: "Satcom Tower", pos: [16, 23, 14], target: [7, 16, 0] },
  { name: "Power Bay", pos: [30, 12, -18], target: [16, 3, -8] },
  { name: "Fuel Farm", pos: [-28, 12, -18], target: [-12, 3, -9] },
  { name: "Expedition Camp", pos: [-12, 10, 26], target: [-10, 2, 11] },
  { name: "Tactical Top-Down", pos: [0, 65, 0.1], target: [0, 5, 0] },
];

/**
 * Creates realistic, rich PBR material configuration based on mesh name & material name
 */
function enhanceMeshMaterial(mesh: THREE.Mesh): THREE.Material {
  const meshName = (mesh.name || "").toUpperCase();
  const matName = (
    Array.isArray(mesh.material)
      ? mesh.material[0]?.name || ""
      : mesh.material?.name || ""
  ).toUpperCase();

  // 1. Indian Tricolor Facade Bands & Indian Flag
  if (
    matName.includes("TRICOLOR_SAFFRON") ||
    matName.includes("FLAG_SAFFRON") ||
    meshName.includes("SAFFRON")
  ) {
    return new THREE.MeshStandardMaterial({
      color: new THREE.Color("#ff671f"),
      roughness: 0.4,
      metalness: 0.05,
      name: "Tricolor_Saffron",
    });
  }
  if (
    matName.includes("TRICOLOR_GREEN") ||
    matName.includes("FLAG_GREEN") ||
    meshName.includes("GREEN")
  ) {
    return new THREE.MeshStandardMaterial({
      color: new THREE.Color("#046a38"),
      roughness: 0.4,
      metalness: 0.05,
      name: "Tricolor_Green",
    });
  }
  if (
    matName.includes("TRICOLOR_WHITE") ||
    matName.includes("FLAG_WHITE")
  ) {
    return new THREE.MeshStandardMaterial({
      color: new THREE.Color("#f8fafc"),
      roughness: 0.45,
      metalness: 0.05,
      name: "Tricolor_White",
    });
  }
  if (matName.includes("FLAG_BLUE") || meshName.includes("CHAKRA")) {
    return new THREE.MeshStandardMaterial({
      color: new THREE.Color("#000080"),
      roughness: 0.4,
      metalness: 0.1,
      name: "Flag_Blue",
    });
  }

  // 2. Main Station Facade & Walls
  if (
    meshName.includes("MAIN_MAITRI_BUILDING") ||
    matName.includes("MAITRI_GREY_GREEN") ||
    matName.includes("MAITRI_REALISTIC") ||
    matName.includes("MAITRI_WHITE") ||
    matName.includes("LIGHT_PANEL")
  ) {
    return new THREE.MeshStandardMaterial({
      color: new THREE.Color("#a1b1c2"),
      roughness: 0.38,
      metalness: 0.12,
      name: "Maitri_Panel",
    });
  }

  // 3. Roofs
  if (
    meshName.includes("ROOF") ||
    matName.includes("DARK_ROOF") ||
    matName.includes("MAITRI_ROOF")
  ) {
    return new THREE.MeshStandardMaterial({
      color: new THREE.Color("#1e293b"),
      roughness: 0.35,
      metalness: 0.6,
      name: "Maitri_Roof",
    });
  }

  // 4. Windows & Tinted Glass
  if (
    meshName.includes("WINDOW") ||
    meshName.includes("GLASS") ||
    matName.includes("WINDOW")
  ) {
    return new THREE.MeshStandardMaterial({
      color: new THREE.Color("#0f2b48"),
      roughness: 0.08,
      metalness: 0.88,
      transparent: true,
      opacity: 0.92,
      name: "Maitri_Glass",
    });
  }

  // 5. Window Frames & Mullions
  if (
    meshName.includes("FRAME") ||
    meshName.includes("MULLION") ||
    matName.includes("WINDOW_FRAME")
  ) {
    return new THREE.MeshStandardMaterial({
      color: new THREE.Color("#1e293b"),
      roughness: 0.3,
      metalness: 0.7,
      name: "Window_Frame",
    });
  }

  // 6. Structural Steel Columns, Beams, Stilts, Stairs & Railings
  if (
    meshName.includes("STR") ||
    meshName.includes("STAIR") ||
    meshName.includes("BEAM") ||
    meshName.includes("COLUMN") ||
    meshName.includes("POST") ||
    meshName.includes("RAIL") ||
    matName.includes("STRUCTURAL_STEEL") ||
    matName.includes("GALVANIZED") ||
    matName.includes("DARK_STEEL")
  ) {
    return new THREE.MeshStandardMaterial({
      color: new THREE.Color("#3b4859"),
      roughness: 0.32,
      metalness: 0.82,
      name: "Structural_Steel",
    });
  }

  // 7. Expedition ISO Storage Containers
  if (meshName.includes("CAMP-CONTAINER") || matName.includes("CONTAINER")) {
    if (
      meshName.includes("01") ||
      meshName.includes("04") ||
      matName.includes("BLUE")
    ) {
      return new THREE.MeshStandardMaterial({
        color: new THREE.Color("#1d4ed8"),
        roughness: 0.45,
        metalness: 0.25,
        name: "Container_Blue",
      });
    }
    if (
      meshName.includes("02") ||
      meshName.includes("05") ||
      matName.includes("ORANGE")
    ) {
      return new THREE.MeshStandardMaterial({
        color: new THREE.Color("#c2410c"),
        roughness: 0.45,
        metalness: 0.25,
        name: "Container_Orange",
      });
    }
    if (
      meshName.includes("06") ||
      matName.includes("RED") ||
      matName.includes("EXPEDITION_RED")
    ) {
      return new THREE.MeshStandardMaterial({
        color: new THREE.Color("#b91c1c"),
        roughness: 0.45,
        metalness: 0.25,
        name: "Container_Red",
      });
    }
    return new THREE.MeshStandardMaterial({
      color: new THREE.Color("#e2e8f0"),
      roughness: 0.45,
      metalness: 0.25,
      name: "Container_White",
    });
  }

  // 8. Bulk Fuel Farm & Heated Pipelines
  if (meshName.includes("FUEL") || matName.includes("FUEL") || matName.includes("TANK")) {
    if (meshName.includes("TANK") || matName.includes("TANK")) {
      return new THREE.MeshStandardMaterial({
        color: new THREE.Color("#e2e8f0"),
        roughness: 0.32,
        metalness: 0.45,
        name: "Fuel_Tank",
      });
    }
    if (meshName.includes("PIPE") || matName.includes("PIPE")) {
      return new THREE.MeshStandardMaterial({
        color: new THREE.Color("#0f172a"),
        roughness: 0.28,
        metalness: 0.8,
        name: "Fuel_Pipe",
      });
    }
    return new THREE.MeshStandardMaterial({
      color: new THREE.Color("#475569"),
      roughness: 0.35,
      metalness: 0.7,
      name: "Fuel_Structure",
    });
  }

  // 9. Power & Generator Bay
  if (
    meshName.includes("GEN") ||
    meshName.includes("ENE") ||
    meshName.includes("PWR") ||
    meshName.includes("HVAC") ||
    matName.includes("GENERATOR") ||
    matName.includes("PWR")
  ) {
    if (meshName.includes("EXHAUST")) {
      return new THREE.MeshStandardMaterial({
        color: new THREE.Color("#64748b"),
        roughness: 0.25,
        metalness: 0.88,
        name: "Gen_Exhaust",
      });
    }
    return new THREE.MeshStandardMaterial({
      color: new THREE.Color("#334155"),
      roughness: 0.38,
      metalness: 0.55,
      name: "Power_Bay",
    });
  }

  // 10. ISRO Satcom Dish, Antenna Mast, Radar Dome
  if (
    meshName.includes("COM") ||
    meshName.includes("DISH") ||
    meshName.includes("MAST") ||
    meshName.includes("RADAR") ||
    matName.includes("DISH") ||
    matName.includes("RADAR")
  ) {
    if (meshName.includes("DISH") || matName.includes("DISH")) {
      return new THREE.MeshStandardMaterial({
        color: new THREE.Color("#f8fafc"),
        roughness: 0.18,
        metalness: 0.65,
        name: "Satcom_Dish",
      });
    }
    if (meshName.includes("RADAR") || matName.includes("RADAR")) {
      return new THREE.MeshStandardMaterial({
        color: new THREE.Color("#e0e7ff"),
        roughness: 0.5,
        metalness: 0.08,
        name: "Radar_Dome",
      });
    }
    return new THREE.MeshStandardMaterial({
      color: new THREE.Color("#475569"),
      roughness: 0.3,
      metalness: 0.82,
      name: "Comms_Mast",
    });
  }

  // 11. Antarctic Weather Sensors & Anemometers
  if (
    meshName.includes("WEATHER") ||
    meshName.includes("SENSOR") ||
    matName.includes("SAFETY_YELLOW") ||
    matName.includes("UTILITY_ORANGE")
  ) {
    return new THREE.MeshStandardMaterial({
      color: new THREE.Color("#eab308"),
      roughness: 0.38,
      metalness: 0.2,
      name: "Sensor_Amber",
    });
  }

  // 12. Frozen Lake & Glacial Ice
  if (
    meshName.includes("LAKE") ||
    meshName.includes("ICE") ||
    matName.includes("FROZEN_LAKE")
  ) {
    return new THREE.MeshStandardMaterial({
      color: new THREE.Color("#0284c7"),
      roughness: 0.15,
      metalness: 0.5,
      transparent: true,
      opacity: 0.95,
      name: "Glacial_Ice",
    });
  }

  // 13. Rocky Terrain & Schirmacher Oasis Boulders
  if (
    meshName.includes("BOULDER") ||
    meshName.includes("ROCK") ||
    meshName.includes("TERRAIN-HILL") ||
    matName.includes("ROCK") ||
    matName.includes("SCHIRMACHER")
  ) {
    const isDark = meshName.includes("01") || meshName.includes("03") || meshName.includes("07");
    return new THREE.MeshStandardMaterial({
      color: new THREE.Color(isDark ? "#2d3748" : "#4a5568"),
      roughness: 0.94,
      metalness: 0.02,
      name: "Oasis_Rock",
    });
  }

  // 14. Continuous Antarctic Snow & Drifts
  if (
    meshName.includes("SNOW") ||
    meshName.includes("TERRAIN") ||
    matName.includes("SNOW")
  ) {
    return new THREE.MeshStandardMaterial({
      color: new THREE.Color("#e6f1fc"),
      roughness: 0.85,
      metalness: 0.0,
      name: "Antarctic_Snow",
    });
  }

  // Default fallback
  if (
    mesh.material &&
    (mesh.material as THREE.MeshStandardMaterial).isMeshStandardMaterial
  ) {
    const orig = mesh.material as THREE.MeshStandardMaterial;
    orig.roughness = Math.max(0.25, orig.roughness);
    orig.metalness = Math.min(0.9, orig.metalness);
    return orig;
  }

  return new THREE.MeshStandardMaterial({
    color: new THREE.Color("#cbd5e1"),
    roughness: 0.4,
    metalness: 0.3,
  });
}

export function MaitriStation3D({
  connectivity,
  liveState,
  selectedComponent,
  onSelectComponent,
  className = "",
  height = "560px",
}: MaitriStation3DProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [loading, setLoading] = useState(true);
  const [loadProgress, setLoadProgress] = useState(0);
  const [renderMode, setRenderMode] = useState<RenderMode>("pbr");
  const [autoRotate, setAutoRotate] = useState(false);
  const [subsystemFilter, setSubsystemFilter] = useState<string>("all");
  const [showHotspots, setShowHotspots] = useState(true);
  const [screenHotspots, setScreenHotspots] = useState<
    { id: SubsystemId; x: number; y: number; visible: boolean }[]
  >([]);
  const [hoveredHotspot, setHoveredHotspot] = useState<SubsystemId | null>(null);
  const [activePopupId, setActivePopupId] = useState<SubsystemId | null>(null);
  const [isFullscreen, setIsFullscreen] = useState(false);

  // Three.js instances
  const sceneRef = useRef<THREE.Scene | null>(null);
  const cameraRef = useRef<THREE.PerspectiveCamera | null>(null);
  const rendererRef = useRef<THREE.WebGLRenderer | null>(null);
  const controlsRef = useRef<OrbitControls | null>(null);
  const modelGroupRef = useRef<THREE.Group | null>(null);
  const snowParticlesRef = useRef<THREE.Points | null>(null);
  const enhancedMaterialsRef = useRef<Map<THREE.Mesh, THREE.Material>>(new Map());
  const lightsGroupRef = useRef<THREE.Group | null>(null);
  const animationFrameRef = useRef<number | null>(null);
  const cameraTweenRef = useRef<{
    startPos: THREE.Vector3;
    endPos: THREE.Vector3;
    startTarget: THREE.Vector3;
    endTarget: THREE.Vector3;
    startTime: number;
    duration: number;
  } | null>(null);

  // Live telemetry data
  const temp = liveState?.environment.temperature_c ?? -18.6;
  const wind = liveState?.environment.wind_speed_knots ?? 19;
  const windDir = "ENE";
  const power = liveState?.energy.available_power_kw ?? 724;
  const fuel = liveState?.logistics.fuel_stock_percent ?? 68;
  const safeCapacity = liveState?.safe_operating_capacity.safe_capacity_percent ?? 78;
  const latencyMs = liveState?.connectivity.latency_ms ?? 42;

  // Hotspot tooltip text for domains that cite a live figure - computed here
  // (rather than baked into the static HOTSPOTS list) so it never drifts
  // from the real backend state shown elsewhere on this page.
  const liveHotspotSummary: Partial<Record<SubsystemId, string>> = {
    power: `Dual diesel generators A+B · ${power} kW total output capacity`,
    communication: `ISRO high-gain satellite uplink · ${latencyMs} ms latency nominal`,
    fuel: `4 bulk storage tanks + pipeline network · ${fuel}% stock`,
  };

  // Same status derivation used by the sidebar Asset Inspector (Home.tsx) -
  // reused here so the pin color, the in-canvas tooltip and the mesh glow
  // all agree with the panel on whether an asset is NORMAL/WARNING/CRITICAL.
  const hotspotStatus = (id: SubsystemId): AssetStatus =>
    buildAssetInspectorData({ assetKind: id, station: "Maitri", assetTag: "", assetType: "", twin: liveState, connectivity }).status;

  const selectedStatusColor = STATUS_COLOR[hotspotStatus(selectedComponent as SubsystemId)] ?? STATUS_COLOR.NORMAL;

  // Smooth camera transition helper
  const animateCameraTo = useCallback((pos: number[], target: number[], duration = 950) => {
    if (!cameraRef.current || !controlsRef.current) return;
    cameraTweenRef.current = {
      startPos: cameraRef.current.position.clone(),
      endPos: new THREE.Vector3(pos[0], pos[1], pos[2]),
      startTarget: controlsRef.current.target.clone(),
      endTarget: new THREE.Vector3(target[0], target[1], target[2]),
      startTime: performance.now(),
      duration,
    };
  }, []);

  // Preset camera selection handler
  const handlePresetChange = (presetName: string) => {
    setActivePopupId(null);
    setHoveredHotspot(null);
    const preset = CAMERA_PRESETS.find((p) => p.name === presetName);
    if (preset) {
      animateCameraTo(preset.pos, preset.target, 900);
    }
  };

  // Hotspot click handler
  const handleHotspotClick = (e: React.MouseEvent, id: SubsystemId) => {
    e.stopPropagation();
    setActivePopupId((prev) => (prev === id ? null : id));
    onSelectComponent(id);
    const hotspot = HOTSPOTS.find((h) => h.id === id);
    if (hotspot && cameraRef.current && controlsRef.current) {
      const offset = new THREE.Vector3(18, 12, 20);
      const targetPos = hotspot.worldPos.clone().add(offset);
      animateCameraTo(
        [targetPos.x, targetPos.y, targetPos.z],
        [hotspot.worldPos.x, hotspot.worldPos.y, hotspot.worldPos.z],
        900
      );
    }
  };

  // Close popup when clicking outside anywhere in the 3D viewport
  const handleDismissPopup = () => {
    if (activePopupId !== null) {
      setActivePopupId(null);
    }
    if (hoveredHotspot !== null) {
      setHoveredHotspot(null);
    }
  };

  // ESC clears the active asset popup, matching an empty-space click
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") handleDismissPopup();
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [activePopupId, hoveredHotspot]);

  // Highlight selected subsystem in 3D model
  useEffect(() => {
    if (!modelGroupRef.current || renderMode !== "pbr") return;

    modelGroupRef.current.traverse((child) => {
      if ((child as THREE.Mesh).isMesh) {
        const mesh = child as THREE.Mesh;
        const mat = mesh.material as THREE.MeshStandardMaterial;
        if (!mat || !mat.isMeshStandardMaterial) return;

        const name = (mesh.name || "").toUpperCase();
        let isMatch = false;

        if (selectedComponent === "building" && (name.includes("BLD") || name.includes("MAITRI") || name.includes("WIN") || name.includes("FACADE"))) {
          isMatch = true;
        } else if (selectedComponent === "power" && (name.includes("GEN") || name.includes("ENE") || name.includes("PWR") || name.includes("HVAC"))) {
          isMatch = true;
        } else if (selectedComponent === "fuel" && (name.includes("FUEL") || name.includes("TANK") || name.includes("PIPE"))) {
          isMatch = true;
        } else if (selectedComponent === "communication" && (name.includes("COM") || name.includes("DISH") || name.includes("MAST") || name.includes("RADAR"))) {
          isMatch = true;
        } else if (selectedComponent === "logistics" && (name.includes("CONTAINER") || name.includes("CAMP") || name.includes("LOG"))) {
          isMatch = true;
        } else if (selectedComponent === "environment" && (name.includes("WEATHER") || name.includes("ENV") || name.includes("LAKE"))) {
          isMatch = true;
        }

        if (isMatch) {
          // Status-colored so the exact same asset glows green/amber/red in
          // the 3D scene depending on its real operational status, rather
          // than a fixed decorative color regardless of what's happening.
          mat.emissive = new THREE.Color(selectedStatusColor);
          mat.emissiveIntensity = 0.32;
        } else {
          mat.emissive = new THREE.Color("#000000");
          mat.emissiveIntensity = 0;
        }
      }
    });
  }, [selectedComponent, renderMode, selectedStatusColor]);

  // Switch shading materials according to render mode
  useEffect(() => {
    if (!modelGroupRef.current || !sceneRef.current) return;

    modelGroupRef.current.traverse((child) => {
      if ((child as THREE.Mesh).isMesh) {
        const mesh = child as THREE.Mesh;
        const enhanced = enhancedMaterialsRef.current.get(mesh);
        if (!enhanced) return;

        if (renderMode === "pbr") {
          mesh.material = enhanced;
        } else if (renderMode === "hologram") {
          mesh.material = new THREE.MeshStandardMaterial({
            color: new THREE.Color("#00eeff"),
            wireframe: true,
            transparent: true,
            opacity: 0.45,
            emissive: new THREE.Color("#005577"),
            emissiveIntensity: 0.4,
          });
        } else if (renderMode === "thermal") {
          const name = mesh.name.toUpperCase();
          let thermalColor = "#1a3d6d";
          if (name.includes("BLD") || name.includes("MAITRI")) thermalColor = "#ff7700";
          else if (name.includes("GEN") || name.includes("ENE") || name.includes("PWR")) thermalColor = "#ff2200";
          else if (name.includes("FUEL") || name.includes("TANK")) thermalColor = "#38bdf8";
          else if (name.includes("COM") || name.includes("DISH") || name.includes("RADAR")) thermalColor = "#facc15";
          else if (name.includes("CONTAINER") || name.includes("CAMP")) thermalColor = "#ea580c";

          mesh.material = new THREE.MeshStandardMaterial({
            color: new THREE.Color(thermalColor),
            roughness: 0.6,
            metalness: 0.1,
            emissive: new THREE.Color(thermalColor),
            emissiveIntensity: 0.35,
          });
        } else if (renderMode === "night") {
          mesh.material = enhanced;
        }
      }
    });

    if (sceneRef.current && lightsGroupRef.current) {
      if (renderMode === "hologram") {
        sceneRef.current.background = new THREE.Color("#030c17");
      } else if (renderMode === "night") {
        sceneRef.current.background = new THREE.Color("#030712");
      } else if (renderMode === "thermal") {
        sceneRef.current.background = new THREE.Color("#050811");
      } else {
        sceneRef.current.background = new THREE.Color("#091726");
      }
    }
  }, [renderMode]);

  // Subsystem filter visibility handler
  useEffect(() => {
    if (!modelGroupRef.current) return;
    modelGroupRef.current.traverse((child) => {
      if ((child as THREE.Mesh).isMesh) {
        const name = child.name.toUpperCase();
        if (subsystemFilter === "all") {
          child.visible = true;
        } else if (subsystemFilter === "building") {
          child.visible =
            name.includes("BLD") ||
            name.includes("MAITRI") ||
            name.includes("WIN") ||
            name.includes("STR") ||
            name.includes("FACADE") ||
            name.includes("ROOF");
        } else if (subsystemFilter === "power") {
          child.visible =
            name.includes("GEN") ||
            name.includes("ENE") ||
            name.includes("PWR") ||
            name.includes("HVAC");
        } else if (subsystemFilter === "fuel") {
          child.visible =
            name.includes("FUEL") ||
            name.includes("TANK") ||
            name.includes("PIPE");
        } else if (subsystemFilter === "logistics") {
          child.visible =
            name.includes("LOG") ||
            name.includes("CONTAINER") ||
            name.includes("CAMP");
        } else if (subsystemFilter === "communication") {
          child.visible =
            name.includes("COM") ||
            name.includes("DISH") ||
            name.includes("MAST") ||
            name.includes("RADAR");
        } else if (subsystemFilter === "terrain") {
          child.visible =
            name.includes("TERRAIN") ||
            name.includes("SNOW") ||
            name.includes("ROCK") ||
            name.includes("BOULDER") ||
            name.includes("LAKE");
        }
      }
    });
  }, [subsystemFilter]);

  // Initialize Three.js WebGL Scene
  useEffect(() => {
    const canvas = canvasRef.current;
    const container = containerRef.current;
    if (!canvas || !container) return;

    const width = container.clientWidth;
    const height = container.clientHeight;

    // 1. Scene
    const scene = new THREE.Scene();
    scene.background = new THREE.Color("#091726");
    sceneRef.current = scene;

    // 2. Camera
    const camera = new THREE.PerspectiveCamera(40, width / height, 0.5, 1000);
    camera.position.set(34, 24, 38);
    cameraRef.current = camera;

    // 3. Renderer
    const renderer = new THREE.WebGLRenderer({
      canvas,
      antialias: true,
      powerPreference: "high-performance",
    });
    renderer.setSize(width, height);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.shadowMap.enabled = true;
    // PCFSoftShadowMap was deprecated in three.js r186 (silently substituted
    // with a console warning); VSMShadowMap is the modern soft-shadow type.
    renderer.shadowMap.type = THREE.VSMShadowMap;
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.15;
    rendererRef.current = renderer;

    // 4. OrbitControls
    const controls = new OrbitControls(camera, renderer.domElement);
    controls.enableDamping = true;
    controls.dampingFactor = 0.05;
    controls.minDistance = 4;
    controls.maxDistance = 150;
    controls.maxPolarAngle = Math.PI / 2 - 0.04;
    controls.target.set(0, 5.5, 0);
    controlsRef.current = controls;

    // Dismiss popup on camera manipulation
    controls.addEventListener("start", () => {
      setActivePopupId(null);
    });

    // 5. Lighting Setup
    const lightsGroup = new THREE.Group();
    lightsGroupRef.current = lightsGroup;

    // Directional Sunlight (Bright Crisp Polar Sun)
    const sunLight = new THREE.DirectionalLight(0xfff8ea, 1.45);
    sunLight.position.set(45, 40, 30);
    sunLight.castShadow = true;
    sunLight.shadow.mapSize.width = 2048;
    sunLight.shadow.mapSize.height = 2048;
    sunLight.shadow.camera.near = 5;
    sunLight.shadow.camera.far = 160;
    sunLight.shadow.camera.left = -50;
    sunLight.shadow.camera.right = 50;
    sunLight.shadow.camera.top = 50;
    sunLight.shadow.camera.bottom = -50;
    sunLight.shadow.bias = -0.0003;
    lightsGroup.add(sunLight);

    // Sky & Snow Radiance
    const hemiLight = new THREE.HemisphereLight(0x90cbff, 0x142838, 0.85);
    lightsGroup.add(hemiLight);

    // Fill Light
    const fillLight = new THREE.DirectionalLight(0x50b5ff, 0.55);
    fillLight.position.set(-35, 22, -35);
    lightsGroup.add(fillLight);

    // Facility accent light
    const stationAccentLight = new THREE.PointLight(0xffecd1, 1.0, 70);
    stationAccentLight.position.set(0, 15, 8);
    lightsGroup.add(stationAccentLight);

    scene.add(lightsGroup);

    // 6. Grid Ground Reference
    const gridHelper = new THREE.GridHelper(140, 48, 0x1a4f66, 0x071b29);
    gridHelper.position.y = -0.05;
    scene.add(gridHelper);

    // 7. Dynamic Antarctic Snowfall Particle System
    const snowCount = 1200;
    const snowGeo = new THREE.BufferGeometry();
    const snowPositions = new Float32Array(snowCount * 3);
    const snowVelocities = new Float32Array(snowCount * 3);

    for (let i = 0; i < snowCount; i++) {
      snowPositions[i * 3] = (Math.random() - 0.5) * 120;
      snowPositions[i * 3 + 1] = Math.random() * 45;
      snowPositions[i * 3 + 2] = (Math.random() - 0.5) * 120;

      snowVelocities[i * 3] = (Math.random() - 0.5) * 0.12;
      snowVelocities[i * 3 + 1] = -(0.06 + Math.random() * 0.1);
      snowVelocities[i * 3 + 2] = (Math.random() - 0.5) * 0.12;
    }

    snowGeo.setAttribute("position", new THREE.BufferAttribute(snowPositions, 3));
    const snowMat = new THREE.PointsMaterial({
      color: 0xe0f2fe,
      size: 0.28,
      transparent: true,
      opacity: 0.65,
      blending: THREE.AdditiveBlending,
    });
    const snowParticles = new THREE.Points(snowGeo, snowMat);
    scene.add(snowParticles);
    snowParticlesRef.current = snowParticles;

    // 8. Load the Maitri station model
    const loader = new GLTFLoader();

    loader.load(
      "/assets/maitri-station.glb",
      (gltf) => {
        const model = gltf.scene;
        modelGroupRef.current = model;

        model.traverse((child) => {
          if ((child as THREE.Mesh).isMesh) {
            const mesh = child as THREE.Mesh;
            mesh.castShadow = true;
            mesh.receiveShadow = true;

            const pbrMat = enhanceMeshMaterial(mesh);
            mesh.material = pbrMat;
            enhancedMaterialsRef.current.set(mesh, pbrMat);
          }
        });

        scene.add(model);
        setLoading(false);
      },
      (xhr) => {
        if (xhr.total > 0) {
          setLoadProgress(Math.round((xhr.loaded / xhr.total) * 100));
        }
      },
      (error) => {
        console.error("Error loading Maitri GLB model:", error);
        setLoading(false);
      }
    );

    // 9. Resize Observer
    const handleResize = () => {
      if (!container || !camera || !renderer) return;
      const w = container.clientWidth;
      const h = container.clientHeight;
      camera.aspect = w / h;
      camera.updateProjectionMatrix();
      renderer.setSize(w, h);
    };

    window.addEventListener("resize", handleResize);

    // 10. Animation Loop
    let lastTime = performance.now();

    const animate = (currentTime: number) => {
      animationFrameRef.current = requestAnimationFrame(animate);
      const delta = (currentTime - lastTime) / 1000;
      lastTime = currentTime;

      // Camera tweening
      if (cameraTweenRef.current) {
        const tween = cameraTweenRef.current;
        const progress = Math.min(1, (currentTime - tween.startTime) / tween.duration);
        const ease = 0.5 - Math.cos(progress * Math.PI) / 2;

        camera.position.lerpVectors(tween.startPos, tween.endPos, ease);
        controls.target.lerpVectors(tween.startTarget, tween.endTarget, ease);

        if (progress >= 1) {
          cameraTweenRef.current = null;
        }
      }

      // Auto-rotation
      if (autoRotate && !cameraTweenRef.current) {
        controls.autoRotate = true;
        controls.autoRotateSpeed = 0.75;
      } else {
        controls.autoRotate = false;
      }

      controls.update();

      // Update Snow Particles based on wind
      if (snowParticlesRef.current) {
        const posAttr = snowParticlesRef.current.geometry.attributes.position as THREE.BufferAttribute;
        const posArray = posAttr.array as Float32Array;
        const windDrift = (wind / 30) * 0.15;

        for (let i = 0; i < snowCount; i++) {
          posArray[i * 3] += windDrift + (Math.random() - 0.48) * 0.05;
          posArray[i * 3 + 1] += snowVelocities[i * 3 + 1];
          posArray[i * 3 + 2] += (Math.random() - 0.5) * 0.05;

          if (posArray[i * 3 + 1] < 0) {
            posArray[i * 3 + 1] = 45;
            posArray[i * 3] = (Math.random() - 0.5) * 120;
            posArray[i * 3 + 2] = (Math.random() - 0.5) * 120;
          }
          if (Math.abs(posArray[i * 3]) > 65) posArray[i * 3] *= -0.9;
          if (Math.abs(posArray[i * 3 + 2]) > 65) posArray[i * 3 + 2] *= -0.9;
        }
        posAttr.needsUpdate = true;
      }

      // Project 3D Hotspots to 2D Screen Space
      const hotspotProjections = HOTSPOTS.map((h) => {
        const tempVec = h.worldPos.clone();
        tempVec.project(camera);

        const isBehind = tempVec.z > 1;
        const screenX = ((tempVec.x + 1) / 2) * width;
        const screenY = ((-tempVec.y + 1) / 2) * height;

        return {
          id: h.id,
          x: screenX,
          y: screenY,
          visible: !isBehind && screenX >= 0 && screenX <= width && screenY >= 0 && screenY <= height,
        };
      });

      setScreenHotspots(hotspotProjections);

      renderer.render(scene, camera);
    };

    animationFrameRef.current = requestAnimationFrame(animate);

    return () => {
      window.removeEventListener("resize", handleResize);
      if (animationFrameRef.current) cancelAnimationFrame(animationFrameRef.current);
      renderer.dispose();
    };
  }, []);

  return (
    <div
      ref={containerRef}
      onClick={handleDismissPopup}
      className={`relative w-full overflow-hidden rounded-xl border border-cyan-900/40 bg-[#071724] select-none ${
        isFullscreen ? "fixed inset-0 z-50 rounded-none" : ""
      } ${className}`}
      style={{ height: isFullscreen ? "100vh" : height }}
    >
      {/* 3D WebGL Canvas */}
      <canvas
        ref={canvasRef}
        onPointerDown={handleDismissPopup}
        className="w-full h-full block cursor-grab active:cursor-grabbing"
      />

      {/* Loading Overlay */}
      {loading && (
        <div className="absolute inset-0 z-20 flex flex-col items-center justify-center bg-[#071724]/90 backdrop-blur-md">
          <div className="relative flex items-center justify-center mb-4">
            <div className="w-16 h-16 rounded-full border-2 border-cyan-500/20 border-t-cyan-400 animate-spin" />
            <Layers3 className="absolute text-cyan-400" size={24} />
          </div>
          <b className="text-cyan-200 text-sm tracking-wider font-mono">
            INITIALIZING DIGITAL TWIN 3D ENGINE
          </b>
          <span className="text-cyan-400 text-xs font-mono mt-1 font-semibold">
            Loading Maitri High-Detail Station Geometry · {loadProgress}%
          </span>
          <div className="w-48 h-1.5 bg-slate-900 rounded-full mt-3 overflow-hidden border border-cyan-900/60">
            <div
              className="h-full bg-cyan-400 transition-all duration-200 shadow-sm shadow-cyan-400"
              style={{ width: `${loadProgress}%` }}
            />
          </div>
        </div>
      )}

      {/* Top Deck: Station Badge & Command Toolbar */}
      <div
        className="absolute top-3 inset-x-3 z-10 flex flex-wrap items-center justify-between gap-2 pointer-events-none"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Left: Station Identity Badge */}
        <div className="badge badge-neutral text-xs py-2 px-3 gap-2 pointer-events-auto shrink-0 shadow-md">
          <span className="w-2 h-2 rounded-full bg-sky-400 animate-pulse" />
          <span className="font-bold text-white tracking-wide font-sans">Maitri Research Station</span>
          <span className="badge badge-warning text-[10px] font-mono font-bold">Queen Maud Land</span>
        </div>

        {/* Right: Command Toolbar */}
        <div className="deck-card flex items-center gap-1.5 p-1.5 pointer-events-auto shrink-0">
          {/* Camera Preset Selector */}
          <div className="flex items-center gap-1 pl-1">
            <Camera size={13} className="text-sky-400" />
            <select
              onChange={(e) => handlePresetChange(e.target.value)}
              className="select select-sm max-w-[130px]"
              defaultValue="Overview"
            >
              {CAMERA_PRESETS.map((p) => (
                <option key={p.name} value={p.name}>
                  {p.name} View
                </option>
              ))}
            </select>
          </div>

          <div className="w-px h-4 bg-slate-700/80 my-auto" />

          {/* Shading Mode Selector */}
          <div className="flex items-center gap-1">
            <Sun size={13} className="text-sky-400" />
            <select
              value={renderMode}
              onChange={(e) => setRenderMode(e.target.value as RenderMode)}
              className="select select-sm"
            >
              <option value="pbr">Realistic PBR</option>
              <option value="hologram">Hologram</option>
              <option value="thermal">Thermal IR</option>
              <option value="night">Polar Night</option>
            </select>
          </div>

          <div className="w-px h-4 bg-slate-700/80 my-auto" />

          {/* Hotspot Pins Toggle */}
          <button
            onClick={() => setShowHotspots(!showHotspots)}
            className={`btn btn-sm ${showHotspots ? "btn-info" : "btn-neutral"}`}
            title={showHotspots ? "Hide 3D Hotspot Pins" : "Show 3D Hotspot Pins"}
          >
            <Eye size={13} />
            <span>Pins</span>
          </button>

          {/* 360 Tour Button */}
          <button
            onClick={() => setAutoRotate(!autoRotate)}
            className={`btn btn-sm ${autoRotate ? "btn-warning" : "btn-neutral"}`}
            title="Toggle 360° Station Tour"
          >
            <RotateCw size={13} className={autoRotate ? "animate-spin" : ""} />
            <span className="hidden sm:inline">Tour</span>
          </button>

          {/* Reset Camera View */}
          <button
            onClick={() => {
              setActivePopupId(null);
              setHoveredHotspot(null);
              animateCameraTo([34, 24, 38], [0, 5.5, 0]);
            }}
            className="btn btn-sm btn-ghost px-2"
            title="Reset Camera View"
          >
            <RotateCcw size={13} />
          </button>

          {/* Fullscreen Toggle */}
          <button
            onClick={() => setIsFullscreen(!isFullscreen)}
            className="btn btn-sm btn-ghost px-2"
            title="Toggle Fullscreen"
          >
            {isFullscreen ? <Minimize2 size={13} /> : <Maximize2 size={13} />}
          </button>
        </div>
      </div>

      {/* Screen-Space 3D Hotspots Pins */}
      {showHotspots &&
        screenHotspots.map((h) => {
          if (!h.visible) return null;
          const hotspot = HOTSPOTS.find((item) => item.id === h.id);
          if (!hotspot) return null;
          const isDomainSelected = selectedComponent === h.id;
          const isHovered = hoveredHotspot === h.id;
          const isPopupActive = activePopupId === h.id;
          const isCardVisible = isPopupActive || isHovered;
          const Icon = hotspot.icon;
          const status = hotspotStatus(h.id);
          const statusBtnClass = status === "NORMAL" ? "btn-success" : status === "WARNING" ? "btn-warning" : "btn-error";

          return (
            <div
              key={h.id}
              style={{
                position: "absolute",
                left: `${h.x}px`,
                top: `${h.y}px`,
                transform: "translate(-50%, -50%)",
                zIndex: isCardVisible ? 30 : isDomainSelected ? 20 : 15,
              }}
              className="pointer-events-auto"
              onClick={(e) => e.stopPropagation()}
              onMouseEnter={() => setHoveredHotspot(h.id)}
              onMouseLeave={() => setHoveredHotspot(null)}
            >
              {/* Hotspot Pin Button */}
              <button
                onClick={(e) => handleHotspotClick(e, h.id)}
                className={`btn btn-xs transition-all duration-200 cursor-pointer shadow-lg ${
                  isDomainSelected || isPopupActive
                    ? `${statusBtnClass} scale-105`
                    : isHovered
                    ? "btn-info scale-105"
                    : "btn-neutral border-slate-600 opacity-90 hover:opacity-100"
                }`}
              >
                <Icon size={12} />
                <span>{hotspot.label}</span>
              </button>

              {/* Tooltip Card (Only displays on hover or when explicitly tapped) */}
              {isCardVisible && (
                <div
                  className="absolute top-8 left-1/2 -translate-x-1/2 w-72 p-4 rounded-xl deck-card pointer-events-auto transition-all animate-in fade-in zoom-in-95 duration-150 shadow-2xl"
                  onClick={(e) => e.stopPropagation()}
                >
                  <div className="flex items-center justify-between border-b border-slate-800 pb-2 mb-2">
                    <div className="flex items-center gap-1.5">
                      <span className="badge badge-primary font-mono font-bold">{hotspot.tag}</span>
                      <span className="badge badge-warning font-mono font-bold">{hotspot.domain}</span>
                    </div>
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        setActivePopupId(null);
                        setHoveredHotspot(null);
                      }}
                      className="btn btn-xs btn-ghost p-1"
                      title="Close popup"
                    >
                      <X size={14} />
                    </button>
                  </div>
                  <div className="flex items-center gap-1.5 mb-1.5">
                    <span
                      className="inline-block w-1.5 h-1.5 rounded-full animate-pulse"
                      style={{ backgroundColor: STATUS_COLOR[status], boxShadow: `0 0 6px ${STATUS_COLOR[status]}` }}
                    />
                    <span className="text-[10px] font-mono font-bold tracking-wider" style={{ color: STATUS_COLOR[status] }}>
                      {status}
                    </span>
                  </div>
                  <h4 className="text-sm font-bold text-white tracking-wide">{hotspot.title}</h4>
                  <p className="text-xs text-slate-300 leading-relaxed mt-1.5">{liveHotspotSummary[hotspot.id] ?? hotspot.summary}</p>
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      onSelectComponent(hotspot.id);
                    }}
                    className="btn btn-sm btn-primary w-full mt-3 justify-between font-bold"
                  >
                    <span>Select {hotspot.domain} Domain</span>
                    <ArrowUpRight size={14} />
                  </button>
                </div>
              )}
            </div>
          );
        })}

      {/* Bottom Integrated Deck (Telemetry + Domain Tabs + Link Status in ONE non-colliding row) */}
      <div
        className="absolute bottom-3 inset-x-3 z-10 flex flex-wrap items-center justify-between gap-2 p-1.5 deck-card pointer-events-auto"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Left: Telemetry Readings */}
        <div className="flex items-center gap-2.5 text-xs font-mono pl-1.5">
          <div className="flex items-center gap-1 text-slate-300 font-semibold">
            <ThermometerSnowflake size={13} className="text-sky-400" />
            <span className="text-white font-bold">{temp}°C</span>
          </div>
          <span className="text-slate-700 font-sans">|</span>
          <div className="flex items-center gap-1 text-slate-300 font-semibold">
            <Wind size={13} className="text-sky-400" />
            <span className="text-white font-bold">{wind} kt</span>
          </div>
          <span className="text-slate-700 font-sans">|</span>
          <div className="flex items-center gap-1 text-slate-300 font-semibold">
            <Bolt size={13} className="text-amber-400" />
            <span className="text-white font-bold">{power} kW</span>
          </div>
          <span className="text-slate-700 font-sans">|</span>
          <div className="flex items-center gap-1 text-slate-300 font-semibold">
            <Fuel size={13} className="text-violet-400" />
            <span className="text-white font-bold">{fuel}%</span>
          </div>
        </div>

        {/* Center: Domain Layer Tabs */}
        <div className="flex items-center gap-1 overflow-x-auto">
          {[
            { id: "all", label: "All Domains", icon: Layers3 },
            { id: "building", label: "Buildings", icon: Building2 },
            { id: "power", label: "Power", icon: Bolt },
            { id: "fuel", label: "Fuel", icon: Fuel },
            { id: "communication", label: "Comms", icon: Radio },
            { id: "logistics", label: "Stores", icon: Truck },
            { id: "terrain", label: "Terrain", icon: CloudSnow },
          ].map((tab) => {
            const Icon = tab.icon;
            const active = subsystemFilter === tab.id;
            return (
              <button
                key={tab.id}
                onClick={() => setSubsystemFilter(tab.id)}
                className={`btn btn-xs ${active ? "btn-primary" : "btn-neutral"}`}
              >
                <Icon size={12} />
                <span>{tab.label}</span>
              </button>
            );
          })}
        </div>

        {/* Right: Operational Status */}
        <div className="flex items-center gap-2 pr-1">
          <span className={`badge ${connectivity === "CONNECTED" ? "badge-success" : connectivity === "DEGRADED" ? "badge-warning" : "badge-error"}`}>
            <span className="w-1.5 h-1.5 rounded-full bg-current animate-pulse mr-1" />
            {connectivity === "CONNECTED" ? "HQ SUPERVISION" : connectivity === "DEGRADED" ? "LOCAL ASSISTED" : "AUTONOMOUS"}
          </span>
        </div>
      </div>
    </div>
  );
}
