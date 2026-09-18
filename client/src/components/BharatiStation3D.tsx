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

export type SubsystemId =
  | "building"
  | "power"
  | "communication"
  | "fuel"
  | "logistics"
  | "environment"
  | "support";

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
  isPrimary?: boolean;
}

interface BharatiStation3DProps {
  connectivity: ConnectivityState;
  liveState?: DigitalTwinState;
  selectedComponent: string;
  onSelectComponent: (id: string) => void;
  className?: string;
  height?: string | number;
}

// Subsystem hotspot markers matching Maitri's styling & calibrated coordinates
const HOTSPOTS: HotspotData[] = [
  {
    id: "building",
    label: "MAIN FACILITY",
    tag: "BLD-BH01",
    worldPos: new THREE.Vector3(0, 14.0, 0),
    icon: Building2,
    title: "Bharati Main Facility",
    summary: "Elevated aerodynamic modular complex on steel pilings · Indian tricolor insignia & command bridge",
    domain: "INFRASTRUCTURE",
    isPrimary: true,
  },
  {
    id: "communication",
    label: "ISRO SATCOM & DISH",
    tag: "COM-BH01",
    worldPos: new THREE.Vector3(4.0, 22.5, 5.0),
    icon: Radio,
    title: "ISRO Ground Station & Satcom Mast",
    summary: "Roof-mounted parabolic antenna & telemetry tracking mast · 58 ms latency nominal",
    domain: "COMMUNICATION",
  },
  {
    id: "power",
    label: "POWER & GENERATORS",
    tag: "ENE-BH01",
    worldPos: new THREE.Vector3(33.0, 7.0, 10.0),
    icon: Bolt,
    title: "Combined Heat & Power Bay",
    summary: "Dual diesel generator plant · 648 kW available capacity · Critical load 388 kW",
    domain: "ENERGY",
  },
  {
    id: "fuel",
    label: "BULK FUEL FARM",
    tag: "FUEL-BH01",
    worldPos: new THREE.Vector3(38.0, 6.0, -12.0),
    icon: Fuel,
    title: "Bulk Arctic Diesel Farm",
    summary: "3 insulated bulk fuel tanks with pipeline conduits & safety barriers · 74% stock (23 days runway)",
    domain: "LOGISTICS",
  },
  {
    id: "logistics",
    label: "EXPEDITION STORES",
    tag: "LOG-BH01",
    worldPos: new THREE.Vector3(14.0, 4.0, -28.0),
    icon: Truck,
    title: "Expedition Cargo & Storage",
    summary: "Heavy-duty ISO logistics containers & handling pad for polar field equipment",
    domain: "LOGISTICS",
  },
  {
    id: "environment",
    label: "WEATHER MAST & OASIS",
    tag: "ENV-BH01",
    worldPos: new THREE.Vector3(-35.0, 9.0, 25.0),
    icon: CloudSnow,
    title: "NCPOR 24m Meteorological Tower",
    summary: "Ultrasonic anemometer, pressure barometer & solar radiation ground sensors",
    domain: "ENVIRONMENT",
  },
  {
    id: "support",
    label: "SEAWATER PUMP & AUX",
    tag: "SUP-BH01",
    worldPos: new THREE.Vector3(-31.0, 5.0, -23.0),
    icon: ShieldCheck,
    title: "Seawater Pump & Auxiliary Modules",
    summary: "Heated seawater intake pump station & expedition field modules",
    domain: "INFRASTRUCTURE",
  },
];

// Presets calibrated for the signature panoramic front angle matching Maitri
const CAMERA_PRESETS = [
  { name: "Overview View", pos: [48, 32, -72], target: [0, 6, -5] },
  { name: "Main Facility", pos: [20, 16, -38], target: [-4, 8, -12] },
  { name: "ISRO Satcom & Dish", pos: [14, 30, -18], target: [4, 21, 5] },
  { name: "Power & Generators", pos: [58, 20, 18], target: [33, 5, 10] },
  { name: "Bulk Fuel Farm", pos: [62, 18, -32], target: [38, 4, -12] },
  { name: "Expedition Stores", pos: [32, 16, -52], target: [14, 2, -28] },
  { name: "Weather Mast & Oasis", pos: [-55, 22, 42], target: [-35, 7, 25] },
  { name: "Top-Down View", pos: [0, 120, 0.1], target: [0, 5, 0] },
];

/**
 * Creates rich PBR material configuration matching the bright, crisp Maitri aesthetic
 */
function enhanceBharatiMeshMaterial(mesh: THREE.Mesh): THREE.Material {
  const meshName = (mesh.name || "").toUpperCase();
  const matName = (
    Array.isArray(mesh.material)
      ? mesh.material[0]?.name || ""
      : mesh.material?.name || ""
  ).toUpperCase();

  // 1. Indian Tricolor (Saffron, White, Green)
  if (
    matName.includes("SAFFRON") ||
    meshName.includes("SAFFRON") ||
    matName.includes("TRICOLOR_SAFFRON")
  ) {
    return new THREE.MeshStandardMaterial({
      color: new THREE.Color("#ff671f"),
      roughness: 0.4,
      metalness: 0.05,
      side: THREE.DoubleSide,
      name: "Tricolor_Saffron",
    });
  }
  if (
    matName.includes("GREEN") ||
    meshName.includes("GREEN") ||
    matName.includes("TRICOLOR_GREEN")
  ) {
    return new THREE.MeshStandardMaterial({
      color: new THREE.Color("#046a38"),
      roughness: 0.4,
      metalness: 0.05,
      side: THREE.DoubleSide,
      name: "Tricolor_Green",
    });
  }
  if (
    matName.includes("FLAG_WHITE") ||
    matName.includes("TRICOLOR_WHITE") ||
    (meshName.includes("FLAG") && meshName.includes("WHITE"))
  ) {
    return new THREE.MeshStandardMaterial({
      color: new THREE.Color("#f8fafc"),
      roughness: 0.45,
      metalness: 0.05,
      side: THREE.DoubleSide,
      name: "Tricolor_White",
    });
  }

  // 2. Main Station Facade & Shell (Bright crisp silver-panel like Maitri)
  if (
    meshName.includes("BHARATI_LETTER") ||
    meshName.includes("SHELL") ||
    meshName.includes("BUILDING") ||
    meshName.includes("FACADE") ||
    matName.includes("MAITRI_PANEL") ||
    matName.includes("BHARATI_FACADE") ||
    matName.includes("PANEL")
  ) {
    return new THREE.MeshStandardMaterial({
      color: new THREE.Color("#dbe4ee"),
      roughness: 0.32,
      metalness: 0.10,
      side: THREE.DoubleSide,
      name: "Bharati_Panel",
    });
  }

  // 3. Dark Roofs
  if (
    meshName.includes("ROOF") ||
    matName.includes("ROOF") ||
    matName.includes("DARK_ROOF")
  ) {
    return new THREE.MeshStandardMaterial({
      color: new THREE.Color("#1e293b"),
      roughness: 0.35,
      metalness: 0.6,
      side: THREE.DoubleSide,
      name: "Bharati_Roof",
    });
  }

  // 4. Windows & Tinted Glass
  if (
    meshName.includes("WINDOW") ||
    meshName.includes("GLASS") ||
    matName.includes("WINDOW") ||
    matName.includes("GLASS")
  ) {
    return new THREE.MeshStandardMaterial({
      color: new THREE.Color("#0f2b48"),
      roughness: 0.08,
      metalness: 0.88,
      transparent: true,
      opacity: 0.92,
      side: THREE.DoubleSide,
      emissive: new THREE.Color("#0c243d"),
      emissiveIntensity: 0.6,
      name: "Bharati_Glass",
    });
  }

  // 5. Structural Steel Columns, Beams, Stilts, Stairs & Railings
  if (
    meshName.includes("STILT") ||
    meshName.includes("STR") ||
    meshName.includes("COLUMN") ||
    meshName.includes("TRUSS") ||
    meshName.includes("RAIL") ||
    meshName.includes("POST") ||
    meshName.includes("STAIR") ||
    meshName.includes("PLATFORM") ||
    meshName.includes("STEP") ||
    matName.includes("STEEL")
  ) {
    return new THREE.MeshStandardMaterial({
      color: new THREE.Color("#3b4859"),
      roughness: 0.32,
      metalness: 0.82,
      side: THREE.DoubleSide,
      name: "Structural_Steel",
    });
  }

  // 6. Expedition ISO Storage Containers (Vibrant blue, orange, red, white)
  if (
    meshName.includes("CARGO_CONTAINER_1") ||
    meshName.includes("CONTAINER_1") ||
    matName.includes("CONTAINER_BLUE")
  ) {
    return new THREE.MeshStandardMaterial({
      color: new THREE.Color("#1d4ed8"),
      roughness: 0.45,
      metalness: 0.25,
      side: THREE.DoubleSide,
      name: "Container_Blue",
    });
  }
  if (
    meshName.includes("CARGO_CONTAINER_2") ||
    meshName.includes("CONTAINER_2") ||
    matName.includes("CONTAINER_ORANGE")
  ) {
    return new THREE.MeshStandardMaterial({
      color: new THREE.Color("#c2410c"),
      roughness: 0.45,
      metalness: 0.25,
      side: THREE.DoubleSide,
      name: "Container_Orange",
    });
  }
  if (
    meshName.includes("CARGO_CONTAINER_3") ||
    meshName.includes("CONTAINER_3") ||
    matName.includes("CONTAINER_RED")
  ) {
    return new THREE.MeshStandardMaterial({
      color: new THREE.Color("#b91c1c"),
      roughness: 0.45,
      metalness: 0.25,
      side: THREE.DoubleSide,
      name: "Container_Red",
    });
  }

  // 7. Bulk Fuel Farm & Heated Pipelines
  if (
    meshName.includes("FUEL_TANK") ||
    (meshName.includes("FUEL") && meshName.includes("TANK")) ||
    matName.includes("FUEL_TANK")
  ) {
    return new THREE.MeshStandardMaterial({
      color: new THREE.Color("#e2e8f0"),
      roughness: 0.32,
      metalness: 0.45,
      side: THREE.DoubleSide,
      name: "Fuel_Tank",
    });
  }
  if (
    meshName.includes("FUEL_PIPE") ||
    meshName.includes("PIPE") ||
    matName.includes("FUEL_PIPE")
  ) {
    return new THREE.MeshStandardMaterial({
      color: new THREE.Color("#0f172a"),
      roughness: 0.28,
      metalness: 0.8,
      side: THREE.DoubleSide,
      name: "Fuel_Pipe",
    });
  }

  // 8. Power & Generator Bay
  if (
    meshName.includes("GENERATOR") ||
    meshName.includes("POWER") ||
    meshName.includes("DISTRIBUTION") ||
    meshName.includes("VENT_LOUVER") ||
    matName.includes("POWER") ||
    matName.includes("GENERATOR")
  ) {
    if (meshName.includes("EXHAUST")) {
      return new THREE.MeshStandardMaterial({
        color: new THREE.Color("#64748b"),
        roughness: 0.25,
        metalness: 0.88,
        side: THREE.DoubleSide,
        name: "Gen_Exhaust",
      });
    }
    return new THREE.MeshStandardMaterial({
      color: new THREE.Color("#334155"),
      roughness: 0.38,
      metalness: 0.55,
      side: THREE.DoubleSide,
      name: "Power_Bay",
    });
  }

  // 9. ISRO Satcom Dish, Antenna Mast, Radar Dome
  if (
    meshName.includes("SATELLITE_DISH") ||
    meshName.includes("DISH") ||
    meshName.includes("ANTENNA") ||
    meshName.includes("COMMUNICATION") ||
    matName.includes("DISH") ||
    matName.includes("SATCOM")
  ) {
    return new THREE.MeshStandardMaterial({
      color: new THREE.Color("#f8fafc"),
      roughness: 0.18,
      metalness: 0.65,
      side: THREE.DoubleSide,
      name: "Satcom_Dish",
    });
  }

  // 10. Yellow Safety Barriers & Sensors
  if (
    meshName.includes("BARRIER") ||
    meshName.includes("SENSOR") ||
    meshName.includes("WEATHER") ||
    meshName.includes("ANEMOMETER") ||
    matName.includes("YELLOW") ||
    matName.includes("AMBER")
  ) {
    return new THREE.MeshStandardMaterial({
      color: new THREE.Color("#eab308"),
      roughness: 0.38,
      metalness: 0.2,
      side: THREE.DoubleSide,
      name: "Sensor_Amber",
    });
  }

  // 11. Antarctic Snow Base & Drifts (Bright crisp polar snow matching Maitri)
  if (
    meshName.includes("SITE BASE") ||
    meshName.includes("SNOW") ||
    meshName.includes("TERRAIN") ||
    matName.includes("SNOW")
  ) {
    return new THREE.MeshStandardMaterial({
      color: new THREE.Color("#e6f1fc"),
      roughness: 0.85,
      metalness: 0.0,
      side: THREE.DoubleSide,
      name: "Antarctic_Snow",
    });
  }

  // 12. Rocky Terrain (Dark slate/charcoal oasis boulders standing out against snow)
  if (
    meshName.includes("ROCK") ||
    meshName.includes("BOULDER") ||
    matName.includes("ROCK")
  ) {
    const isDark =
      meshName.includes("01") ||
      meshName.includes("03") ||
      meshName.includes("07") ||
      meshName.includes("11") ||
      meshName.includes("15") ||
      meshName.includes("21");
    return new THREE.MeshStandardMaterial({
      color: new THREE.Color(isDark ? "#2d3748" : "#4a5568"),
      roughness: 0.94,
      metalness: 0.02,
      side: THREE.DoubleSide,
      name: "Oasis_Rock",
    });
  }

  // 13. Compacted Access Track
  if (meshName.includes("ACCESS") || matName.includes("TRACK")) {
    return new THREE.MeshStandardMaterial({
      color: new THREE.Color("#3f474e"),
      roughness: 0.85,
      metalness: 0.1,
      side: THREE.DoubleSide,
      name: "Compacted_Track",
    });
  }

  // Default fallback
  return new THREE.MeshStandardMaterial({
    color: new THREE.Color("#cbd5e1"),
    roughness: 0.4,
    metalness: 0.3,
    side: THREE.DoubleSide,
    name: "Standard_Fallback",
  });
}

export function BharatiStation3D({
  connectivity,
  liveState,
  selectedComponent,
  onSelectComponent,
  className = "",
  height = 640,
}: BharatiStation3DProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const sceneRef = useRef<THREE.Scene | null>(null);
  const cameraRef = useRef<THREE.PerspectiveCamera | null>(null);
  const rendererRef = useRef<THREE.WebGLRenderer | null>(null);
  const controlsRef = useRef<OrbitControls | null>(null);
  const animationFrameRef = useRef<number | null>(null);
  const cameraTweenRef = useRef<{
    startPos: THREE.Vector3;
    endPos: THREE.Vector3;
    startTarget: THREE.Vector3;
    endTarget: THREE.Vector3;
    startTime: number;
    duration: number;
  } | null>(null);
  const enhancedMaterialsRef = useRef<Map<THREE.Mesh, THREE.Material>>(new Map());

  // UI state
  const [loading, setLoading] = useState(true);
  const [loadProgress, setLoadProgress] = useState(0);
  const [renderMode, setRenderMode] = useState<RenderMode>("pbr");
  const [tourActive, setTourActive] = useState(false);
  const [currentPresetIdx, setCurrentPresetIdx] = useState(0);
  const [showHotspots, setShowHotspots] = useState(true);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [activePopup, setActivePopup] = useState<HotspotData | null>(null);
  const [screenCoords, setScreenCoords] = useState<{ [key: string]: { x: number; y: number; visible: boolean } }>({});

  const isBlackout = connectivity === "BLACKOUT";

  // Telemetry values for Bharati
  const tempVal = liveState?.environment.temperature_c ?? -18.4;
  const windVal = liveState?.environment.wind_speed_knots ?? 28;
  const powerVal = liveState?.energy.available_power_kw ?? 648;
  const fuelVal = liveState?.logistics.fuel_stock_percent ?? 74;

  const handleDismissPopup = useCallback(() => {
    setActivePopup(null);
  }, []);

  // -------------------------------------------------------------
  // THREE.JS SCENE INITIALIZATION & GLB LOADER (MATCHING MAITRI)
  // -------------------------------------------------------------
  useEffect(() => {
    if (!containerRef.current || !canvasRef.current) return;
    const container = containerRef.current;
    const canvas = canvasRef.current;

    const width = container.clientWidth || 800;
    const heightPx = container.clientHeight || 640;

    // 1. Scene with Deep Navy Polar Sky matching Maitri
    const scene = new THREE.Scene();
    scene.background = new THREE.Color("#091726");
    sceneRef.current = scene;

    // 2. Camera setup positioned at signature panoramic view showing containers, fuel farm & snow
    const camera = new THREE.PerspectiveCamera(40, width / heightPx, 0.5, 1000);
    camera.position.set(48, 32, -72);
    cameraRef.current = camera;

    // 3. WebGL Renderer with ACESFilmic Tone Mapping
    const renderer = new THREE.WebGLRenderer({
      canvas,
      antialias: true,
      alpha: true,
      powerPreference: "high-performance",
    });
    renderer.setSize(width, heightPx);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.25;
    rendererRef.current = renderer;

    // 4. Orbit Controls
    const controls = new OrbitControls(camera, canvas);
    controls.enableDamping = true;
    controls.dampingFactor = 0.05;
    controls.maxPolarAngle = Math.PI / 2 - 0.04;
    controls.minDistance = 10;
    controls.maxDistance = 250;
    controls.target.set(0, 6.0, -5);
    controlsRef.current = controls;

    controls.addEventListener("start", () => {
      setActivePopup(null);
    });

    // 5. Polar Lighting Setup (Matching Maitri's crisp bright daylight)
    const sunLight = new THREE.DirectionalLight(0xfff8ea, 1.7);
    sunLight.position.set(35, 45, -55);
    sunLight.castShadow = true;
    sunLight.shadow.mapSize.width = 2048;
    sunLight.shadow.mapSize.height = 2048;
    sunLight.shadow.camera.near = 5;
    sunLight.shadow.camera.far = 180;
    const d = 65;
    sunLight.shadow.camera.left = -d;
    sunLight.shadow.camera.right = d;
    sunLight.shadow.camera.top = d;
    sunLight.shadow.camera.bottom = -d;
    sunLight.shadow.bias = -0.0003;
    scene.add(sunLight);

    const hemiLight = new THREE.HemisphereLight(0xb0e2ff, 0x38bdf8, 1.2);
    scene.add(hemiLight);

    const ambientLight = new THREE.AmbientLight(0xffffff, 0.75);
    scene.add(ambientLight);

    const fillLight = new THREE.DirectionalLight(0x50b5ff, 0.75);
    fillLight.position.set(-35, 30, 25);
    scene.add(fillLight);

    const stationAccentLight = new THREE.PointLight(0xffecd1, 1.2, 80);
    stationAccentLight.position.set(0, 16, -10);
    scene.add(stationAccentLight);

    // 6. Base Polar Ground Disk (Matching Maitri's bright snow field)
    const groundDiskGeo = new THREE.CylinderGeometry(75, 78, 0.4, 64);
    const groundDiskMat = new THREE.MeshStandardMaterial({
      color: new THREE.Color("#e6f1fc"),
      roughness: 0.85,
      metalness: 0.0,
    });
    const groundDisk = new THREE.Mesh(groundDiskGeo, groundDiskMat);
    groundDisk.position.y = -0.15;
    groundDisk.receiveShadow = true;
    scene.add(groundDisk);

    // 7. Grid Ground Reference (Cyan Grid matching Maitri)
    const gridHelper = new THREE.GridHelper(140, 48, 0x1a4f66, 0x071b29);
    gridHelper.position.y = 0.01;
    scene.add(gridHelper);

    // 8. Dynamic Antarctic Snowfall Particles
    const snowCount = 1200;
    const snowGeo = new THREE.BufferGeometry();
    const snowPos = new Float32Array(snowCount * 3);
    const snowVel = new Float32Array(snowCount * 3);

    for (let i = 0; i < snowCount; i++) {
      snowPos[i * 3] = (Math.random() - 0.5) * 140;
      snowPos[i * 3 + 1] = Math.random() * 50;
      snowPos[i * 3 + 2] = (Math.random() - 0.5) * 140;

      snowVel[i * 3] = (Math.random() - 0.5) * 0.12;
      snowVel[i * 3 + 1] = -(0.06 + Math.random() * 0.1);
      snowVel[i * 3 + 2] = (Math.random() - 0.5) * 0.12;
    }

    snowGeo.setAttribute("position", new THREE.BufferAttribute(snowPos, 3));
    const snowMat = new THREE.PointsMaterial({
      color: 0xe0f2fe,
      size: 0.28,
      transparent: true,
      opacity: 0.65,
      blending: THREE.AdditiveBlending,
    });
    const snowPoints = new THREE.Points(snowGeo, snowMat);
    scene.add(snowPoints);

    // 9. Load Bharati GLB Model
    const loader = new GLTFLoader();
    loader.load(
      "/assets/bharati_research_station.glb",
      (gltf) => {
        const model = gltf.scene;
        model.traverse((child) => {
          if ((child as THREE.Mesh).isMesh) {
            const mesh = child as THREE.Mesh;
            mesh.castShadow = true;
            mesh.receiveShadow = true;
            const pbrMat = enhanceBharatiMeshMaterial(mesh);
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
        console.warn("Failed to load /assets/bharati_research_station.glb, loading fallback:", error);
        loader.load("/assets/bharati-station.glb", (fallbackGltf) => {
          fallbackGltf.scene.traverse((c) => {
            if ((c as THREE.Mesh).isMesh) {
              const m = c as THREE.Mesh;
              m.material = enhanceBharatiMeshMaterial(m);
              enhancedMaterialsRef.current.set(m, m.material as THREE.Material);
            }
          });
          scene.add(fallbackGltf.scene);
          setLoading(false);
        });
      }
    );

    // 10. Resize Handler
    const handleResize = () => {
      if (!container || !camera || !renderer) return;
      const w = container.clientWidth;
      const h = container.clientHeight;
      camera.aspect = w / h;
      camera.updateProjectionMatrix();
      renderer.setSize(w, h);
    };
    window.addEventListener("resize", handleResize);

    // 11. Animation Loop
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

      // Update snow particles
      const positions = snowGeo.attributes.position.array as Float32Array;
      for (let i = 0; i < snowCount; i++) {
        positions[i * 3] += snowVel[i * 3];
        positions[i * 3 + 1] += snowVel[i * 3 + 1];
        positions[i * 3 + 2] += snowVel[i * 3 + 2];

        if (positions[i * 3 + 1] < -2) {
          positions[i * 3] = (Math.random() - 0.5) * 140;
          positions[i * 3 + 1] = 45 + Math.random() * 5;
          positions[i * 3 + 2] = (Math.random() - 0.5) * 140;
        }
      }
      snowGeo.attributes.position.needsUpdate = true;

      controls.update();

      // Screen projections for hotspots
      const w = container.clientWidth;
      const h = container.clientHeight;
      const newCoords: { [key: string]: { x: number; y: number; visible: boolean } } = {};

      HOTSPOTS.forEach((hp) => {
        const v = hp.worldPos.clone().project(camera);
        const isBehind = v.z > 1;
        const x = ((v.x + 1) / 2) * w;
        const y = ((-v.y + 1) / 2) * h;
        newCoords[hp.id] = {
          x,
          y,
          visible: !isBehind && x >= 0 && x <= w && y >= 0 && y <= h,
        };
      });
      setScreenCoords(newCoords);

      renderer.render(scene, camera);
    };

    animationFrameRef.current = requestAnimationFrame(animate);

    return () => {
      window.removeEventListener("resize", handleResize);
      if (animationFrameRef.current) cancelAnimationFrame(animationFrameRef.current);
      renderer.dispose();
    };
  }, []);

  // -------------------------------------------------------------
  // CAMERA PRESETS & TOUR TRANSITIONS
  // -------------------------------------------------------------
  const applyPreset = useCallback((index: number) => {
    const preset = CAMERA_PRESETS[index];
    if (!preset || !cameraRef.current || !controlsRef.current) return;
    setCurrentPresetIdx(index);

    cameraTweenRef.current = {
      startPos: cameraRef.current.position.clone(),
      endPos: new THREE.Vector3(...preset.pos),
      startTarget: controlsRef.current.target.clone(),
      endTarget: new THREE.Vector3(...preset.target),
      startTime: performance.now(),
      duration: 1100,
    };
  }, []);

  // Auto Tour Timer
  useEffect(() => {
    if (!tourActive) return;
    const interval = setInterval(() => {
      setCurrentPresetIdx((prev) => {
        const next = (prev + 1) % CAMERA_PRESETS.length;
        applyPreset(next);
        return next;
      });
    }, 6000);
    return () => clearInterval(interval);
  }, [tourActive, applyPreset]);

  // -------------------------------------------------------------
  // RENDER MODE SHADER APPLIERS
  // -------------------------------------------------------------
  useEffect(() => {
    if (!sceneRef.current) return;
    sceneRef.current.traverse((child) => {
      if ((child as THREE.Mesh).isMesh) {
        const mesh = child as THREE.Mesh;
        if (renderMode === "hologram") {
          mesh.material = new THREE.MeshBasicMaterial({
            color: new THREE.Color("#06b6d4"),
            wireframe: true,
          });
        } else if (renderMode === "thermal") {
          const isHeatSource =
            mesh.name.toUpperCase().includes("BUILDING") ||
            mesh.name.toUpperCase().includes("SHELL") ||
            mesh.name.toUpperCase().includes("GENERATOR") ||
            mesh.name.toUpperCase().includes("VENT");
          mesh.material = new THREE.MeshBasicMaterial({
            color: isHeatSource ? new THREE.Color("#ef4444") : new THREE.Color("#1e3a8a"),
          });
        } else {
          const original = enhancedMaterialsRef.current.get(mesh);
          if (original) mesh.material = original;
          else mesh.material = enhanceBharatiMeshMaterial(mesh);
        }
      }
    });

    if (sceneRef.current) {
      if (renderMode === "night") {
        sceneRef.current.background = new THREE.Color("#020617");
      } else if (renderMode === "hologram") {
        sceneRef.current.background = new THREE.Color("#030c17");
      } else if (renderMode === "thermal") {
        sceneRef.current.background = new THREE.Color("#050811");
      } else {
        sceneRef.current.background = new THREE.Color("#091726");
      }
    }
  }, [renderMode]);

  return (
    <div
      ref={containerRef}
      onClick={handleDismissPopup}
      className={`relative w-full overflow-hidden bg-slate-950 border border-slate-800 rounded-xl shadow-2xl select-none ${
        isFullscreen ? "fixed inset-0 z-50 rounded-none" : ""
      } ${className}`}
      style={{ height: isFullscreen ? "100vh" : height }}
    >
      {/* 3D WebGL Canvas Mount */}
      <canvas
        ref={canvasRef}
        onPointerDown={handleDismissPopup}
        className="w-full h-full block cursor-grab active:cursor-grabbing"
      />

      {/* TOP DECK: Station Info & Controls Bar */}
      <div
        className="absolute top-3 left-3 right-3 flex items-center justify-between pointer-events-none z-20"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center gap-2 bg-slate-900/90 backdrop-blur-md border border-slate-700/80 rounded-lg px-3 py-1.5 pointer-events-auto shadow-lg">
          <div className="flex items-center gap-2">
            <span className="inline-block w-2.5 h-2.5 rounded-full bg-cyan-400 animate-pulse" />
            <span className="font-mono text-xs font-bold text-white tracking-wider">Bharati Research Station</span>
          </div>
          <span className="badge badge-warning font-mono text-[10px] py-0.5">Larsemann Hills</span>
        </div>

        <div className="flex items-center gap-1.5 bg-slate-900/90 backdrop-blur-md border border-slate-700/80 rounded-lg p-1 pointer-events-auto shadow-lg">
          <select
            value={currentPresetIdx}
            onChange={(e) => applyPreset(Number(e.target.value))}
            className="select select-sm text-xs bg-slate-800 text-white border-slate-700 font-sans"
          >
            {CAMERA_PRESETS.map((p, idx) => (
              <option key={p.name} value={idx}>
                {p.name}
              </option>
            ))}
          </select>

          <button
            className={`btn btn-sm ${tourActive ? "btn-warning" : "btn-neutral"} text-xs gap-1`}
            onClick={() => setTourActive(!tourActive)}
          >
            <Camera size={13} />
            <span>{tourActive ? "PAUSE TOUR" : "Tour"}</span>
          </button>

          <button
            className={`btn btn-sm ${showHotspots ? "btn-primary" : "btn-neutral"} text-xs gap-1`}
            onClick={() => setShowHotspots(!showHotspots)}
          >
            <Layers3 size={13} />
            <span>Pins</span>
          </button>

          <button
            className="btn btn-sm btn-ghost p-1.5 text-slate-400 hover:text-white"
            onClick={() => applyPreset(0)}
            title="Reset View"
          >
            <RotateCcw size={13} />
          </button>

          <button
            className="btn btn-sm btn-ghost p-1.5 text-slate-400 hover:text-white"
            onClick={() => setIsFullscreen(!isFullscreen)}
            title={isFullscreen ? "Exit Fullscreen" : "Enter Fullscreen"}
          >
            {isFullscreen ? <Minimize2 size={14} /> : <Maximize2 size={14} />}
          </button>
        </div>
      </div>

      {/* BOTTOM DECK: Telemetry Row & Render Modes */}
      <div
        className="absolute bottom-3 left-3 right-3 flex items-center justify-between pointer-events-none z-20"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center gap-2 bg-slate-900/90 backdrop-blur-md border border-slate-700/80 rounded-lg px-3 py-1.5 pointer-events-auto shadow-lg text-xs font-mono">
          <div className="flex items-center gap-1.5 text-cyan-300">
            <ThermometerSnowflake size={13} />
            <span>{tempVal.toFixed(1)}°C</span>
          </div>
          <span className="text-slate-700">·</span>
          <div className="flex items-center gap-1.5 text-sky-300">
            <Wind size={13} />
            <span>{windVal} kt</span>
          </div>
          <span className="text-slate-700">·</span>
          <div className="flex items-center gap-1.5 text-amber-300">
            <Bolt size={13} />
            <span>{powerVal} kW</span>
          </div>
          <span className="text-slate-700">·</span>
          <div className="flex items-center gap-1.5 text-emerald-300">
            <Fuel size={13} />
            <span>{fuelVal}% FUEL</span>
          </div>
        </div>

        <div className="flex items-center gap-1 bg-slate-900/90 backdrop-blur-md border border-slate-700/80 rounded-lg p-1 pointer-events-auto shadow-lg">
          {(
            [
              { mode: "pbr", label: "Realistic PBR", icon: Sun },
              { mode: "hologram", label: "Hologram", icon: Sparkles },
              { mode: "thermal", label: "Thermal IR", icon: Flame },
              { mode: "night", label: "Polar Night", icon: Moon },
            ] as const
          ).map(({ mode, label, icon: Icon }) => (
            <button
              key={mode}
              className={`btn btn-xs ${renderMode === mode ? "btn-primary" : "btn-neutral"} text-[11px] gap-1`}
              onClick={() => setRenderMode(mode)}
            >
              <Icon size={11} />
              <span>{label}</span>
            </button>
          ))}
        </div>
      </div>

      {/* 3D HOTSPOT PINS MATCHING MAITRI'S STYLE */}
      {showHotspots &&
        HOTSPOTS.map((hp) => {
          const coords = screenCoords[hp.id];
          if (!coords || !coords.visible) return null;
          const isSelected = selectedComponent === hp.id;
          const Icon = hp.icon;

          if (hp.isPrimary) {
            return (
              <div
                key={hp.id}
                className="absolute -translate-x-1/2 -translate-y-1/2 z-10 pointer-events-auto cursor-pointer group"
                style={{ left: coords.x, top: coords.y }}
                onClick={(e) => {
                  e.stopPropagation();
                  onSelectComponent(hp.id);
                  setActivePopup(hp);
                }}
              >
                <div
                  className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg border text-xs font-mono font-bold tracking-wide transition-all duration-200 shadow-xl ${
                    isSelected
                      ? "bg-cyan-500 text-slate-950 border-white ring-2 ring-cyan-400 scale-105"
                      : "bg-amber-500 hover:bg-amber-400 text-slate-950 border-amber-300 shadow-amber-500/20"
                  }`}
                >
                  <Icon size={13} className="text-slate-950" />
                  <span>{hp.label}</span>
                </div>
              </div>
            );
          }

          return (
            <div
              key={hp.id}
              className="absolute -translate-x-1/2 -translate-y-1/2 z-10 pointer-events-auto cursor-pointer group"
              style={{ left: coords.x, top: coords.y }}
              onClick={(e) => {
                e.stopPropagation();
                onSelectComponent(hp.id);
                setActivePopup(hp);
              }}
            >
              <div
                className={`flex items-center gap-1.5 px-2.5 py-1 rounded-md border text-xs font-mono font-medium transition-all duration-200 shadow-xl ${
                  isSelected
                    ? "bg-cyan-500 text-slate-950 border-white ring-2 ring-cyan-400 scale-105"
                    : "bg-slate-900/90 text-slate-200 border-slate-700/80 hover:border-cyan-400 hover:text-white"
                }`}
              >
                <Icon size={12} className={isSelected ? "text-slate-950" : "text-cyan-400"} />
                <span>{hp.label}</span>
              </div>
            </div>
          );
        })}

      {/* SUBSYSTEM INSPECTION POPUP MODAL */}
      {activePopup && (
        <div
          className="absolute top-16 right-4 w-84 bg-slate-900/95 backdrop-blur-xl border border-cyan-500/40 rounded-xl p-4 shadow-2xl z-30 pointer-events-auto animate-in fade-in zoom-in-95 duration-150"
          onClick={(e) => e.stopPropagation()}
        >
          <div className="flex items-start justify-between border-b border-slate-800 pb-2 mb-3">
            <div>
              <span className="text-[10px] font-mono font-bold tracking-wider text-cyan-400">
                {activePopup.domain} · {activePopup.tag}
              </span>
              <h4 className="text-sm font-bold text-white mt-0.5">{activePopup.title}</h4>
            </div>
            <button
              className="btn btn-xs btn-ghost text-slate-400 hover:text-white p-1"
              onClick={() => setActivePopup(null)}
            >
              <X size={14} />
            </button>
          </div>

          <p className="text-xs text-slate-300 leading-relaxed mb-3">{activePopup.summary}</p>

          <div className="bg-slate-950/70 border border-slate-800 rounded-lg p-2.5 text-xs font-mono space-y-1.5 mb-3">
            <div className="flex justify-between">
              <span className="text-slate-400">OPERATING POSTURE</span>
              <span className="text-emerald-400 font-bold">NOMINAL / AUTO</span>
            </div>
            <div className="flex justify-between">
              <span className="text-slate-400">ISRO SATCOM RELAY</span>
              <span className="text-cyan-300 font-bold">58 ms LATENCY</span>
            </div>
            <div className="flex justify-between">
              <span className="text-slate-400">ENERGY DEMAND</span>
              <span className="text-amber-300 font-bold">388 kW (CRITICAL)</span>
            </div>
          </div>

          <button
            className="btn btn-sm btn-primary w-full text-xs gap-1.5"
            onClick={() => setActivePopup(null)}
          >
            <span>ACKNOWLEDGE TELEMETRY</span>
            <ArrowUpRight size={13} />
          </button>
        </div>
      )}

      {/* LOADING OVERLAY */}
      {loading && (
        <div className="absolute inset-0 bg-slate-950/90 backdrop-blur-md flex flex-col items-center justify-center gap-3 z-40">
          <div className="w-10 h-10 border-3 border-cyan-500 border-t-transparent rounded-full animate-spin" />
          <div className="text-center font-mono">
            <span className="text-xs text-white font-bold tracking-wider">
              LOADING BHARATI 3D DIGITAL TWIN
            </span>
            <p className="text-[11px] text-slate-400 mt-1">
              Larsemann Hills Terrain · ISRO Satellite Radomes · Stilts Structure · {loadProgress}%
            </p>
          </div>
        </div>
      )}
    </div>
  );
}
