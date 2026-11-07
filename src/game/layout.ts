import type { Box } from "./collision";

// The apartment, in metres. x runs west→east, z runs north→south; the floor is y = 0.
// `render: false` = an invisible collider for a 3D model drawn elsewhere (Flat.tsx).
export type Solid = Box & {
  h: number;
  y0?: number;
  render?: boolean;
  kind?: "wall" | "door" | "fixture";
};

export const WALL_H = 2.8;

export const WINDOW = { minX: 3.3, maxX: 4.5, y0: 0.95, y1: 2.25 };

export const SOLIDS: Solid[] = [
  // North wall, split around the window so the sun and the city view come in
  {
    minX: 0,
    maxX: WINDOW.minX,
    minZ: -0.05,
    maxZ: 0.05,
    h: WALL_H,
    kind: "wall",
  },
  {
    minX: WINDOW.maxX,
    maxX: 7.5,
    minZ: -0.05,
    maxZ: 0.05,
    h: WALL_H,
    kind: "wall",
  },
  {
    minX: WINDOW.minX,
    maxX: WINDOW.maxX,
    minZ: -0.05,
    maxZ: 0.05,
    h: WINDOW.y0,
    kind: "wall",
  },
  {
    minX: WINDOW.minX,
    maxX: WINDOW.maxX,
    minZ: -0.05,
    maxZ: 0.05,
    h: WALL_H - WINDOW.y1,
    y0: WINDOW.y1,
    kind: "wall",
  },
  // Other outer walls (front door gap on the east wall, z 3.4–4.6)
  { minX: 0, maxX: 7.5, minZ: 4.95, maxZ: 5.05, h: WALL_H, kind: "wall" },
  { minX: -0.05, maxX: 0.05, minZ: 0, maxZ: 5, h: WALL_H, kind: "wall" },
  { minX: 7.45, maxX: 7.55, minZ: 0, maxZ: 3.4, h: WALL_H, kind: "wall" },
  { minX: 7.45, maxX: 7.55, minZ: 4.6, maxZ: 5, h: WALL_H, kind: "wall" },
  { minX: 7.38, maxX: 7.45, minZ: 3.4, maxZ: 4.6, h: 2.1, kind: "door" },
  // Bathroom walls (door gap z 1.4–2.3)
  { minX: 4.95, maxX: 5.05, minZ: 0, maxZ: 1.4, h: WALL_H, kind: "wall" },
  { minX: 4.95, maxX: 5.05, minZ: 2.3, maxZ: 2.55, h: WALL_H, kind: "wall" },
  { minX: 4.95, maxX: 7.5, minZ: 2.45, maxZ: 2.55, h: WALL_H, kind: "wall" },
  { minX: 5.9, maxX: 6.7, minZ: 0.1, maxZ: 0.6, h: 0.85, kind: "fixture" }, // bathroom sink
  // Colliders for furniture models
  { minX: 0.1, maxX: 2.1, minZ: 0.1, maxZ: 1.75, h: 1.0, render: false }, // iron bed
  { minX: 2.21, maxX: 2.79, minZ: 0.11, maxZ: 0.53, h: 0.7, render: false }, // nightstand
  { minX: 0.1, maxX: 0.74, minZ: 3.05, maxZ: 4.35, h: 0.76, render: false }, // desk
  { minX: 0.8, maxX: 1.3, minZ: 3.45, maxZ: 3.95, h: 1.0, render: false }, // chair
  { minX: 0.9, maxX: 1.9, minZ: 4.68, maxZ: 4.95, h: 2.0, render: false }, // shelf
  { minX: 2.72, maxX: 3.28, minZ: 4.28, maxZ: 4.95, h: 0.9, render: false }, // stove
  { minX: 3.43, maxX: 4.57, minZ: 4.45, maxZ: 4.95, h: 1.9, render: false }, // kitchen cabinet
];

export const BOXES: Box[] = SOLIDS;

export const SPAWN = { x: 2.6, z: 2.4, eye: 1.6 };

export const MIRROR = { x: 6.3, y: 1.5, z: 0.06, w: 0.9, h: 0.7 };

export const BATHROOM = { minX: 5, maxX: 7.5, minZ: 0, maxZ: 2.5 };

export type Interactable = { id: string; x: number; z: number; label: string };

export const INTERACTABLES: Interactable[] = [
  { id: "bed", x: 1.1, z: 1.0, label: "Sleep until morning" },
  { id: "kitchen", x: 3.0, z: 4.2, label: "Cook a meal (₹120)" },
  { id: "mirror", x: 6.3, z: 0.6, label: "Look in the mirror" },
  { id: "laptop", x: 0.45, z: 3.7, label: "Use laptop" },
  { id: "door", x: 7.4, z: 4.0, label: "Go outside" },
];
