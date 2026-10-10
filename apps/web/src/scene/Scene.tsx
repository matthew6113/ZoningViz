import { Edges, Html, Line, OrbitControls, PerspectiveCamera } from "@react-three/drei";
import { Canvas } from "@react-three/fiber";
import { projectMultiPolygon, type Dimension, type Floor, type FrontCandidate, type Solid, type XY } from "@zoningviz/engine";
import type { SfBuilding } from "@zoningviz/jurisdictions/sf";
import { createContext, useContext, useEffect, useMemo, useRef, type RefObject } from "react";
import { ExtrudeGeometry, ShapeGeometry } from "three";
import type { StepView } from "../state/steps";
import { ENGINE_TO_THREE, engineToThree } from "./coords";
import { ringsToShape, ringToPoints, solidToGeometry } from "./geometry";
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
  view: StepView | null;
  floors: Floor[];
  /** Height of the starting block, used to frame the camera. */
  frameHeightFt: number;
}

// drei's <Html> re-creates its React root when the canvas's event target
// changes, which can leave labels empty. Pinning every label to one wrapper
// element (its `portal`) keeps the target stable.
const LabelLayer = createContext<RefObject<HTMLDivElement | null> | null>(null);

export function Scene(props: SceneProps) {
  const { outline, frameHeightFt, front } = props;
  const framing = useMemo(() => frame(outline, front?.outward ?? null, frameHeightFt), [outline, front, frameHeightFt]);
  const labels = useRef<HTMLDivElement>(null);

  return (
    <div className="scene" ref={labels}>
    <LabelLayer.Provider value={labels}>
    <Canvas className="scene-canvas" dpr={[1, 2]} gl={{ antialias: true, preserveDrawingBuffer: true }} data-testid="scene">
      <color attach="background" args={["#f7f6f2"]} />
      <hemisphereLight args={["#ffffff", "#d9d3c4", 1.6]} />
      <directionalLight position={engineToThree([-0.6 * framing.distance, -0.8 * framing.distance, framing.distance])} intensity={1.6} />
      <PerspectiveCamera key={framing.key} makeDefault fov={35} near={1} far={50_000} position={framing.camera} />
      <OrbitControls key={`c${framing.key}`} makeDefault target={framing.target} maxPolarAngle={Math.PI / 2 - 0.04} />
      <group rotation={ENGINE_TO_THREE}>
        <Ground radius={framing.distance * 3} />
        <LotLines outline={outline} neighbors={props.neighborLots} front={front} />
        <Buildings buildings={props.buildings} projection={props.projection} origin={props.originPlanar} />
        {props.candidates && <FrontSides candidates={props.candidates} />}
        {props.view && <StepSolids view={props.view} />}
        {props.view?.kind === "rule" && <Dimensions dimensions={props.view.dimensions} />}
        {props.view?.kind === "finale" && <Floors floors={props.floors} />}
      </group>
    </Canvas>
    </LabelLayer.Provider>
    </div>
  );
}

function Label({ position, className, children }: { position: [number, number, number]; className: string; children: React.ReactNode }) {
  const portal = useContext(LabelLayer);
  return (
    <Html position={position} center className={className} zIndexRange={[10, 0]} portal={(portal ?? undefined) as RefObject<HTMLElement> | undefined}>
      {children}
    </Html>
  );
}

/** A three-quarter view from the street side, far enough back to see the whole block. */
function frame(outline: XY[][][], outward: XY | null, heightFt: number) {
  const radius = Math.max(10, ...outline.flat(2).map(([x, y]) => Math.hypot(x, y)));
  const [ox, oy] = outward ?? [0, -1];
  const turn = (35 * Math.PI) / 180;
  const dx = ox * Math.cos(turn) - oy * Math.sin(turn);
  const dy = ox * Math.sin(turn) + oy * Math.cos(turn);
  const distance = Math.max(radius * 3.4, heightFt * 2.2, 80);
  const elevation = (30 * Math.PI) / 180;
  const target: [number, number, number] = [0, 0, heightFt * 0.3];
  const camera: [number, number, number] = [
    dx * distance * Math.cos(elevation),
    dy * distance * Math.cos(elevation),
    target[2] + distance * Math.sin(elevation),
  ];
  return {
    key: `${radius.toFixed(1)}:${heightFt}:${ox.toFixed(3)}:${oy.toFixed(3)}`,
    distance,
    camera: engineToThree(camera),
    target: engineToThree(target),
  };
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
        s.heightFt && s.heightFt > 0
          ? new ExtrudeGeometry(ringsToShape(s.rings), { depth: s.heightFt, bevelEnabled: false })
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

function SolidMesh({ solid, color, edge, opacity }: { solid: Solid; color: string; edge: string; opacity: number }) {
  const geometry = useMemo(() => solidToGeometry(solid), [solid]);
  useEffect(() => () => geometry.dispose(), [geometry]);
  const translucent = opacity < 1;
  return (
    <mesh geometry={geometry}>
      <meshStandardMaterial color={color} transparent={translucent} opacity={opacity} depthWrite={!translucent} flatShading />
      <Edges threshold={15} color={edge} />
    </mesh>
  );
}

function StepSolids({ view }: { view: StepView }) {
  switch (view.kind) {
    case "start":
      return <SolidMesh solid={view.envelope} color={COLORS.start} edge={COLORS.envelopeEdge} opacity={0.35} />;
    case "rule":
      return (
        <>
          <SolidMesh solid={view.envelope} color={COLORS.envelope} edge={COLORS.envelopeEdge} opacity={0.6} />
          {view.removed && <SolidMesh solid={view.removed} color={COLORS.removed} edge={COLORS.removedEdge} opacity={0.6} />}
        </>
      );
    case "finale":
      return <SolidMesh solid={view.envelope} color={COLORS.envelope} edge={COLORS.envelopeEdge} opacity={0.82} />;
  }
}

function Dimensions({ dimensions }: { dimensions: Dimension[] }) {
  return (
    <group>
      {dimensions.map((d, i) => {
        const mid: [number, number, number] = [(d.from[0] + d.to[0]) / 2, (d.from[1] + d.to[1]) / 2, (d.from[2] + d.to[2]) / 2];
        return (
          <group key={i}>
            <Line points={[d.from, d.to]} color={COLORS.ink} lineWidth={2} />
            <Label position={mid} className="dimension-label">
              {d.label}
            </Label>
          </group>
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

function Floors({ floors }: { floors: Floor[] }) {
  const plates = useMemo(
    () => floors.map((f) => ({ floor: f, geometry: new ShapeGeometry(f.outline.map((ring) => ringsToShape([ring]))) })),
    [floors],
  );
  useEffect(() => () => plates.forEach((p) => p.geometry.dispose()), [plates]);
  return (
    <group>
      {plates.map(({ floor, geometry }) => (
        <group key={floor.index} position={[0, 0, floor.bottomFt + 0.15]}>
          <mesh geometry={geometry}>
            <meshStandardMaterial color={COLORS.floor} transparent opacity={0.5} depthWrite={false} />
          </mesh>
          {floor.outline.map((ring, i) => (
            <Line key={i} points={ringToPoints(ring)} color={COLORS.envelopeEdge} lineWidth={1.5} />
          ))}
        </group>
      ))}
    </group>
  );
}

export function sideName(index: number): string {
  return `Side ${String.fromCharCode(65 + index)}`;
}
