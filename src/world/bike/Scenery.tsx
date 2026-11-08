// Everything static along the Mistgiri Hills road: sky, valley terrain, road, ramps, trees,
// rocks, distant hills, checkpoint gates and the finish arch. Repeated things are instanced.
import { useLayoutEffect, useMemo, useRef } from "react";
import {
  BackSide,
  BufferGeometry,
  CanvasTexture,
  Color,
  ConeGeometry,
  CylinderGeometry,
  ExtrudeGeometry,
  Float32BufferAttribute,
  InstancedMesh,
  Object3D,
  RepeatWrapping,
  Shape,
  SRGBColorSpace,
} from "three";
import {
  CHECKPOINTS,
  HALF_ROAD,
  LENGTH,
  RAMPS,
  heading,
  roadY,
  seeded,
  terrainY,
  toWorld,
} from "./track";

export const HORIZON = "#f3c08f";
export const SUN_DIR: [number, number, number] = [-0.45, 0.32, -0.83];

function canvasTex(
  w: number,
  h: number,
  draw: (c: CanvasRenderingContext2D) => void,
) {
  const cv = document.createElement("canvas");
  cv.width = w;
  cv.height = h;
  draw(cv.getContext("2d")!);
  const t = new CanvasTexture(cv);
  t.colorSpace = SRGBColorSpace;
  t.anisotropy = 4;
  return t;
}

/** A ribbon following the road between offsets l0..l1, lifted y above the road. */
function strip(
  l0: number,
  l1: number,
  y: number,
  s0 = -60,
  s1 = LENGTH + 160,
  step = 2,
) {
  const pos: number[] = [];
  const uv: number[] = [];
  const idx: number[] = [];
  let i = 0;
  for (let s = s0; s <= s1; s += step, i++) {
    pos.push(...toWorld(s, l0, roadY(s) + y), ...toWorld(s, l1, roadY(s) + y));
    uv.push(0, s / 8, 1, s / 8);
    if (i) idx.push(2 * i - 2, 2 * i - 1, 2 * i, 2 * i - 1, 2 * i + 1, 2 * i);
  }
  const g = new BufferGeometry();
  g.setAttribute("position", new Float32BufferAttribute(pos, 3));
  g.setAttribute("uv", new Float32BufferAttribute(uv, 2));
  g.setIndex(idx);
  g.computeVertexNormals();
  return g;
}

function terrain() {
  const cols = [
    -150, -110, -80, -58, -42, -30, -21, -14, -9, -6.2, -4.6, 0, 4.6, 6.2, 9,
    14, 21, 30, 42, 58, 80, 110, 150,
  ];
  const pos: number[] = [];
  const col: number[] = [];
  const idx: number[] = [];
  const grass = new Color("#7a8f3c");
  const dry = new Color("#b49a55");
  const dark = new Color("#4d6b2c");
  const dirt = new Color("#9c7a52");
  const c = new Color();
  let row = 0;
  for (let s = -80; s <= LENGTH + 220; s += 5, row++) {
    for (const l of cols) {
      const y = terrainY(s, l);
      pos.push(...toWorld(s, l, y));
      const n =
        0.5 + 0.5 * Math.sin(s / 13 + l / 7) * Math.cos(l / 19 - s / 31);
      c.copy(grass)
        .lerp(dry, n * 0.7)
        .lerp(dark, Math.max(0, Math.sin(s / 29 + l / 13)) * 0.5);
      if (Math.abs(l) < 7) c.lerp(dirt, 0.8);
      col.push(c.r, c.g, c.b);
    }
    if (row) {
      const n = cols.length;
      for (let k = 0; k < n - 1; k++) {
        const a = (row - 1) * n + k;
        const b = row * n + k;
        idx.push(a, a + 1, b, a + 1, b + 1, b);
      }
    }
  }
  const g = new BufferGeometry();
  g.setAttribute("position", new Float32BufferAttribute(pos, 3));
  g.setAttribute("color", new Float32BufferAttribute(col, 3));
  g.setIndex(idx);
  g.computeVertexNormals();
  return g;
}



function Sky() {
  const geo = useMemo(() => {
    const top = new Color("#7f9fc4");
    const mid = new Color("#f2c79a");
    const hor = new Color(HORIZON);
    const below = new Color("#c89a6a");
    const pos: number[] = [];
    const col: number[] = [];
    const idx: number[] = [];
    const W = 32;
    const H = 16;
    for (let j = 0; j <= H; j++) {
      const v = j / H;
      const th = v * Math.PI;
      const y = Math.cos(th);
      const c = new Color();
      if (y > 0.25) c.copy(mid).lerp(top, Math.min(1, (y - 0.25) / 0.6));
      else if (y > 0) c.copy(hor).lerp(mid, y / 0.25);
      else c.copy(hor).lerp(below, Math.min(1, -y * 3));
      for (let i = 0; i <= W; i++) {
        const ph = (i / W) * Math.PI * 2;
        pos.push(Math.sin(th) * Math.cos(ph), y, Math.sin(th) * Math.sin(ph));
        col.push(c.r, c.g, c.b);
        if (i < W && j < H) {
          const a = j * (W + 1) + i;
          idx.push(a, a + W + 1, a + 1, a + 1, a + W + 1, a + W + 2);
        }
      }
    }
    const g = new BufferGeometry();
    g.setAttribute("position", new Float32BufferAttribute(pos, 3));
    g.setAttribute("color", new Float32BufferAttribute(col, 3));
    g.setIndex(idx);
    return g;
  }, []);
  return (
    <group name="sky">
      <mesh geometry={geo} scale={380} renderOrder={-1}>
        <meshBasicMaterial
          vertexColors
          side={BackSide}
          fog={false}
          depthWrite={false}
        />
      </mesh>
      <mesh position={SUN_DIR.map((v) => v * 340) as [number, number, number]}>
        <sphereGeometry args={[14, 24, 16]} />
        <meshBasicMaterial
          color={[2.4, 1.7, 0.95]}
          fog={false}
          toneMapped={false}
        />
      </mesh>
      <mesh position={SUN_DIR.map((v) => v * 345) as [number, number, number]}>
        <sphereGeometry args={[30, 24, 16]} />
        <meshBasicMaterial
          color="#ffd9a0"
          transparent
          opacity={0.25}
          fog={false}
          depthWrite={false}
        />
      </mesh>
    </group>
  );
}

/** Instanced mesh helper: sets every instance matrix (and optional colour) once. */
function useInstances(
  ref: React.RefObject<InstancedMesh>,
  items: {
    p: [number, number, number];
    s: [number, number, number];
    r?: [number, number, number];
    c?: string;
  }[],
) {
  useLayoutEffect(() => {
    const m = ref.current;
    if (!m) return;
    const d = new Object3D();
    const c = new Color();
    items.forEach((it, i) => {
      d.position.set(...it.p);
      d.scale.set(...it.s);
      d.rotation.set(...(it.r ?? [0, 0, 0]));
      d.updateMatrix();
      m.setMatrixAt(i, d.matrix);
      if (it.c) m.setColorAt(i, c.set(it.c));
    });
    m.instanceMatrix.needsUpdate = true;
    if (m.instanceColor) m.instanceColor.needsUpdate = true;
    m.computeBoundingSphere();
  }, [ref, items]);
}

function Vegetation() {
  const data = useMemo(() => {
    const rnd = seeded(7);
    const trees: {
      p: [number, number, number];
      s: [number, number, number];
      c: string;
    }[] = [];
    const rocks: {
      p: [number, number, number];
      s: [number, number, number];
      r: [number, number, number];
      c: string;
    }[] = [];
    const greens = ["#2f6b34", "#3f7a37", "#4f7d2e", "#2a5a33", "#6a8a32"];
    for (let s = -40; s < LENGTH + 180; s += 3.2) {
      for (const side of [-1, 1]) {
        if (rnd() < 0.35) continue;
        const l = side * (HALF_ROAD + 5 + Math.pow(rnd(), 1.6) * 95);
        const sz = 0.8 + rnd() * 0.9;
        trees.push({
          p: toWorld(s + rnd() * 3, l, terrainY(s, l) - 0.1),
          s: [sz, sz * (0.9 + rnd() * 0.5), sz],
          c: greens[Math.floor(rnd() * greens.length)],
        });
      }
      if (rnd() < 0.45) {
        const side = rnd() < 0.5 ? -1 : 1;
        const l = side * (HALF_ROAD + 1.8 + rnd() * 30);
        const sz = 0.3 + rnd() * (Math.abs(l) > 12 ? 2.2 : 0.7);
        const shade = ["#8a8178", "#9b8f7f", "#7a7068"][Math.floor(rnd() * 3)];
        rocks.push({
          p: toWorld(s, l, terrainY(s, l)),
          s: [sz * 1.3, sz * 0.8, sz],
          r: [rnd() * 3, rnd() * 3, rnd() * 3],
          c: shade,
        });
      }
    }
    const peaks: {
      p: [number, number, number];
      s: [number, number, number];
      c: string;
    }[] = [];
    for (let i = 0; i < 46; i++) {
      const s = -100 + rnd() * (LENGTH + 500);
      const side = rnd() < 0.5 ? -1 : 1;
      const l = side * (170 + rnd() * 130);
      const sz = 50 + rnd() * 70;
      peaks.push({
        p: toWorld(s, l, roadY(s) - 5),
        s: [sz, sz * (0.6 + rnd() * 0.5), sz],
        c: ["#8f8a6a", "#a08a68", "#7d8a62", "#9a9078"][i % 4],
      });
    }
    return { trees, rocks, peaks };
  }, []);
  const geos = useMemo(
    () => ({
      trunk: new CylinderGeometry(0.13, 0.2, 2, 6).translate(0, 1, 0),
      crown: new ConeGeometry(1.35, 2.6, 7).translate(0, 2.9, 0),
      crown2: new ConeGeometry(0.95, 2.0, 7).translate(0, 4.1, 0),
      peak: new ConeGeometry(1, 1, 7).translate(0, 0.5, 0),
    }),
    [],
  );
  const trunks = useRef<InstancedMesh>(null);
  const crowns = useRef<InstancedMesh>(null);
  const crowns2 = useRef<InstancedMesh>(null);
  const rocks = useRef<InstancedMesh>(null);
  const peaks = useRef<InstancedMesh>(null);
  useInstances(trunks, data.trees);
  useInstances(crowns, data.trees);
  useInstances(crowns2, data.trees);
  useInstances(rocks, data.rocks);
  useInstances(peaks, data.peaks);
  const n = data.trees.length;
  return (
    <>
      <instancedMesh ref={trunks} args={[undefined, undefined, n]} castShadow>
        <primitive object={geos.trunk} attach="geometry" />
        <meshStandardMaterial color="#5b3a22" roughness={1} />
      </instancedMesh>
      <instancedMesh ref={crowns} args={[undefined, undefined, n]} castShadow>
        <primitive object={geos.crown} attach="geometry" />
        <meshStandardMaterial color="#ffffff" roughness={0.9} flatShading />
      </instancedMesh>
      <instancedMesh ref={crowns2} args={[undefined, undefined, n]} castShadow>
        <primitive object={geos.crown2} attach="geometry" />
        <meshStandardMaterial color="#ffffff" roughness={0.9} flatShading />
      </instancedMesh>
      <instancedMesh
        ref={rocks}
        args={[undefined, undefined, data.rocks.length]}
        castShadow
        receiveShadow
      >
        <dodecahedronGeometry args={[1, 0]} />
        <meshStandardMaterial color="#ffffff" roughness={0.95} flatShading />
      </instancedMesh>
      <instancedMesh
        ref={peaks}
        args={[undefined, undefined, data.peaks.length]}
      >
        <primitive object={geos.peak} attach="geometry" />
        <meshStandardMaterial color="#ffffff" roughness={1} flatShading />
      </instancedMesh>
    </>
  );
}

function Ramps() {
  const tex = useMemo(
    () =>
      canvasTex(128, 256, (c) => {
        c.fillStyle = "#b8743a";
        c.fillRect(0, 0, 128, 256);
        for (let y = 0; y < 256; y += 16) {
          c.fillStyle = y % 32 ? "#a9662f" : "#c27d40";
          c.fillRect(0, y, 128, 14);
        }
        // hazard stripes along the lip (top of the texture = far end)
        for (let x = -64; x < 160; x += 32) {
          c.fillStyle = "#f2b544";
          c.beginPath();
          c.moveTo(x, 0);
          c.lineTo(x + 16, 0);
          c.lineTo(x + 40, 36);
          c.lineTo(x + 24, 36);
          c.fill();
        }
        c.fillStyle = "#1a1714";
        c.globalCompositeOperation = "destination-over";
        c.fillRect(0, 0, 128, 36);
      }),
    [],
  );
  const side = useMemo(
    () =>
      canvasTex(128, 32, (c) => {
        c.fillStyle = "#1a1714";
        c.fillRect(0, 0, 128, 32);
        c.fillStyle = "#f2b544";
        for (let x = -32; x < 160; x += 24) {
          c.beginPath();
          c.moveTo(x, 32);
          c.lineTo(x + 12, 32);
          c.lineTo(x + 32, 0);
          c.lineTo(x + 20, 0);
          c.fill();
        }
      }),
    [],
  );
  side.wrapS = side.wrapT = RepeatWrapping;
  const W = HALF_ROAD * 2;
  return (
    <>
      {RAMPS.map((r) => {
        const shape = new Shape();
        shape.moveTo(0, 0);
        shape.lineTo(r.len, 0);
        shape.lineTo(r.len, r.h);
        shape.closePath();
        const g = new ExtrudeGeometry(shape, { depth: W, bevelEnabled: false });
        g.rotateY(Math.PI / 2);
        g.translate(-W / 2, 0, 0);
        const mid = r.s + r.len / 2;
        const base = roadY(r.s);
        const tilt = Math.atan((roadY(r.s + r.len) - base) / r.len);
        const a = Math.atan(r.h / r.len);
        return (
          <group
            key={r.s}
            position={toWorld(r.s, 0, base)}
            rotation={[tilt, -heading(mid), 0, "YXZ"]}
          >
            <mesh geometry={g} castShadow receiveShadow>
              <meshStandardMaterial map={side} roughness={0.8} />
            </mesh>
            <mesh
              position={[0, r.h / 2 + 0.02, -r.len / 2]}
              rotation={[-Math.PI / 2 + a, 0, 0]}
              receiveShadow
            >
              <planeGeometry args={[W, Math.hypot(r.len, r.h)]} />
              <meshStandardMaterial map={tex} roughness={0.85} />
            </mesh>
            {/* support legs under the lip */}
            {[-W / 2 + 0.3, W / 2 - 0.3].map((x) => (
              <mesh key={x} position={[x, r.h / 2, -r.len + 0.2]} castShadow>
                <boxGeometry args={[0.25, r.h, 0.25]} />
                <meshStandardMaterial color="#6b4a2a" />
              </mesh>
            ))}
          </group>
        );
      })}
    </>
  );
}

function bannerTex(text: string, sub: string) {
  return canvasTex(1024, 192, (c) => {
    c.fillStyle = "#1c1612";
    c.fillRect(0, 0, 1024, 192);
    for (let x = 0; x < 1024; x += 32)
      for (let y = 0; y < 2; y++) {
        c.fillStyle = (x / 32 + y) % 2 ? "#f5efe6" : "#1c1612";
        c.fillRect(x, y * 16, 32, 16);
        c.fillRect(x, 160 + y * 16, 32, 16);
      }
    c.fillStyle = "#f2b544";
    c.font = "bold 92px Impact, 'Bebas Neue', sans-serif";
    c.textAlign = "center";
    c.textBaseline = "middle";
    c.fillText(text, 512, 84);
    c.fillStyle = "#f5efe6";
    c.font = "bold 30px monospace";
    c.fillText(sub, 512, 140);
  });
}

function Gate({
  s,
  text,
  sub,
  finish,
}: {
  s: number;
  text: string;
  sub: string;
  finish?: boolean;
}) {
  const tex = useMemo(() => bannerTex(text, sub), [text, sub]);
  const span = HALF_ROAD + 1.2;
  const hgt = finish ? 6 : 4.6;
  return (
    <group position={toWorld(s, 0, roadY(s))} rotation={[0, -heading(s), 0]}>
      {[-span, span].map((x) => (
        <mesh key={x} position={[x, hgt / 2, 0]} castShadow>
          <cylinderGeometry
            args={finish ? [0.5, 0.6, hgt, 12] : [0.12, 0.14, hgt, 8]}
          />
          <meshStandardMaterial
            color={finish ? "#d9472b" : "#f5efe6"}
            roughness={0.6}
          />
        </mesh>
      ))}
      <mesh position={[0, hgt - 0.6, 0]} castShadow>
        <boxGeometry args={[span * 2 + (finish ? 1 : 0.4), 1.2, 0.18]} />
        <meshStandardMaterial attach="material-0" color="#1c1612" />
        <meshStandardMaterial attach="material-1" color="#1c1612" />
        <meshStandardMaterial attach="material-2" color="#1c1612" />
        <meshStandardMaterial attach="material-3" color="#1c1612" />
        <meshStandardMaterial
          attach="material-4"
          map={tex}
          emissiveMap={tex}
          emissive="#ffffff"
          emissiveIntensity={0.25}
        />
        <meshStandardMaterial attach="material-5" map={tex} />
      </mesh>
      {finish &&
        [-span - 1.6, span + 1.6].map((x) => (
          <group key={x} position={[x, 0, 0]}>
            <mesh position={[0, 2.2, 0]}>
              <cylinderGeometry args={[0.05, 0.05, 4.4, 6]} />
              <meshStandardMaterial
                color="#d8d4ce"
                metalness={0.8}
                roughness={0.3}
              />
            </mesh>
            <mesh position={[x > 0 ? 0.6 : -0.6, 3.9, 0]}>
              <boxGeometry args={[1.2, 0.7, 0.02]} />
              <meshStandardMaterial color="#f2b544" side={2} />
            </mesh>
          </group>
        ))}
    </group>
  );
}

function RoadMarkings() {
  const dashes = useRef<InstancedMesh>(null);
  const items = useMemo(() => {
    const out: {
      p: [number, number, number];
      s: [number, number, number];
      r: [number, number, number];
    }[] = [];
    for (let s = -40; s < LENGTH + 150; s += 7) {
      if (RAMPS.some((r) => s > r.s - 2 && s < r.s + r.len + 1)) continue;
      const slope = Math.atan((roadY(s + 1) - roadY(s - 1)) / 2);
      out.push({
        p: toWorld(s, 0, roadY(s) + 0.04),
        s: [1, 1, 1],
        r: [slope, -heading(s), 0],
      });
    }
    return out;
  }, []);
  useLayoutEffect(() => {
    const m = dashes.current;
    if (!m) return;
    const d = new Object3D();
    d.rotation.order = "YXZ";
    items.forEach((it, i) => {
      d.position.set(...it.p);
      d.rotation.set(it.r[0], it.r[1], 0);
      d.updateMatrix();
      m.setMatrixAt(i, d.matrix);
    });
    m.instanceMatrix.needsUpdate = true;
    m.computeBoundingSphere();
  }, [items]);
  const edges = useMemo(
    () => [
      strip(-HALF_ROAD + 0.15, -HALF_ROAD + 0.32, 0.035),
      strip(HALF_ROAD - 0.32, HALF_ROAD - 0.15, 0.035),
    ],
    [],
  );
  return (
    <>
      <instancedMesh ref={dashes} args={[undefined, undefined, items.length]}>
        <boxGeometry args={[0.18, 0.01, 3]} />
        <meshStandardMaterial color="#f2d27a" roughness={0.6} />
      </instancedMesh>
      {edges.map((g, i) => (
        <mesh key={i} geometry={g}>
          <meshStandardMaterial color="#efe6d6" roughness={0.7} />
        </mesh>
      ))}
    </>
  );
}

export function Scenery() {
  const ground = useMemo(terrain, []);
  const road = useMemo(() => strip(-HALF_ROAD, HALF_ROAD, 0.02), []);
  const shoulders = useMemo(
    () => [
      strip(-HALF_ROAD - 1.3, -HALF_ROAD, -0.04),
      strip(HALF_ROAD, HALF_ROAD + 1.3, -0.04),
    ],
    [],
  );
  return (
    <>
      <color attach="background" args={[HORIZON]} />
      <fog attach="fog" args={[HORIZON, 70, 330]} />
      <Sky />
      <mesh geometry={ground} receiveShadow>
        <meshStandardMaterial vertexColors roughness={1} />
      </mesh>
      <mesh geometry={road} receiveShadow>
        <meshStandardMaterial color="#3d3a37" roughness={0.92} />
      </mesh>
      {shoulders.map((g, i) => (
        <mesh key={i} geometry={g} receiveShadow>
          <meshStandardMaterial color="#a58662" roughness={1} />
        </mesh>
      ))}
      <RoadMarkings />
      <Ramps />
      <Vegetation />
      {CHECKPOINTS.slice(1).map((s, i) => (
        <Gate
          key={s}
          s={s}
          text={`CHECKPOINT ${i + 1}`}
          sub={`${(s / 1000).toFixed(2)} KM`}
        />
      ))}
      <Gate s={LENGTH} text="MISTGIRI HILLS" sub="VIEWPOINT · FINISH" finish />
    </>
  );
}
