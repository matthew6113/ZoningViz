import type { Solid } from "@zoningviz/engine";
import { BufferAttribute, BufferGeometry, Shape, Vector2 } from "three";

/** An engine solid as a three.js geometry (engine coordinates; place it inside the ENGINE_TO_THREE group). */
export function solidToGeometry(solid: Solid): BufferGeometry {
  const geometry = new BufferGeometry();
  geometry.setAttribute("position", new BufferAttribute(solid.positions, 3));
  geometry.setIndex(new BufferAttribute(solid.indices, 1));
  geometry.computeVertexNormals();
  geometry.computeBoundingSphere();
  return geometry;
}

/** Polygon rings (outer first, then holes) as a three.js Shape. */
export function ringsToShape(rings: readonly (readonly (readonly [number, number])[])[]): Shape {
  const [outer, ...holes] = rings;
  const shape = new Shape((outer ?? []).map(([x, y]) => new Vector2(x, y)));
  for (const hole of holes) shape.holes.push(new Shape(hole.map(([x, y]) => new Vector2(x, y))));
  return shape;
}

/** Closes a ring for drawing as a line loop, lifted to height z. */
export function ringToPoints(ring: readonly (readonly [number, number])[], z = 0): [number, number, number][] {
  const points = ring.map(([x, y]) => [x, y, z] as [number, number, number]);
  if (points.length) points.push(points[0]!);
  return points;
}
