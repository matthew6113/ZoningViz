import { Edges, Line, OrbitControls, PerspectiveCamera } from "@react-three/drei";
import { Canvas, useFrame, useThree } from "@react-three/fiber";
import { projectMultiPolygon, type FrontCandidate, type XY } from "@zoningviz/engine";
import type { SfBuilding } from "@zoningviz/jurisdictions/sf";
import { useEffect, useMemo, useRef } from "react";
import { ExtrudeGeometry } from "three";
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
}

export function Scene(props: SceneProps) {
  const { outline, frameHeightFt, front, result, anim } = props;
  const framing = useMemo(() => frame(outline, front?.outward ?? null, frameHeightFt), [outline, front, frameHeightFt]);
  const labels = useRef<HTMLDivElement>(null);

  return (
    <div className="scene" ref={labels}>
      <LabelLayer.Provider value={labels}>
        <Canvas className="scene-canvas" dpr={[1, 2]} gl={{ antialias: true, preserveDrawingBuffer: AUTOMATED }} data-testid="scene">
          <color attach="background" args={["#f7f6f2"]} />
          <hemisphereLight args={["#ffffff", "#d9d3c4", 1.6]} />
          <directionalLight position={engineToThree([-0.6 * framing.distance, -0.8 * framing.distance, framing.distance])} intensity={1.6} />
          <CameraRig key={framing.key} framing={framing} anim={anim} />
          <group rotation={ENGINE_TO_THREE}>
            <Ground radius={framing.distance * 3} />
            <LotLines outline={outline} neighbors={props.neighborLots} front={front} />
            <Buildings buildings={props.buildings} projection={props.projection} origin={props.originPlanar} />
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

interface ControlsLike {
  target: { set(x: number, y: number, z: number): void };
  enabled: boolean;
  update(): void;
}

function CameraRig({ framing, anim }: { framing: Framing; anim: AnimState | null }) {
  const aspect = useThree((state) => state.size.width / Math.max(1, state.size.height));
  const camera = useThree((state) => state.camera);
  const controls = useThree((state) => state.controls) as unknown as ControlsLike | null;
  const pullBack = Math.max(1, REFERENCE_ASPECT / aspect);
  const last = useRef<string | null>(null);

  // During the arrival the timeline flies the camera; afterwards the viewer can orbit freely.
  useFrame(() => {
    const p = anim ? anim.camera : 1;
    const key = `${p}:${pullBack}`;
    if (key === last.current) return;
    last.current = key;
    const [x, y, z] = cameraAt(framing, pullBack, p);
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
      <PerspectiveCamera makeDefault fov={35} near={1} far={50_000} position={cameraAt(framing, pullBack, anim ? anim.camera : 1)} />
      <OrbitControls makeDefault target={framing.target} maxPolarAngle={Math.PI / 2 - 0.04} />
    </>
  );
}

/** A three-quarter view from the street side, far enough back to see the whole block. */
function frame(outline: XY[][][], outward: XY | null, heightFt: number) {
  const radius = Math.max(10, ...outline.flat(2).map(([x, y]) => Math.hypot(x, y)));
  const [ox, oy] = outward ?? [0, -1];
  const turn = (35 * Math.PI) / 180;
  return {
    key: `${radius.toFixed(1)}:${heightFt}:${ox.toFixed(3)}:${oy.toFixed(3)}`,
    distance: Math.max(radius * 3.4, heightFt * 2.2, 80),
    azimuth: [ox * Math.cos(turn) - oy * Math.sin(turn), ox * Math.sin(turn) + oy * Math.cos(turn)] as XY,
    targetEngine: [0, 0, heightFt * 0.3] as [number, number, number],
    target: engineToThree([0, 0, heightFt * 0.3]),
  };
}

/** Camera position (three.js coordinates) at arrival progress p: 0 overhead, 1 street view. */
function cameraAt(framing: Framing, pullBack: number, p: number): [number, number, number] {
  const elevation = OVERHEAD_ELEVATION + (STREET_ELEVATION - OVERHEAD_ELEVATION) * p;
  const distance = framing.distance * pullBack * (OVERHEAD_DISTANCE + (1 - OVERHEAD_DISTANCE) * p);
  const [tx, ty, tz] = framing.targetEngine;
  const [ax, ay] = framing.azimuth;
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

function LotLines({ outline, neighbors, front }: { outline: XY[][][]; neighbors: XY[][][][]; front: FrontCandidate | null }) {
  return (
    <group>
      {neighbors.flatMap((polygons, i) =>
        polygons.map((rings, j) => (
          <Line key={`n${i}-${j}`} points={ringToPoints(rings[0] ?? [], 0.02)} color={COLORS.neighborLotLine} lineWidth={1} />
        )),
      )}
      {outline.map((rings, i) => (
        <Line key={`l${i}`} points={ringToPoints(rings[0] ?? [], 0.04)} color={COLORS.lotLine} lineWidth={2} />
      ))}
      {front && (
        <Line points={front.path.map(([x, y]) => [x, y, 0.06] as [number, number, number])} color={COLORS.front} lineWidth={4} />
      )}
    </group>
  );
}

function Buildings({ buildings, projection, origin }: { buildings: SfBuilding[]; projection: string | null; origin: XY }) {
  const shapes = useMemo(() => {
    if (!projection) return [];
    return buildings.flatMap((b) =>
      projectMultiPolygon(b.geometry, projection).map((polygon) => ({
        id: b.id,
        heightFt: b.heightFt,
        rings: polygon.map((ring) => ring.map(([x, y]) => [x - origin[0], y - origin[1]] as [number, number])),
      })),
    );
  }, [buildings, projection, origin]);

  const geometries = useMemo(
    () =>
      shapes.map((s) =>
        s.heightFt && s.heightFt > 0 ? new ExtrudeGeometry(ringsToShape(s.rings), { depth: s.heightFt, bevelEnabled: false }) : null,
      ),
    [shapes],
  );
  useEffect(() => () => geometries.forEach((g) => g?.dispose()), [geometries]);

  return (
    <group>
      {shapes.map((s, i) => {
        const geometry = geometries[i];
        return geometry ? (
          <mesh key={`${s.id}-${i}`} geometry={geometry}>
            <meshStandardMaterial color={COLORS.building} transparent opacity={0.55} depthWrite={false} />
            <Edges threshold={30} color={COLORS.buildingEdge} />
          </mesh>
        ) : (
          <Line key={`${s.id}-${i}`} points={ringToPoints(s.rings[0] ?? [], 0.03)} color={COLORS.buildingEdge} lineWidth={1} />
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
