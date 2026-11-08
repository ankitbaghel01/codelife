// A dirt-style motorbike and rider made from primitives. The parent positions/rotates the
// returned group; this component only animates wheels, suspension and the rider's pose.
import { forwardRef, useMemo, useRef, type MutableRefObject } from "react";
import { useFrame } from "@react-three/fiber";
import { Group, MeshStandardMaterial, Quaternion, Vector3 } from "three";
import type { Sim } from "./sim";

const WHEEL_R = 0.33;
export const COM = 0.62; // pivot height for flips (roughly the centre of mass)

function useMats() {
  return useMemo(
    () => ({
      paint: new MeshStandardMaterial({
        color: "#d9472b",
        metalness: 0.35,
        roughness: 0.35,
      }),
      paint2: new MeshStandardMaterial({
        color: "#f2b544",
        metalness: 0.2,
        roughness: 0.4,
      }),
      black: new MeshStandardMaterial({ color: "#1a1817", roughness: 0.75 }),
      tyre: new MeshStandardMaterial({ color: "#151413", roughness: 0.95 }),
      chrome: new MeshStandardMaterial({
        color: "#d8d4ce",
        metalness: 0.95,
        roughness: 0.18,
      }),
      steel: new MeshStandardMaterial({
        color: "#6d6862",
        metalness: 0.8,
        roughness: 0.35,
      }),
      jacket: new MeshStandardMaterial({ color: "#1f5d7a", roughness: 0.7 }),
      pants: new MeshStandardMaterial({ color: "#2b2b30", roughness: 0.8 }),
      helmet: new MeshStandardMaterial({
        color: "#f5efe6",
        metalness: 0.1,
        roughness: 0.25,
      }),
      visor: new MeshStandardMaterial({
        color: "#20160f",
        metalness: 0.9,
        roughness: 0.05,
      }),
      glove: new MeshStandardMaterial({ color: "#3a2a20", roughness: 0.8 }),
      light: new MeshStandardMaterial({
        color: "#fff3d0",
        emissive: "#ffe6a8",
        emissiveIntensity: 3,
      }),
      tail: new MeshStandardMaterial({
        color: "#ff3b2a",
        emissive: "#ff2a10",
        emissiveIntensity: 2.5,
      }),
    }),
    [],
  );
}
type Mats = ReturnType<typeof useMats>;

const UP = new Vector3(0, 1, 0);
/** A capsule stretched between two points (limbs, fork legs, frame tubes). */
function Limb({
  a,
  b,
  r,
  mat,
}: {
  a: [number, number, number];
  b: [number, number, number];
  r: number;
  mat: MeshStandardMaterial;
}) {
  const { pos, quat, len } = useMemo(() => {
    const va = new Vector3(...a);
    const vb = new Vector3(...b);
    const d = vb.clone().sub(va);
    return {
      pos: va.add(vb).multiplyScalar(0.5),
      quat: new Quaternion().setFromUnitVectors(UP, d.clone().normalize()),
      len: d.length(),
    };
  }, [a, b]);
  return (
    <mesh position={pos} quaternion={quat} material={mat} castShadow>
      <capsuleGeometry args={[r, Math.max(0.01, len - r * 2), 4, 8]} />
    </mesh>
  );
}

const Wheel = forwardRef<Group, { z: number; m: Mats }>(function Wheel(
  { z, m },
  ref,
) {
  return (
    <group position={[0, WHEEL_R, z]}>
      <group ref={ref}>
        <mesh rotation={[0, Math.PI / 2, 0]} material={m.tyre} castShadow>
          <torusGeometry args={[WHEEL_R - 0.07, 0.075, 10, 28]} />
        </mesh>
        <mesh rotation={[0, Math.PI / 2, 0]} material={m.chrome}>
          <torusGeometry args={[WHEEL_R - 0.13, 0.018, 6, 28]} />
        </mesh>
        <mesh rotation={[0, 0, Math.PI / 2]} material={m.steel}>
          <cylinderGeometry args={[0.05, 0.05, 0.16, 12]} />
        </mesh>
        {Array.from({ length: 8 }, (_, i) => (
          <mesh
            key={i}
            rotation={[(i * Math.PI) / 8, 0, 0]}
            material={m.chrome}
          >
            <boxGeometry args={[0.012, (WHEEL_R - 0.13) * 2, 0.012]} />
          </mesh>
        ))}
      </group>
    </group>
  );
});

const FRONT = -0.7;
const REAR = 0.66;

export function Motorbike({
  sim,
  pitchInput,
}: {
  sim: MutableRefObject<Sim>;
  pitchInput: MutableRefObject<number>;
}) {
  const m = useMats();
  const front = useRef<Group>(null);
  const rear = useRef<Group>(null);
  const body = useRef<Group>(null);
  const rider = useRef<Group>(null);

  useFrame(() => {
    const s = sim.current;
    if (front.current) front.current.rotation.x = -s.wheelSpin;
    if (rear.current) rear.current.rotation.x = -s.wheelSpin;
    if (body.current) body.current.position.y = -s.comp * 0.12;
    if (rider.current) {
      // Rider tucks forward with throttle, leans back for a backflip, crouches on landing.
      const lean = s.air ? -pitchInput.current * 0.3 : s.speed > 20 ? 0.12 : 0;
      rider.current.rotation.x += (lean - rider.current.rotation.x) * 0.2;
      rider.current.position.y = 1.0 - s.comp * 0.18;
    }
  });

  return (
    <group position={[0, -COM, 0]}>
      <Wheel ref={front} z={FRONT} m={m} />
      <Wheel ref={rear} z={REAR} m={m} />
      <group ref={body}>
        {/* Fork from the front axle up to the steering head, with the handlebar */}
        <Limb
          a={[0.09, WHEEL_R, FRONT]}
          b={[0.09, 0.98, -0.46]}
          r={0.03}
          mat={m.chrome}
        />
        <Limb
          a={[-0.09, WHEEL_R, FRONT]}
          b={[-0.09, 0.98, -0.46]}
          r={0.03}
          mat={m.chrome}
        />
        <mesh
          position={[0, 1.04, -0.44]}
          rotation={[0, 0, Math.PI / 2]}
          material={m.black}
        >
          <cylinderGeometry args={[0.022, 0.022, 0.72, 8]} />
        </mesh>
        <mesh position={[0, 0.98, -0.47]} material={m.steel}>
          <boxGeometry args={[0.22, 0.08, 0.1]} />
        </mesh>
        {/* Front number board + headlight, front mudguard */}
        <mesh
          position={[0, 0.92, -0.58]}
          rotation={[0.35, 0, 0]}
          material={m.paint2}
          castShadow
        >
          <boxGeometry args={[0.26, 0.26, 0.04]} />
        </mesh>
        <mesh
          position={[0, 0.88, -0.61]}
          rotation={[Math.PI / 2 + 0.35, 0, 0]}
          material={m.light}
        >
          <cylinderGeometry args={[0.07, 0.07, 0.03, 16]} />
        </mesh>
        <mesh
          position={[0, WHEEL_R + 0.33, FRONT - 0.02]}
          rotation={[0.3, 0, 0]}
          material={m.paint}
          castShadow
        >
          <boxGeometry args={[0.16, 0.03, 0.48]} />
        </mesh>
        {/* Frame, tank, seat, engine, swingarm, exhaust, rear fender */}
        <Limb a={[0, 0.96, -0.44]} b={[0, 0.48, 0.05]} r={0.04} mat={m.steel} />
        <Limb a={[0, 0.9, -0.4]} b={[0, 0.82, 0.45]} r={0.035} mat={m.steel} />
        <mesh
          position={[0, 0.94, -0.18]}
          scale={[0.24, 0.17, 0.36]}
          material={m.paint}
          castShadow
        >
          <sphereGeometry args={[1, 18, 12]} />
        </mesh>
        <mesh
          position={[0, 1.0, -0.2]}
          scale={[0.1, 0.05, 0.2]}
          material={m.paint2}
        >
          <sphereGeometry args={[1, 12, 8]} />
        </mesh>
        <mesh
          position={[0, 0.94, 0.3]}
          rotation={[-0.08, 0, 0]}
          material={m.black}
          castShadow
        >
          <boxGeometry args={[0.24, 0.08, 0.6]} />
        </mesh>
        <mesh
          position={[0, 0.88, 0.62]}
          rotation={[-0.25, 0, 0]}
          material={m.paint}
          castShadow
        >
          <boxGeometry args={[0.2, 0.04, 0.4]} />
        </mesh>
        <mesh position={[0, 0.87, 0.82]} material={m.tail}>
          <boxGeometry args={[0.12, 0.05, 0.03]} />
        </mesh>
        <mesh position={[0, 0.52, -0.05]} material={m.steel} castShadow>
          <boxGeometry args={[0.26, 0.3, 0.36]} />
        </mesh>
        <mesh
          position={[0, 0.58, -0.05]}
          rotation={[0, 0, Math.PI / 2]}
          material={m.black}
        >
          <cylinderGeometry args={[0.13, 0.13, 0.3, 14]} />
        </mesh>
        {[0.1, -0.1].map((x) => (
          <Limb
            key={x}
            a={[x, 0.5, 0.1]}
            b={[x, WHEEL_R, REAR]}
            r={0.03}
            mat={m.steel}
          />
        ))}
        <Limb
          a={[0.08, 0.84, 0.3]}
          b={[0.1, WHEEL_R + 0.05, REAR - 0.05]}
          r={0.035}
          mat={m.paint2}
        />
        <Limb
          a={[0.12, 0.45, -0.2]}
          b={[0.2, 0.55, 0.35]}
          r={0.03}
          mat={m.chrome}
        />
        <Limb
          a={[0.2, 0.55, 0.35]}
          b={[0.21, 0.7, 0.7]}
          r={0.055}
          mat={m.chrome}
        />
        <mesh
          position={[0.21, 0.72, 0.76]}
          rotation={[Math.PI / 2 - 0.4, 0, 0]}
          material={m.black}
        >
          <cylinderGeometry args={[0.04, 0.04, 0.06, 10]} />
        </mesh>
        {/* Foot pegs */}
        <mesh
          position={[0, 0.42, 0.12]}
          rotation={[0, 0, Math.PI / 2]}
          material={m.steel}
        >
          <cylinderGeometry args={[0.02, 0.02, 0.5, 6]} />
        </mesh>
      </group>

      {/* Rider: hips on the seat, feet on the pegs, hands on the grips */}
      <group>
        <group ref={rider} position={[0, 1.0, 0.24]}>
          <group position={[0, -1.0, -0.24]}>
            {[1, -1].map((side) => (
              <group key={side}>
                <Limb
                  a={[side * 0.13, 1.02, 0.24]}
                  b={[side * 0.2, 0.84, -0.14]}
                  r={0.075}
                  mat={m.pants}
                />
                <Limb
                  a={[side * 0.2, 0.84, -0.14]}
                  b={[side * 0.2, 0.46, 0.08]}
                  r={0.06}
                  mat={m.pants}
                />
                <mesh
                  position={[side * 0.2, 0.44, 0.04]}
                  material={m.black}
                  castShadow
                >
                  <boxGeometry args={[0.1, 0.1, 0.24]} />
                </mesh>
                <Limb
                  a={[side * 0.19, 1.47, 0.0]}
                  b={[side * 0.27, 1.22, -0.24]}
                  r={0.055}
                  mat={m.jacket}
                />
                <Limb
                  a={[side * 0.27, 1.22, -0.24]}
                  b={[side * 0.33, 1.06, -0.44]}
                  r={0.045}
                  mat={m.jacket}
                />
                <mesh position={[side * 0.33, 1.05, -0.45]} material={m.glove}>
                  <sphereGeometry args={[0.05, 8, 6]} />
                </mesh>
              </group>
            ))}
            <Limb
              a={[0, 1.04, 0.24]}
              b={[0, 1.46, 0.02]}
              r={0.17}
              mat={m.jacket}
            />
            <mesh
              position={[0, 1.3, 0.2]}
              rotation={[0.45, 0, 0]}
              material={m.paint2}
            >
              <boxGeometry args={[0.3, 0.06, 0.05]} />
            </mesh>
            {/* Helmet with a dark visor and a peak */}
            <group position={[0, 1.7, -0.06]}>
              <mesh material={m.helmet} castShadow>
                <sphereGeometry args={[0.17, 18, 14]} />
              </mesh>
              <mesh material={m.visor}>
                <sphereGeometry
                  args={[
                    0.175,
                    18,
                    10,
                    Math.PI * 1.18,
                    Math.PI * 0.64,
                    Math.PI * 0.38,
                    Math.PI * 0.22,
                  ]}
                />
              </mesh>
              <mesh
                position={[0, 0.1, -0.15]}
                rotation={[-0.3, 0, 0]}
                material={m.paint}
              >
                <boxGeometry args={[0.2, 0.02, 0.14]} />
              </mesh>
              <mesh position={[0, -0.11, -0.13]} material={m.helmet}>
                <boxGeometry args={[0.12, 0.08, 0.1]} />
              </mesh>
            </group>
          </group>
        </group>
      </group>
    </group>
  );
}
