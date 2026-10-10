// The engine works in feet with x east, y north and z up. three.js puts y up.
// Every engine-space object sits inside one group with this rotation, which
// maps engine (x, y, z) to three (x, z, -y).
export const ENGINE_TO_THREE: [number, number, number] = [-Math.PI / 2, 0, 0];

export function engineToThree([x, y, z]: readonly [number, number, number]): [number, number, number] {
  return [x, z, -y];
}
