import { Html, Line } from "@react-three/drei";
import { useFrame } from "@react-three/fiber";
import type { Floor, Solid } from "@zoningviz/engine";
import { useContext, useEffect, useMemo, useRef, type RefObject } from "react";
import {
  BufferAttribute,
  BufferGeometry,
  Color,
  DoubleSide,
  EdgesGeometry,
  Group,
  LineBasicMaterial,
  LineSegments,
  Mesh,
  MeshStandardMaterial,
  ShapeGeometry,
} from "three";
import type { Line2 } from "three/examples/jsm/lines/Line2.js";
import { ENVELOPE_OPACITY, type AnimState } from "../anim/timeline";
import type { OkResult } from "../state/steps";
import { ringsToShape, ringToPoints, solidToGeometry } from "./geometry";
import { LabelLayer } from "./labels";
import { COLORS } from "./palette";

// Everything here is driven imperatively from the timeline's state object in
// useFrame, so playback never re-renders React. Every step's geometry is
// built once up front; the active rule just swaps which geometry is shown.

const FINAL_OPACITY = 0.85;
const PLANE_OPACITY = 0.35;
const FLOOR_OPACITY = 0.5;

const envelopeColor = new Color(COLORS.envelope);
const removedColor = new Color(COLORS.removed);
const envelopeEdge = new Color(COLORS.envelopeEdge);
const removedEdge = new Color(COLORS.removedEdge);

interface SolidGeometry {
  surface: BufferGeometry;
  edges: EdgesGeometry;
}

export function AnimatedEnvelope({ result, anim }: { result: OkResult; anim: AnimState }) {
  // One geometry pair per distinct solid (steps that cut nothing share their neighbor's solid).
  const geometries = useMemo(() => {
    const cache = new Map<Solid, SolidGeometry>();
    const get = (solid: Solid) => {
      let g = cache.get(solid);
      if (!g) {
        const surface = solidToGeometry(solid);
        g = { surface, edges: new EdgesGeometry(surface, 15) };
        cache.set(solid, g);
      }
      return g;
    };
    return {
      start: get(result.start),
      final: get(result.final),
      after: result.steps.map((s) => get(s.after)),
      removed: result.steps.map((s) => (s.removed ? get(s.removed) : null)),
      all: cache,
    };
  }, [result]);
  useEffect(
    () => () => geometries.all.forEach((g) => (g.surface.dispose(), g.edges.dispose())),
    [geometries],
  );

  const materials = useMemo(
    () => ({
      start: new MeshStandardMaterial({ color: COLORS.start, transparent: true, depthWrite: false, flatShading: true }),
      envelope: new MeshStandardMaterial({ color: COLORS.envelope, transparent: true, depthWrite: false, flatShading: true }),
      removed: new MeshStandardMaterial({ color: COLORS.envelope, transparent: true, depthWrite: false, flatShading: true }),
      edge: new LineBasicMaterial({ color: COLORS.envelopeEdge, transparent: true }),
      removedEdge: new LineBasicMaterial({ color: COLORS.envelopeEdge, transparent: true }),
    }),
    [],
  );
  useEffect(() => () => Object.values(materials).forEach((m) => m.dispose()), [materials]);

  const start = useRef<Mesh>(null);
  const startEdges = useRef<LineSegments>(null);
  const envelope = useRef<Mesh>(null);
  const envelopeEdges = useRef<LineSegments>(null);
  const removed = useRef<Group>(null);
  const removedMesh = useRef<Mesh>(null);
  const removedEdges = useRef<LineSegments>(null);

  useFrame(() => {
    const inFinale = anim.finale > 0;
    const onStart = anim.rule < 0 && !inFinale;
    const rule = Math.max(anim.rule, 0);

    start.current!.visible = startEdges.current!.visible = onStart;
    start.current!.scale.z = startEdges.current!.scale.z = Math.max(anim.rise, 1e-3);
    materials.start.opacity = anim.startOpacity;

    const shown = inFinale ? geometries.final : onStart ? null : geometries.after[rule]!;
    envelope.current!.visible = envelopeEdges.current!.visible = shown !== null;
    if (shown) {
      envelope.current!.geometry = shown.surface;
      envelopeEdges.current!.geometry = shown.edges;
    }
    materials.envelope.opacity = inFinale ? ENVELOPE_OPACITY + (FINAL_OPACITY - ENVELOPE_OPACITY) * anim.finale : ENVELOPE_OPACITY;

    const cut = !onStart && !inFinale ? geometries.removed[rule] : null;
    removed.current!.visible = cut !== null && cut !== undefined && anim.removedOpacity > 0.001;
    if (cut) {
      removedMesh.current!.geometry = cut.surface;
      removedEdges.current!.geometry = cut.edges;
      removed.current!.position.z = anim.lift;
      materials.removed.color.lerpColors(envelopeColor, removedColor, anim.tint);
      materials.removed.opacity = anim.removedOpacity;
      materials.removedEdge.color.lerpColors(envelopeEdge, removedEdge, anim.tint);
      materials.removedEdge.opacity = anim.removedOpacity / ENVELOPE_OPACITY;
    }
  });

  return (
    <group>
      <mesh ref={start} geometry={geometries.start.surface} material={materials.start} />
      <lineSegments ref={startEdges} geometry={geometries.start.edges} material={materials.edge} />
      <mesh ref={envelope} material={materials.envelope} />
      <lineSegments ref={envelopeEdges} material={materials.edge} />
      <group ref={removed}>
        <mesh ref={removedMesh} material={materials.removed} />
        <lineSegments ref={removedEdges} material={materials.removedEdge} />
      </group>
    </group>
  );
}

/** The cutting plane: it sweeps along the boundary of the active rule's cut. */
export function CuttingPlanes({ result, anim }: { result: OkResult; anim: AnimState }) {
  const slots = Math.max(0, ...result.steps.map((s) => s.cutPlanes.length));
  const meshes = useRef<(Mesh | null)[]>([]);
  const geometries = useMemo(
    () =>
      Array.from({ length: slots }, () => {
        const g = new BufferGeometry();
        g.setAttribute("position", new BufferAttribute(new Float32Array(12), 3));
        g.setIndex([0, 1, 2, 0, 2, 3]);
        return g;
      }),
    [slots],
  );
  const material = useMemo(
    () => new MeshStandardMaterial({ color: COLORS.cuttingPlane, transparent: true, depthWrite: false, side: DoubleSide }),
    [],
  );
  useEffect(() => () => (geometries.forEach((g) => g.dispose()), material.dispose()), [geometries, material]);

  useFrame(() => {
    const step = anim.rule >= 0 && anim.finale === 0 ? result.steps[anim.rule] : undefined;
    const planes = step?.cutPlanes ?? [];
    material.opacity = PLANE_OPACITY * anim.planeOpacity;
    geometries.forEach((g, i) => {
      const mesh = meshes.current[i];
      const plane = planes[i];
      if (!mesh) return;
      mesh.visible = !!plane && anim.planeOpacity > 0.001;
      if (!plane) return;
      const { origin: o, u, v } = plane;
      const s = anim.sweep;
      const p = g.getAttribute("position") as BufferAttribute;
      p.setXYZ(0, o[0], o[1], o[2]);
      p.setXYZ(1, o[0] + u[0] * s, o[1] + u[1] * s, o[2] + u[2] * s);
      p.setXYZ(2, o[0] + u[0] * s + v[0], o[1] + u[1] * s + v[1], o[2] + u[2] * s + v[2]);
      p.setXYZ(3, o[0] + v[0], o[1] + v[1], o[2] + v[2]);
      p.needsUpdate = true;
      g.computeVertexNormals();
      g.computeBoundingSphere();
    });
  });

  return (
    <group>
      {geometries.map((g, i) => (
        <mesh key={i} ref={(m) => void (meshes.current[i] = m)} geometry={g} material={material} visible={false} />
      ))}
    </group>
  );
}

/** Dimension lines that draw themselves, with their labels fading in at the end. */
export function AnimatedDimensions({ result, anim }: { result: OkResult; anim: AnimState }) {
  const slots = Math.max(0, ...result.steps.map((s) => s.dimensions.length));
  const lines = useRef<(Line2 | null)[]>([]);
  const labelGroups = useRef<(Group | null)[]>([]);
  const labelTexts = useRef<(HTMLSpanElement | null)[]>([]);
  const portal = useContext(LabelLayer);

  useFrame(() => {
    const step = anim.rule >= 0 && anim.finale === 0 ? result.steps[anim.rule] : undefined;
    const dims = step?.dimensions ?? [];
    for (let i = 0; i < slots; i++) {
      const line = lines.current[i];
      const group = labelGroups.current[i];
      const text = labelTexts.current[i];
      const d = dims[i];
      const show = !!d && anim.measure > 0.001;
      if (line) {
        line.visible = show;
        if (d && show) {
          const m = anim.measure;
          const end = [0, 1, 2].map((k) => d.from[k]! + (d.to[k]! - d.from[k]!) * m);
          line.geometry.setPositions([d.from[0], d.from[1], d.from[2] + 0.1, end[0]!, end[1]!, end[2]! + 0.1]);
        }
      }
      if (group && text) {
        const visible = !!d && anim.labelOpacity > 0.001;
        text.style.opacity = visible ? String(anim.labelOpacity) : "0";
        if (d) {
          group.position.set((d.from[0] + d.to[0]) / 2, (d.from[1] + d.to[1]) / 2, (d.from[2] + d.to[2]) / 2 + 0.1);
          if (text.textContent !== d.label) text.textContent = d.label;
        }
      }
    }
  });

  return (
    <group>
      {Array.from({ length: slots }, (_, i) => (
        <group key={i}>
          <Line
            ref={(l) => void (lines.current[i] = l as unknown as Line2 | null)}
            points={[
              [0, 0, 0],
              [0, 0, 0],
            ]}
            color={COLORS.ink}
            lineWidth={2}
            visible={false}
          />
          <group ref={(g) => void (labelGroups.current[i] = g)}>
            <Html center zIndexRange={[10, 0]} portal={(portal ?? undefined) as RefObject<HTMLElement> | undefined}>
              <span className="dimension-label" ref={(s) => void (labelTexts.current[i] = s)} style={{ opacity: 0 }} />
            </Html>
          </group>
        </group>
      ))}
    </group>
  );
}

/** Floor slices appearing one by one from the ground up during the finale. */
export function AnimatedFloors({ floors, anim }: { floors: Floor[]; anim: AnimState }) {
  const plates = useMemo(
    () =>
      floors.map((f) => ({
        floor: f,
        geometry: new ShapeGeometry(f.outline.map((ring) => ringsToShape([ring]))),
        material: new MeshStandardMaterial({ color: COLORS.floor, transparent: true, depthWrite: false, opacity: 0 }),
      })),
    [floors],
  );
  useEffect(() => () => plates.forEach((p) => (p.geometry.dispose(), p.material.dispose())), [plates]);
  const groups = useRef<(Group | null)[]>([]);
  const outlines = useRef<(Line2 | null)[][]>([]);

  useFrame(() => {
    plates.forEach((p, i) => {
      const reveal = Math.min(Math.max(anim.floors - i, 0), 1);
      const group = groups.current[i];
      if (group) group.visible = reveal > 0.001;
      p.material.opacity = FLOOR_OPACITY * reveal;
      for (const line of outlines.current[i] ?? []) {
        if (line) {
          line.material.opacity = reveal;
          line.material.transparent = true;
        }
      }
    });
  });

  return (
    <group>
      {plates.map(({ floor, geometry, material }, i) => (
        <group key={floor.index} ref={(g) => void (groups.current[i] = g)} position={[0, 0, floor.bottomFt + 0.15]} visible={false}>
          <mesh geometry={geometry} material={material} />
          {floor.outline.map((ring, j) => (
            <Line
              key={j}
              ref={(l) => {
                (outlines.current[i] ??= [])[j] = l as unknown as Line2 | null;
              }}
              points={ringToPoints(ring)}
              color={COLORS.envelopeEdge}
              lineWidth={1.5}
            />
          ))}
        </group>
      ))}
    </group>
  );
}
