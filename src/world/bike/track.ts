// The Mistgiri Hills stunt track: one winding valley road described by distance s (metres)
// and a sideways offset l from the centre line. Everything (road, ramps, scenery, physics)
// uses the same functions, so the bike always rides exactly on what you see.

export const LENGTH = 1500;
export const HALF_ROAD = 3.4;
export const CHECKPOINTS = [0, 330, 700, 1060]; // respawn points (always on flat road, never on a ramp)

export const centreX = (s: number) =>
  14 * Math.sin(s / 90) + 5 * Math.sin(s / 37);
export const heading = (s: number) =>
  Math.atan((centreX(s + 1) - centreX(s - 1)) / 2);
/** Road height: gentle rolling hills that climb towards the viewpoint. */
export const roadY = (s: number) =>
  3 * Math.sin(s / 120) +
  1.6 * Math.sin(s / 53 + 1) +
  Math.max(0, s - 200) * 0.012;

/** World position of a point at distance s, offset l (right is +), height y. */
export function toWorld(
  s: number,
  l: number,
  y: number,
): [number, number, number] {
  const h = heading(s);
  return [centreX(s) + l * Math.cos(h), y, -s + l * Math.sin(h)];
}

export type Ramp = { s: number; len: number; h: number };
// Kickers: the bike rides up the face and launches off the lip at s + len.
export const RAMPS: Ramp[] = [
  { s: 110, len: 9, h: 1.8 },
  { s: 230, len: 11, h: 3.2 },
  { s: 400, len: 10, h: 2.6 },
  { s: 520, len: 12, h: 4.2 },
  { s: 640, len: 10, h: 2.4 },
  { s: 790, len: 12, h: 4.0 },
  { s: 910, len: 10, h: 2.8 },
  { s: 1000, len: 9, h: 2.0 },
  { s: 1150, len: 12, h: 4.4 },
  { s: 1270, len: 10, h: 3.0 },
  { s: 1370, len: 14, h: 5.6 },
];

/** Ground height under the bike (road + ramps). Ramps only cover the road surface. */
export function groundY(s: number, l: number) {
  let y = roadY(s);
  if (Math.abs(l) <= HALF_ROAD)
    for (const r of RAMPS)
      if (s >= r.s && s < r.s + r.len) y += (r.h * (s - r.s)) / r.len;
  return y;
}
export const groundSlope = (s: number, l: number) =>
  (groundY(s + 0.05, l) - groundY(s - 0.05, l)) / 0.1;

/** Terrain height either side of the road: a valley whose walls rise into hills. */
export function terrainY(s: number, l: number) {
  const a = Math.abs(l);
  const t = Math.min(1, Math.max(0, (a - HALF_ROAD - 2) / 40));
  const k = t * t * (3 - 2 * t);
  const hills =
    7 * (1 + Math.sin(s / 41 + l / 23)) +
    4 * (1 + Math.sin(s / 17 - l / 11) * Math.cos(l / 29)) +
    Math.max(0, a - 30) * 0.35;
  return roadY(s) - 0.12 + k * hills;
}

/** Seeded random so every ride has the same layout. */
export function seeded(seed: number) {
  return () => (seed = (seed * 16807) % 2147483647) / 2147483647;
}

export const GRAVITY = 15;

export type Pickup = {
  s: number;
  l: number;
  y: number;
  kind: "coin" | "boost";
};

export function pickups(): Pickup[] {
  const out: Pickup[] = [];
  const rnd = seeded(11);
  // Arcs of coins along the line a full-speed jump takes off each ramp.
  for (const r of RAMPS) {
    const v = 23;
    const slope = r.h / r.len;
    const vy = v * slope;
    const lip = r.s + r.len;
    const y0 = roadY(lip) + r.h;
    for (let i = 1; i <= 5; i++) {
      const t = i * 0.22;
      out.push({
        s: lip + v * t,
        l: 0,
        y: y0 + vy * t - (GRAVITY * t * t) / 2 + 0.7,
        kind: "coin",
      });
    }
  }
  // Short lines of coins on the road between ramps, weaving left and right.
  for (let s = 60; s < LENGTH - 40; s += 70) {
    if (RAMPS.some((r) => s > r.s - 15 && s < r.s + r.len + 45)) continue;
    const l = (rnd() - 0.5) * 2 * (HALF_ROAD - 1);
    for (let i = 0; i < 4; i++)
      out.push({ s: s + i * 4, l, y: roadY(s + i * 4) + 0.8, kind: "coin" });
  }
  // Boost pads a little before some of the big ramps.
  for (const i of [1, 3, 5, 8, 10]) {
    const s = RAMPS[i].s - 22;
    out.push({ s, l: 0, y: roadY(s) + 0.05, kind: "boost" });
  }
  return out;
}
