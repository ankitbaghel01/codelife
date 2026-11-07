import { Suspense, useEffect, useMemo } from "react";
import { useLoader, useThree } from "@react-three/fiber";
import {
  EquirectangularReflectionMapping,
  Object3D,
  RepeatWrapping,
  SRGBColorSpace,
  Texture,
  TextureLoader,
} from "three";
import { RGBELoader } from "three/examples/jsm/loaders/RGBELoader.js";
import { SOLIDS, WINDOW } from "./layout";
import { Prop } from "./Prop";
import { Poster } from "./Poster";

const T = "/assets/textures";

function useTextureSet(name: string, repeat: [number, number]) {
  const [diff, nor, rough] = useLoader(TextureLoader, [
    `${T}/${name}/diff.jpg`,
    `${T}/${name}/nor.jpg`,
    `${T}/${name}/rough.jpg`,
  ]);
  return useMemo(() => {
    const set = (t: Texture, srgb = false) => {
      const c = t.clone();
      c.wrapS = c.wrapT = RepeatWrapping;
      c.repeat.set(...repeat);
      if (srgb) c.colorSpace = SRGBColorSpace;
      c.needsUpdate = true;
      return c;
    };
    return {
      map: set(diff, true),
      normalMap: set(nor),
      roughnessMap: set(rough),
    };
  }, [diff, nor, rough, repeat[0], repeat[1]]);
}

/** Golden-hour city outside the window; also lights reflections indoors (kept dim). */
function Sky() {
  const hdr = useLoader(RGBELoader, "/assets/hdri/hamburg_canal_1k.hdr");
  const scene = useThree((s) => s.scene);
  useEffect(() => {
    hdr.mapping = EquirectangularReflectionMapping;
    scene.background = hdr;
    scene.environment = hdr;
    scene.environmentIntensity = 0.55;
    scene.backgroundIntensity = 1.1;
    return () => {
      scene.background = null;
      scene.environment = null;
    };
  }, [hdr, scene]);
  return null;
}

function Shell() {
  const floor = useTextureSet("wood_floor_worn", [4, 3]);
  const wall = useTextureSet("white_plaster_02", [2, 1]);
  return (
    <>
      <mesh
        rotation={[-Math.PI / 2, 0, 0]}
        position={[2.5, 0, 2.5]}
        receiveShadow
      >
        <planeGeometry args={[5, 5]} />
        <meshStandardMaterial {...floor} color="#d9b48c" />
      </mesh>
      <mesh
        rotation={[-Math.PI / 2, 0, 0]}
        position={[6.25, 0.002, 3.75]}
        receiveShadow
      >
        <planeGeometry args={[2.5, 2.5]} />
        <meshStandardMaterial {...floor} color="#d9b48c" />
      </mesh>
      <mesh
        rotation={[-Math.PI / 2, 0, 0]}
        position={[6.25, 0.002, 1.25]}
        receiveShadow
      >
        <planeGeometry args={[2.5, 2.5]} />
        <meshStandardMaterial color="#d7dcdc" roughness={0.35} />
      </mesh>
      <mesh rotation={[Math.PI / 2, 0, 0]} position={[3.75, 2.8, 2.5]}>
        <planeGeometry args={[7.5, 5]} />
        <meshStandardMaterial color="#efe6d6" roughness={0.95} />
      </mesh>
      {SOLIDS.filter((s) => s.render !== false).map((s, i) => (
        <mesh
          key={i}
          position={[
            (s.minX + s.maxX) / 2,
            (s.y0 ?? 0) + s.h / 2,
            (s.minZ + s.maxZ) / 2,
          ]}
          castShadow
          receiveShadow
        >
          <boxGeometry args={[s.maxX - s.minX, s.h, s.maxZ - s.minZ]} />
          {s.kind === "door" ? (
            <meshStandardMaterial color="#6b4a2e" roughness={0.6} />
          ) : s.kind === "fixture" ? (
            <meshStandardMaterial color="#eeece6" roughness={0.25} />
          ) : (
            <meshStandardMaterial {...wall} color="#f6e4c8" />
          )}
        </mesh>
      ))}
      {/* Wood panelling behind the desk, like the reference room */}
      <mesh
        position={[0.06, 1.3, 3.7]}
        rotation={[0, Math.PI / 2, 0]}
        receiveShadow
      >
        <planeGeometry args={[2.0, 2.6]} />
        <meshStandardMaterial {...floor} color="#8a5a35" />
      </mesh>
      <WindowFrame />
    </>
  );
}

function WindowFrame() {
  const w = WINDOW.maxX - WINDOW.minX;
  const h = WINDOW.y1 - WINDOW.y0;
  const cx = (WINDOW.minX + WINDOW.maxX) / 2;
  const cy = (WINDOW.y0 + WINDOW.y1) / 2;
  const frame = <meshStandardMaterial color="#f4efe6" roughness={0.5} />;
  return (
    <group position={[cx, cy, 0]}>
      <mesh position={[0, h / 2, 0]}>
        <boxGeometry args={[w + 0.08, 0.06, 0.14]} />
        {frame}
      </mesh>
      <mesh position={[0, -h / 2, 0.05]} castShadow>
        <boxGeometry args={[w + 0.16, 0.05, 0.24]} />
        {frame}
      </mesh>
      {[-w / 2, 0, w / 2].map((x) => (
        <mesh key={x} position={[x, 0, 0]}>
          <boxGeometry args={[0.05, h, 0.12]} />
          {frame}
        </mesh>
      ))}
      <mesh position={[0, 0.05, 0]}>
        <boxGeometry args={[w, 0.04, 0.1]} />
        {frame}
      </mesh>
      <mesh>
        <planeGeometry args={[w, h]} />
        <meshPhysicalMaterial
          color="#ffffff"
          transmission={1}
          roughness={0.05}
          thickness={0.01}
          transparent
          opacity={0.15}
        />
      </mesh>
    </group>
  );
}

/** Iron bed with an orange blanket, modelled after the reference bedroom. */
function IronBed() {
  const sheet = useTextureSet("fabric_pattern_07", [2, 2]);
  const iron = (
    <meshStandardMaterial color="#2b2a29" metalness={0.8} roughness={0.45} />
  );
  const bars = (z: number, top: number) => (
    <group position={[0, 0, z]}>
      {[0.12, 2.08].map((x) => (
        <mesh key={x} position={[x, top / 2, 0]} castShadow>
          <cylinderGeometry args={[0.025, 0.025, top, 12]} />
          {iron}
        </mesh>
      ))}
      {[top - 0.05, 0.42].map((y) => (
        <mesh
          key={y}
          position={[1.1, y, 0]}
          rotation={[0, 0, Math.PI / 2]}
          castShadow
        >
          <cylinderGeometry args={[0.015, 0.015, 1.96, 10]} />
          {iron}
        </mesh>
      ))}
      {Array.from({ length: 11 }, (_, i) => 0.28 + i * 0.165).map((x) => (
        <mesh key={x} position={[x, (top + 0.42) / 2, 0]} castShadow>
          <cylinderGeometry args={[0.009, 0.009, top - 0.47, 8]} />
          {iron}
        </mesh>
      ))}
    </group>
  );
  return (
    <group>
      {bars(0.14, 1.05)}
      {bars(1.72, 0.8)}
      <mesh position={[1.1, 0.4, 0.93]} castShadow receiveShadow>
        <boxGeometry args={[1.92, 0.2, 1.55]} />
        <meshStandardMaterial color="#f2efe8" roughness={0.9} />
      </mesh>
      <mesh position={[1.1, 0.53, 1.12]} castShadow receiveShadow>
        <boxGeometry args={[1.98, 0.07, 1.2]} />
        <meshStandardMaterial normalMap={sheet.normalMap} color="#c8661f" roughness={0.95} />
      </mesh>
      <mesh position={[0.62, 0.58, 0.36]} rotation={[0.25, 0, 0]} castShadow>
        <boxGeometry args={[0.62, 0.14, 0.34]} />
        <meshStandardMaterial color="#f5f3ee" roughness={0.9} />
      </mesh>
      <mesh position={[1.4, 0.58, 0.38]} rotation={[0.3, 0, 0]} castShadow>
        <boxGeometry args={[0.55, 0.14, 0.3]} />
        <meshStandardMaterial {...sheet} color="#e9c08f" roughness={0.9} />
      </mesh>
    </group>
  );
}

function Furniture() {
  return (
    <>
      <IronBed />
      <Prop name="ClassicNightstand_01" at={[2.5, 0, 0.32]} />
      <Prop name="alarm_clock_01" at={[2.4, 0.7, 0.3]} rotY={0.4} />
      {/* Desk against the west wall, stretched to a real desk height */}
      <Prop
        name="WoodenTable_01"
        at={[0.42, 0, 3.7]}
        rotY={Math.PI / 2}
        size={[1.3, 0.76, 0.62]}
      />
      <Prop
        name="classic_laptop"
        at={[0.45, 0.76, 3.7]}
        rotY={Math.PI / 2}
        height={0.24}
      />
      <Prop
        name="desk_lamp_arm_01"
        at={[0.3, 0.76, 4.15]}
        rotY={Math.PI / 2}
        height={0.55}
      />
      <Prop
        name="book_encyclopedia_set_01"
        at={[0.3, 0.76, 3.25]}
        rotY={Math.PI / 2}
        height={0.22}
      />
      <Prop
        name="GreenChair_01"
        at={[1.05, 0, 3.7]}
        rotY={-Math.PI / 2}
        height={0.95}
      />
      <Prop name="anthurium_botany_01" at={[4.65, 0, 0.45]} height={0.75} />
      <Prop name="Shelf_01" at={[1.4, 0, 4.82]} rotY={Math.PI} height={1.9} />
      <Poster at={[2.7, 1.55, 0.07]} size={[0.5, 0.68]} variant="hills" />
      <Poster at={[0.07, 1.6, 1.0]} rotY={Math.PI / 2} size={[0.45, 0.6]} variant="city" />
      <Prop name="ceiling_fan" at={[2.4, 2.32, 2.4]} height={0.45} />
      <Prop
        name="electric_stove"
        at={[3.0, 0, 4.62]}
        rotY={Math.PI}
        height={0.88}
      />
      <Prop
        name="drawer_cabinet"
        at={[4.0, 0, 4.72]}
        rotY={Math.PI}
        height={1.85}
      />
    </>
  );
}

export function Flat() {
  const sunTarget = useMemo(() => {
    const o = new Object3D();
    o.position.set(2.2, 0, 2.8);
    return o;
  }, []);
  return (
    <group>
      <Suspense fallback={null}>
        <Sky />
      </Suspense>
      <Shell />
      <Furniture />
      <primitive object={sunTarget} />
      <hemisphereLight args={["#ffe2b8", "#7a5236", 0.9]} />
      {/* Low golden sun through the window, casting long shadows into the room */}
      <directionalLight
        position={[5.2, 4.0, -4.5]}
        target={sunTarget}
        color="#ffc27a"
        intensity={6.5}
        castShadow
        shadow-mapSize={[2048, 2048]}
        shadow-camera-left={-5}
        shadow-camera-right={5}
        shadow-camera-top={5}
        shadow-camera-bottom={-5}
        shadow-camera-near={1}
        shadow-camera-far={16}
        shadow-bias={-0.0003}
        shadow-normalBias={0.02}
      />
      {/* Bounce light from the sunlit floor, warm fill for the corners, desk lamp, bathroom */}
      <pointLight
        position={[3.9, 0.6, 1.8]}
        color="#ffb877" intensity={3}
        distance={5}
        decay={2}
      />
      <pointLight
        position={[2.5, 2.4, 3.2]}
        color="#ffe2bd" intensity={2.6}
        distance={6}
        decay={2}
      />
      <pointLight
        position={[0.35, 1.25, 4.1]}
        color="#ffd9a0"
        intensity={0.8}
        distance={2}
        decay={2}
      />
      <pointLight
        position={[6.25, 2.5, 1.25]}
        color="#f4f6ff"
        intensity={1.8}
        distance={4}
        decay={2}
      />
    </group>
  );
}
