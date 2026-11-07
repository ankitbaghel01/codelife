export type Box = { minX: number; maxX: number; minZ: number; maxZ: number };

/** Push a circle (the player) out of every box it overlaps. Returns the corrected x/z. */
export function resolve(
  x: number,
  z: number,
  r: number,
  boxes: Box[],
): [number, number] {
  for (const b of boxes) {
    const cx = Math.max(b.minX, Math.min(x, b.maxX));
    const cz = Math.max(b.minZ, Math.min(z, b.maxZ));
    const dx = x - cx;
    const dz = z - cz;
    const d2 = dx * dx + dz * dz;
    if (d2 >= r * r) continue;
    if (d2 > 1e-9) {
      const d = Math.sqrt(d2);
      x = cx + (dx / d) * r;
      z = cz + (dz / d) * r;
    } else {
      // Centre is inside the box: leave by the nearest side.
      const exits = [x - b.minX, b.maxX - x, z - b.minZ, b.maxZ - z];
      const i = exits.indexOf(Math.min(...exits));
      if (i === 0) x = b.minX - r;
      else if (i === 1) x = b.maxX + r;
      else if (i === 2) z = b.minZ - r;
      else z = b.maxZ + r;
    }
  }
  return [x, z];
}

/** How far a camera can sit from (x, z) along direction (dx, dz) before touching a box. */
export function boomLength(x: number, z: number, dx: number, dz: number, max: number, boxes: Box[], pad = 0.2): number {
  const len = Math.hypot(dx, dz) || 1;
  const ux = dx / len;
  const uz = dz / len;
  for (let t = 0.05; t <= max; t += 0.05) {
    const px = x + ux * t;
    const pz = z + uz * t;
    if (boxes.some((b) => px > b.minX - pad && px < b.maxX + pad && pz > b.minZ - pad && pz < b.maxZ + pad)) {
      return Math.max(0, t - 0.05);
    }
  }
  return max;
}
