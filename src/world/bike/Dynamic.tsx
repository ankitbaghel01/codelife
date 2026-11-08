// Things that move every frame but aren't the bike: spinning coins, boost pads and a small
// pooled particle system for dust, sparks and coin sparkles.
import { useLayoutEffect, useMemo, useRef, type MutableRefObject } from "react";
import { useFrame } from "@react-three/fiber";
import {
  CanvasTexture,
  Color,
  InstancedMesh,
  Mesh,
  Object3D,
  SRGBColorSpace,
} from "three";
import type { Sim } from "./sim";
import { heading, roadY, toWorld } from "./track";

const d = new Object3D();

export function Pickups({ sim }: { sim: MutableRefObject<Sim> }) {
  const coins = useRef<InstancedMesh>(null);
  const pads = useRef<(Mesh | null)[]>([]);
  const list = sim.current.pickups;
  const coinIdx = useMemo(
    () =>
      list.map((p, i) => (p.kind === "coin" ? i : -1)).filter((i) => i >= 0),
    [list],
  );
  const padIdx = useMemo(
    () =>
      list.map((p, i) => (p.kind === "boost" ? i : -1)).filter((i) => i >= 0),
    [list],
  );
  const chevron = useMemo(() => {
    const cv = document.createElement("canvas");
    cv.width = 128;
    cv.height = 256;
    const c = cv.getContext("2d")!;
    c.fillStyle = "rgba(0,0,0,0)";
    c.fillRect(0, 0, 128, 256);
    c.fillStyle = "#ffcf5a";
    for (let y = 20; y < 256; y += 80) {
      c.beginPath();
      c.moveTo(14, y + 56);
      c.lineTo(64, y);
      c.lineTo(114, y + 56);
      c.lineTo(94, y + 66);
      c.lineTo(64, y + 32);
      c.lineTo(34, y + 66);
      c.fill();
    }
    const t = new CanvasTexture(cv);
    t.colorSpace = SRGBColorSpace;
    return t;
  }, []);

  useFrame(({ clock }) => {
    const ps = sim.current.pickups;
    const m = coins.current;
    if (m) {
      const t = clock.elapsedTime;
      coinIdx.forEach((pi, k) => {
        const p = ps[pi];
        if (p.taken) d.scale.setScalar(0);
        else d.scale.setScalar(1);
        d.position.set(...toWorld(p.s, p.l, p.y + Math.sin(t * 3 + k) * 0.08));
        d.rotation.set(0, t * 3 + k * 0.4, Math.PI / 2);
        d.updateMatrix();
        m.setMatrixAt(k, d.matrix);
      });
      m.instanceMatrix.needsUpdate = true;
    }
    padIdx.forEach((pi, k) => {
      const pad = pads.current[k];
      if (pad) pad.visible = !ps[pi].taken;
    });
  });

  return (
    <>
      <instancedMesh
        ref={coins}
        args={[undefined, undefined, coinIdx.length]}
        frustumCulled={false}
        castShadow
      >
        <cylinderGeometry args={[0.36, 0.36, 0.08, 18]} />
        <meshStandardMaterial
          color="#f2b544"
          metalness={0.85}
          roughness={0.25}
          emissive="#a86a00"
          emissiveIntensity={0.9}
        />
      </instancedMesh>
      {padIdx.map((pi, k) => {
        const p = list[pi];
        return (
          <mesh
            key={pi}
            ref={(m) => void (pads.current[k] = m)}
            position={toWorld(p.s, p.l, roadY(p.s) + 0.05)}
            rotation={[-Math.PI / 2, 0, -heading(p.s), "YXZ"]}
          >
            <planeGeometry args={[2.4, 4.8]} />
            <meshBasicMaterial
              map={chevron}
              transparent
              color={[2.4, 1.8, 0.8]}
              toneMapped={false}
              depthWrite={false}
            />
          </mesh>
        );
      })}
    </>
  );
}

const MAX = 160;
type P = {
  x: number;
  y: number;
  z: number;
  vx: number;
  vy: number;
  vz: number;
  life: number;
  max: number;
  size: number;
};

export function Particles({ sim }: { sim: MutableRefObject<Sim> }) {
  const mesh = useRef<InstancedMesh>(null);
  const pool = useMemo<P[]>(
    () =>
      Array.from({ length: MAX }, () => ({
        x: 0,
        y: 0,
        z: 0,
        vx: 0,
        vy: 0,
        vz: 0,
        life: 0,
        max: 1,
        size: 0,
      })),
    [],
  );
  const next = useRef(0);
  const colors = useMemo(
    () => ({
      dust: new Color("#c9a77a"),
      spark: new Color(4, 2.2, 0.6),
      coin: new Color(3, 2.4, 0.8),
    }),
    [],
  );

  useLayoutEffect(() => {
    const m = mesh.current;
    if (!m) return;
    for (let i = 0; i < MAX; i++) m.setColorAt(i, colors.dust);
  }, [colors]);

  useFrame((_, dt0) => {
    const dt = Math.min(dt0, 0.05);
    const s = sim.current;
    const m = mesh.current;
    if (!m) return;
    const spawn = (
      kind: "dust" | "spark" | "coin",
      at: [number, number, number],
      n: number,
    ) => {
      for (let i = 0; i < n; i++) {
        const k = next.current;
        next.current = (k + 1) % MAX;
        const p = pool[k];
        const sp = kind === "spark" ? 7 : kind === "coin" ? 3 : 2.2;
        p.x = at[0] + (Math.random() - 0.5) * 0.6;
        p.y = at[1] + 0.1;
        p.z = at[2] + (Math.random() - 0.5) * 0.6;
        p.vx = (Math.random() - 0.5) * sp;
        p.vy = Math.random() * sp * (kind === "dust" ? 0.6 : 1);
        p.vz = (Math.random() - 0.5) * sp;
        p.max = p.life =
          kind === "dust"
            ? 0.9 + Math.random() * 0.6
            : 0.5 + Math.random() * 0.4;
        p.size = kind === "dust" ? 0.12 + Math.random() * 0.14 : 0.08;
        m.setColorAt(k, colors[kind]);
      }
      if (m.instanceColor) m.instanceColor.needsUpdate = true;
    };
    for (const b of s.bursts.splice(0))
      spawn(b.kind, toWorld(b.s, b.l, b.y), b.n);
    // Rear-wheel dust when riding fast, flames of dust when boosting.
    if (
      !s.air &&
      s.crashT <= 0 &&
      s.speed > 14 &&
      Math.random() < dt * (s.boostT > 0 ? 40 : 10)
    )
      spawn("dust", toWorld(s.s - 0.7, s.l, s.y), 1);

    pool.forEach((p, i) => {
      if (p.life > 0) {
        p.life -= dt;
        p.vy -= (p.size < 0.1 ? 12 : 1.5) * dt;
        p.x += p.vx * dt;
        p.y += p.vy * dt;
        p.z += p.vz * dt;
      }
      const k = Math.max(0, p.life / p.max);
      d.position.set(p.x, p.y, p.z);
      d.rotation.set(0, 0, 0);
      d.scale.setScalar(p.life > 0 ? p.size * (p.size < 0.1 ? k : 1.6 - k) : 0);
      d.updateMatrix();
      m.setMatrixAt(i, d.matrix);
    });
    m.instanceMatrix.needsUpdate = true;
  });

  return (
    <instancedMesh
      ref={mesh}
      args={[undefined, undefined, MAX]}
      frustumCulled={false}
    >
      <icosahedronGeometry args={[1, 0]} />
      <meshBasicMaterial
        color="#ffffff"
        transparent
        opacity={0.55}
        toneMapped={false}
        depthWrite={false}
      />
    </instancedMesh>
  );
}
