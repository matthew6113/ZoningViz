import { Edges, Line, OrbitControls, PerspectiveCamera } from "@react-three/drei";
import { Canvas, useFrame, useThree } from "@react-three/fiber";
import { groundOf, projectMultiPolygon, type FrontCandidate, type Ground, type HeightGrid, type XY } from "@zoningviz/engine";
import type { SfBuilding } from "@zoningviz/jurisdictions/sf";
import { useEffect, useMemo, useRef } from "react";
import { BufferAttribute, BufferGeometry, ExtrudeGeometry } from "three";
import type { AnimState } from "../anim/timeline";
import type { OkResult } from "../state/steps";
import { AnimatedDimensions, AnimatedEnvelope, AnimatedFloors, CuttingPlanes } from "./Animated";
import { ENGINE_TO_THREE, engineToThree } from "./coords";
import { ringsToShape, ringToPoints } from "./geometry";
import { Label, LabelLayer } from "./labels";
import { COLORS } from "./palette";

export interface SceneProps {
  /** Lot outline, neighbor lot outlines and origin, in engine world feet. */
  outline: XY[][][];
  neighborLots: XY[][][][];
  originPlanar: XY;
  /** proj4 definition for context data in lon/lat (null for synthetic lots). */
  projection: string | null;
  buildings: SfBuilding[];
  /** The street side used as the front, once known. */
  front: FrontCandidate | null;
  /** Street sides to choose between (corner and through lots). */
  candidates: FrontCandidate[] | null;
  /** The envelope and the timeline state that animates it. */
  result: OkResult | null;
  anim: AnimState | null;
  /** Height of the starting block, used to frame the camera. */
  frameHeightFt: number;
  /** Set when the lot was opened from the map: the arrival starts at the map's scale, north up. */
  handoff?: Handoff | null;
}

/** The map's view at the moment it hands over to the scene. */
export interface Handoff {
  /** Ground feet per screen pixel at the end of the map's flight. */
  ftPerPx: number;
}

export function Scene(props: SceneProps) {
  const { outline, frameHeightFt, front, result, anim } = props;
  const grids = result?.lot.ground ?? null;
  // Ground elevation anywhere in the scene (curb datum), or null for a flat lot.
  const ground = useMemo(() => (grids ? groundOf(grids.fine, grids.context) : null), [grids]);
  const groundZ = ground ? ground(0, 0) : 0;
  const framing = useMemo(
    () => frame(outline, front?.outward ?? null, frameHeightFt, groundZ),
    [outline, front, frameHeightFt, groundZ],
  );
  const labels = useRef<HTMLDivElement>(null);

  return (
    <div className="scene" ref={labels}>
      <LabelLayer.Provider value={labels}>
        <Canvas className="scene-canvas" dpr={[1, 2]} gl={{ antialias: true, preserveDrawingBuffer: AUTOMATED }} data-testid="scene">
          <color attach="background" args={["#f7f6f2"]} />
          <hemisphereLight args={["#ffffff", "#d9d3c4", 1.6]} />
          <directionalLight position={engineToThree([-0.6 * framing.distance, -0.8 * framing.distance, framing.distance])} intensity={1.6} />
          <CameraRig key={framing.key} framing={framing} anim={anim} handoff={props.handoff ?? null} />
          <group rotation={ENGINE_TO_THREE}>
            {grids && ground ? <Terrain grids={grids} ground={ground} radius={framing.distance * 3} /> : <Ground radius={framing.distance * 3} />}
            <LotLines outline={outline} neighbors={props.neighborLots} front={front} ground={ground} />
            <Buildings buildings={props.buildings} projection={props.projection} origin={props.originPlanar} ground={ground} />
            {props.candidates && <FrontSides candidates={props.candidates} />}
            {result && anim && (
              <>
                <AnimatedEnvelope result={result} anim={anim} />
                <CuttingPlanes result={result} anim={anim} />
                <AnimatedDimensions result={result} anim={anim} />
                <AnimatedFloors floors={result.floors} anim={anim} />
              </>
            )}
          </group>
        </Canvas>
      </LabelLayer.Provider>
    </div>
  );
}

// Browser tests read the canvas pixels back, which needs the drawing buffer kept
// between frames. That costs a copy per frame, so real visitors don't get it.
const AUTOMATED = typeof navigator !== "undefined" && navigator.webdriver === true;

type Framing = ReturnType<typeof frame>;

// Framing is tuned for a landscape canvas; narrower canvases (phones) pull the camera back.
const REFERENCE_ASPECT = 1.3;
// The arrival flies from nearly straight overhead (a map-like view) down to the street view.
const OVERHEAD_ELEVATION = (88 * Math.PI) / 180;
const STREET_ELEVATION = (30 * Math.PI) / 180;
const OVERHEAD_DISTANCE = 1.3;
const FOV_DEG = 35;

interface ControlsLike {
  target: { set(x: number, y: number, z: number): void };
  enabled: boolean;
  update(): void;
}

function CameraRig({ framing, anim, handoff }: { framing: Framing; anim: AnimState | null; handoff: Handoff | null }) {
  const width = useThree((state) => state.size.width);
  const height = useThree((state) => Math.max(1, state.size.height));
  const camera = useThree((state) => state.camera);
  const controls = useThree((state) => state.controls) as unknown as ControlsLike | null;
  const pullBack = Math.max(1, REFERENCE_ASPECT / (width / height));
  const last = useRef<string | null>(null);
  // Coming from the map: start where the camera shows the ground at the map's scale.
  // Camera height above the ground = ft/px × canvas height / (2 tan(fov/2)).
  const start = handoff
    ? { distance: Math.max(handoff.ftPerPx * height / (2 * Math.tan((FOV_DEG * Math.PI) / 360)) - framing.liftFt, 10) }
    : null;

  // During the arrival the timeline flies the camera; afterwards the viewer can orbit freely.
  useFrame(() => {
    const p = anim ? anim.camera : 1;
    const key = `${p}:${pullBack}:${start?.distance}`;
    if (key === last.current) return;
    last.current = key;
    const [x, y, z] = cameraAt(framing, pullBack, p, start);
    camera.position.set(x, y, z);
    if (controls) {
      controls.target.set(...framing.target);
      controls.enabled = p >= 1;
      controls.update();
    } else {
      camera.lookAt(...framing.target);
    }
  });

  return (
    <>
      <PerspectiveCamera makeDefault fov={FOV_DEG} near={1} far={50_000} position={cameraAt(framing, pullBack, anim ? anim.camera : 1, start)} />
      <OrbitControls makeDefault target={framing.target} maxPolarAngle={Math.PI / 2 - 0.04} />
    </>
  );
}

/** A three-quarter view from the street side, far enough back to see the whole block. */
function frame(outline: XY[][][], outward: XY | null, heightFt: number, groundZ = 0) {
  const radius = Math.max(10, ...outline.flat(2).map(([x, y]) => Math.hypot(x, y)));
  const [ox, oy] = outward ?? [0, -1];
  const turn = (35 * Math.PI) / 180;
  return {
    key: `${radius.toFixed(1)}:${heightFt}:${ox.toFixed(3)}:${oy.toFixed(3)}:${groundZ.toFixed(1)}`,
    distance: Math.max(radius * 3.4, heightFt * 2.2, 80),
    azimuth: [ox * Math.cos(turn) - oy * Math.sin(turn), ox * Math.sin(turn) + oy * Math.cos(turn)] as XY,
    /** How far the look-at point sits above the ground at the lot's center. */
    liftFt: heightFt * 0.3,
    targetEngine: [0, 0, groundZ + heightFt * 0.3] as [number, number, number],
    target: engineToThree([0, 0, groundZ + heightFt * 0.3]),
  };
}

/**
 * Camera position (three.js coordinates) at arrival progress p: 0 overhead, 1 street view.
 * With a map handoff the overhead view starts north up (camera due south of the lot)
 * at the map's distance, and turns toward the street side as it descends.
 */
function cameraAt(framing: Framing, pullBack: number, p: number, handoff: { distance: number } | null): [number, number, number] {
  const elevation = OVERHEAD_ELEVATION + (STREET_ELEVATION - OVERHEAD_ELEVATION) * p;
  const street = framing.distance * pullBack;
  const overhead = handoff ? handoff.distance : street * OVERHEAD_DISTANCE;
  const distance = overhead + (street - overhead) * p;
  const [tx, ty, tz] = framing.targetEngine;
  const streetAngle = Math.atan2(framing.azimuth[1], framing.azimuth[0]);
  const startAngle = handoff ? -Math.PI / 2 : streetAngle;
  const turn = Math.atan2(Math.sin(streetAngle - startAngle), Math.cos(streetAngle - startAngle)); // shortest way round
  const angle = startAngle + turn * p;
  const [ax, ay] = [Math.cos(angle), Math.sin(angle)];
  return engineToThree([
    tx + ax * distance * Math.cos(elevation),
    ty + ay * distance * Math.cos(elevation),
    tz + distance * Math.sin(elevation),
  ]);
}

function Ground({ radius }: { radius: number }) {
  return (
    <mesh position={[0, 0, -0.05]}>
      <planeGeometry args={[radius * 2, radius * 2]} />
      <meshStandardMaterial color={COLORS.ground} />
    </mesh>
  );
}

function LotLines({
  outline,
  neighbors,
  front,
  ground,
}: {
  outline: XY[][][];
  neighbors: XY[][][][];
  front: FrontCandidate | null;
  ground: Ground | null;
}) {
  const lines = useMemo(
    () => ({
      neighbors: neighbors.flatMap((polygons) => polygons.map((rings) => drape(ringToPoints(rings[0] ?? []), ground, 0.15))),
      lot: outline.map((rings) => drape(ringToPoints(rings[0] ?? []), ground, 0.3)),
      front: front ? drape(front.path.map(([x, y]) => [x, y, 0] as [number, number, number]), ground, 0.45) : null,
    }),
    [outline, neighbors, front, ground],
  );
  return (
    <group>
      {lines.neighbors.map((points, i) => (
        <Line key={`n${i}`} points={points} color={COLORS.neighborLotLine} lineWidth={1} />
      ))}
      {lines.lot.map((points, i) => (
        <Line key={`l${i}`} points={points} color={COLORS.lotLine} lineWidth={2} />
      ))}
      {lines.front && <Line points={lines.front} color={COLORS.front} lineWidth={4} />}
    </group>
  );
}

/** Lays a line on the ground: split into short pieces, each point lifted to the ground plus `lift`. */
function drape(points: [number, number, number][], ground: Ground | null, lift: number): [number, number, number][] {
  if (!ground) return points.map(([x, y]) => [x, y, lift / 6]);
  const out: [number, number, number][] = [];
  points.forEach(([x, y], i) => {
    const next = points[i + 1];
    out.push([x, y, ground(x, y) + lift]);
    if (!next) return;
    const steps = Math.floor(Math.hypot(next[0] - x, next[1] - y) / DRAPE_STEP_FT);
    for (let k = 1; k <= steps; k++) {
      const t = k / (steps + 1);
      const px = x + (next[0] - x) * t;
      const py = y + (next[1] - y) * t;
      out.push([px, py, ground(px, py) + lift]);
    }
  });
  return out;
}

const DRAPE_STEP_FT = 2;
// The drawn ground is resampled this finely (the envelope sits on the fine grid; the mesh just has to match it closely).
const TERRAIN_MESH_STEP_FT = 3;

/** The ground as a mesh over the terrain grids, on a flat apron that runs out to the horizon. */
function Terrain({ grids, ground, radius }: { grids: { fine: HeightGrid; context: HeightGrid | null }; ground: Ground; radius: number }) {
  const { geometry, apronZ } = useMemo(() => {
    const extent = grids.context ?? grids.fine;
    const width = (extent.nx - 1) * extent.spacingFt;
    const height = (extent.ny - 1) * extent.spacingFt;
    const nx = Math.max(2, Math.round(width / TERRAIN_MESH_STEP_FT) + 1);
    const ny = Math.max(2, Math.round(height / TERRAIN_MESH_STEP_FT) + 1);
    const positions = new Float32Array(nx * ny * 3);
    let apron = Infinity;
    for (let j = 0; j < ny; j++) {
      for (let i = 0; i < nx; i++) {
        const x = extent.x0 + (i * width) / (nx - 1);
        const y = extent.y0 + (j * height) / (ny - 1);
        const z = ground(x, y) - 0.05;
        positions.set([x, y, z], (j * nx + i) * 3);
        if (i === 0 || j === 0 || i === nx - 1 || j === ny - 1) apron = Math.min(apron, z);
      }
    }
    const index: number[] = [];
    for (let j = 0; j + 1 < ny; j++) {
      for (let i = 0; i + 1 < nx; i++) {
        const a = j * nx + i;
        index.push(a, a + 1, a + nx + 1, a, a + nx + 1, a + nx);
      }
    }
    const g = new BufferGeometry();
    g.setAttribute("position", new BufferAttribute(positions, 3));
    g.setIndex(index);
    g.computeVertexNormals();
    return { geometry: g, apronZ: apron };
  }, [grids, ground]);
  useEffect(() => () => geometry.dispose(), [geometry]);
  return (
    <group>
      <mesh geometry={geometry} data-testid="terrain">
        <meshStandardMaterial color={COLORS.ground} />
      </mesh>
      <mesh position={[0, 0, apronZ - 0.1]}>
        <planeGeometry args={[radius * 2, radius * 2]} />
        <meshStandardMaterial color={COLORS.ground} />
      </mesh>
    </group>
  );
}

function Buildings({
  buildings,
  projection,
  origin,
  ground,
}: {
  buildings: SfBuilding[];
  projection: string | null;
  origin: XY;
  ground: Ground | null;
}) {
  const shapes = useMemo(() => {
    if (!projection) return [];
    return buildings.flatMap((b) =>
      projectMultiPolygon(b.geometry, projection).map((polygon) => {
        const rings = polygon.map((ring) => ring.map(([x, y]) => [x - origin[0], y - origin[1]] as [number, number]));
        // On a slope a building stands on its lowest ground; its LiDAR height is measured from the ground around it.
        const zs = ground ? (rings[0] ?? []).map(([x, y]) => ground(x, y)) : [0];
        const base = Math.min(...zs);
        const mean = zs.reduce((sum, z) => sum + z, 0) / zs.length;
        return { id: b.id, heightFt: b.heightFt, rings, base, rise: mean - base };
      }),
    );
  }, [buildings, projection, origin, ground]);

  const geometries = useMemo(
    () =>
      shapes.map((s) =>
        s.heightFt && s.heightFt > 0
          ? new ExtrudeGeometry(ringsToShape(s.rings), { depth: s.heightFt + s.rise, bevelEnabled: false })
          : null,
      ),
    [shapes],
  );
  useEffect(() => () => geometries.forEach((g) => g?.dispose()), [geometries]);

  return (
    <group>
      {shapes.map((s, i) => {
        const geometry = geometries[i];
        return geometry ? (
          <mesh key={`${s.id}-${i}`} geometry={geometry} position={[0, 0, s.base]}>
            <meshStandardMaterial color={COLORS.building} transparent opacity={0.55} depthWrite={false} />
            <Edges threshold={30} color={COLORS.buildingEdge} />
          </mesh>
        ) : (
          <Line key={`${s.id}-${i}`} points={ringToPoints(s.rings[0] ?? [], s.base + 0.03)} color={COLORS.buildingEdge} lineWidth={1} />
        );
      })}
    </group>
  );
}

function FrontSides({ candidates }: { candidates: FrontCandidate[] }) {
  return (
    <group>
      {candidates.map((c) => {
        const color = COLORS.candidate[c.index % COLORS.candidate.length]!;
        const labelAt: [number, number, number] = [
          (c.from[0] + c.to[0]) / 2 + c.outward[0] * 6,
          (c.from[1] + c.to[1]) / 2 + c.outward[1] * 6,
          1,
        ];
        return (
          <group key={c.index}>
            <Line points={c.path.map(([x, y]) => [x, y, 0.1] as [number, number, number])} color={color} lineWidth={6} />
            <Label position={labelAt} className="side-label">
              <span style={{ borderColor: color }}>{sideName(c.index)}</span>
            </Label>
          </group>
        );
      })}
    </group>
  );
}

export function sideName(index: number): string {
  return `Side ${String.fromCharCode(65 + index)}`;
}
