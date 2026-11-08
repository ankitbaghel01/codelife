import { Suspense, useEffect, useMemo } from "react";
import { useFrame, useLoader, useThree } from "@react-three/fiber";
import {
  Bloom,
  EffectComposer,
  N8AO,
  ToneMapping,
  Vignette,
} from "@react-three/postprocessing";
import { ToneMappingMode } from "postprocessing";
import {
  AnimationMixer,
  Box3,
  CanvasTexture,
  EquirectangularReflectionMapping,
  Group,
  LoadingManager,
  Material,
  Mesh,
  MeshStandardMaterial,
  PerspectiveCamera,
  RepeatWrapping,
  SRGBColorSpace,
  Texture,
  TextureLoader,
  Vector3,
} from "three";
import { FBXLoader } from "three/examples/jsm/loaders/FBXLoader.js";
import { RGBELoader } from "three/examples/jsm/loaders/RGBELoader.js";
import { clone } from "three/examples/jsm/utils/SkeletonUtils.js";
import { Prop } from "../game/Prop";
import type { Company, Interviewer } from "./companies";

const NPC = "/assets/npc";
// Which Rocketbox avatar plays each interviewer gender (fetched by scripts/fetch_assets.py).
const AVATAR = {
  male: { fbx: "Male_Adult_04", anim: "m_sit", height: 1.76 },
  female: { fbx: "Female_Adult_11", anim: "f_sit", height: 1.62 },
};

// Rocketbox FBX files point at 12 MB .tga textures; serve the small JPG/PNG copies instead.
const manager = new LoadingManager();
manager.setURLModifier((url) => {
  const m = url.match(/([^/\\]+)\.tga$/i);
  if (!m) return url;
  return `${NPC}/textures/${m[1]}.${/opacity/i.test(m[1]) ? "png" : "jpg"}`;
});
manager.addHandler(/\.tga$/i, new TextureLoader(manager));
const withManager = (loader: FBXLoader) => void (loader.manager = manager);

/** Same Phong → PBR conversion as the hero (src/game/Hero.tsx). */
function toStandard(m: Material): MeshStandardMaterial {
  const src = m as Material & {
    map?: Texture | null;
    normalMap?: Texture | null;
  };
  const hair =
    /opacity|hair|lash/i.test(src.name) || /opacity/i.test(src.map?.name ?? "");
  if (src.map) src.map.colorSpace = SRGBColorSpace;
  return new MeshStandardMaterial({
    name: src.name,
    map: src.map ?? null,
    normalMap: src.normalMap ?? null,
    roughness: hair ? 0.6 : 0.75,
    metalness: 0,
    alphaTest: hair ? 0.5 : 0,
    side: hair ? 2 : 0,
  });
}

/** The interviewer: a Rocketbox avatar in a seated idle loop. The model faces +z, i.e. towards the candidate. */
function SeatedPerson({
  gender,
  at,
}: {
  gender: string;
  at: [number, number, number];
}) {
  const a = gender === "female" ? AVATAR.female : AVATAR.male;
  const fbx = useLoader(FBXLoader, `${NPC}/${a.fbx}.fbx`, withManager);
  const anim = useLoader(FBXLoader, `${NPC}/anim_${a.anim}.fbx`, withManager);

  const model = useMemo(() => {
    const m = clone(fbx) as Group;
    m.traverse((c) => {
      const mesh = c as Mesh;
      if (!mesh.isMesh) return;
      mesh.castShadow = true;
      mesh.receiveShadow = true;
      mesh.frustumCulled = false; // skinned bounds don't follow the animation
      mesh.material = Array.isArray(mesh.material)
        ? mesh.material.map(toStandard)
        : toStandard(mesh.material);
    });
    // Bind pose is standing, so its bounding box gives the real height to normalise against.
    const size = new Box3().setFromObject(m).getSize(new Vector3());
    m.scale.multiplyScalar(a.height / size.y);
    return m;
  }, [fbx, a.height]);

  const mixer = useMemo(() => new AnimationMixer(model), [model]);
  useEffect(() => {
    mixer.clipAction(anim.animations[0]).play();
    return () => void mixer.stopAllAction();
  }, [mixer, anim]);
  useFrame((_, dt) => mixer.update(Math.min(dt, 0.1)));

  return <primitive object={model} position={at} />;
}

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

const ROT = 0; // HDRI yaw: puts the sunlit street and warehouses behind the glass
/** Golden-hour city through the glass, also used for reflections. */
function Sky() {
  const hdr = useLoader(RGBELoader, "/assets/hdri/hamburg_canal_1k.hdr");
  const scene = useThree((s) => s.scene);
  useEffect(() => {
    hdr.mapping = EquirectangularReflectionMapping;
    const prev = [scene.background, scene.environment] as const;
    scene.background = hdr;
    scene.environment = hdr;
    scene.environmentIntensity = 0.55;
    scene.backgroundIntensity = 1.0;
    scene.backgroundRotation.set(0, ROT, 0);
    scene.backgroundBlurriness = 0.04;
    scene.environmentRotation.set(0, ROT, 0);
    return () => {
      [scene.background, scene.environment] = prev;
      scene.backgroundRotation.set(0, 0, 0);
      scene.backgroundBlurriness = 0;
      scene.environmentRotation.set(0, 0, 0);
    };
  }, [hdr, scene]);
  return null;
}

/** Company name on the wood feature wall, drawn once to a canvas. */
function useSign(name: string) {
  const tex = useMemo(() => {
    const c = document.createElement("canvas");
    c.width = 1024;
    c.height = 256;
    const g = c.getContext("2d")!;
    g.fillStyle = "#f3ead9";
    g.font = "600 92px Inter, system-ui, Arial, sans-serif";
    g.textAlign = "center";
    g.textBaseline = "middle";
    g.fillText(name, 512, 128, 980);
    const t = new CanvasTexture(c);
    t.colorSpace = SRGBColorSpace;
    return t;
  }, [name]);
  useEffect(() => () => tex.dispose(), [tex]);
  return tex;
}

// Room: candidate at +z looking towards −z; back wall is glass onto the city.
const W = 6.4; // x from −3.2 to 3.2
const BACK = -3.4;
const FRONT = 2.6;
const H = 2.9;
const DESK_Z = -0.45;

function Room({ company }: { company: Company }) {
  const floor = useTextureSet("wood_floor_worn", [5, 5]);
  const rug = useTextureSet("fabric_pattern_07", [3, 2]);
  const sign = useSign(company.name);
  const mullions = [-1.3, -0.1, 1.1, 2.3];
  return (
    <>
      <mesh
        rotation={[-Math.PI / 2, 0, 0]}
        position={[0, 0, (BACK + FRONT) / 2]}
        receiveShadow
      >
        <planeGeometry args={[W, FRONT - BACK]} />
        <meshStandardMaterial {...floor} color="#c9a888" />
      </mesh>
      <mesh
        rotation={[-Math.PI / 2, 0, 0]}
        position={[0, 0.004, DESK_Z]}
        receiveShadow
      >
        <planeGeometry args={[3.2, 2.6]} />
        <meshStandardMaterial {...rug} color="#5b6470" />
      </mesh>
      {/* Ceiling with a recessed light panel */}
      <mesh
        rotation={[Math.PI / 2, 0, 0]}
        position={[0, H, (BACK + FRONT) / 2]}
      >
        <planeGeometry args={[W, FRONT - BACK]} />
        <meshStandardMaterial color="#efe9df" roughness={0.95} />
      </mesh>
      {/* Left wall and front wall (behind the candidate) */}
      <mesh
        position={[-W / 2, H / 2, (BACK + FRONT) / 2]}
        rotation={[0, Math.PI / 2, 0]}
        receiveShadow
      >
        <planeGeometry args={[FRONT - BACK, H]} />
        <meshStandardMaterial color="#d8cebd" roughness={0.92} />
      </mesh>
      <mesh position={[0, H / 2, FRONT]} rotation={[0, Math.PI, 0]}>
        <planeGeometry args={[W, H]} />
        <meshStandardMaterial color="#d8cebd" roughness={0.92} />
      </mesh>
      {/* Wood feature panel on the left of the back wall, with the company name */}
      <mesh position={[-2.45, H / 2, BACK + 0.03]} receiveShadow castShadow>
        <boxGeometry args={[1.5, H, 0.06]} />
        <meshStandardMaterial color="#7a5233" roughness={0.55} normalMap={floor.normalMap} />
      </mesh>
      {Array.from({ length: 14 }, (_, i) => (
        <mesh key={i} position={[-3.15 + i * 0.1, H / 2, BACK + 0.075]} castShadow receiveShadow>
          <boxGeometry args={[0.045, H, 0.03]} />
          <meshStandardMaterial color="#8a5e3b" roughness={0.5} />
        </mesh>
      ))}
      <mesh position={[-2.45, 1.75, BACK + 0.1]}>
        <planeGeometry args={[1.3, 0.325]} />
        <meshStandardMaterial
          map={sign}
          transparent
          roughness={0.4}
          metalness={0.3}
        />
      </mesh>
      {/* Floor-to-ceiling glass with slim dark mullions and a frosted privacy band */}
      <mesh position={[0.8, H / 2, BACK]}>
        <planeGeometry args={[4.8, H]} />
        <meshStandardMaterial
          color="#cfe3ea"
          transparent
          opacity={0.1}
          roughness={0.05}
          metalness={0.6}
          depthWrite={false}
        />
      </mesh>
      <mesh position={[0.8, 1.05, BACK + 0.01]}>
        <planeGeometry args={[4.8, 0.12]} />
        <meshStandardMaterial
          color="#ffffff"
          transparent
          opacity={0.45}
          roughness={0.8}
          depthWrite={false}
        />
      </mesh>
      {mullions.map((x) => (
        <mesh key={x} position={[x + 0.8 - 0.6, H / 2, BACK]}>
          <boxGeometry args={[0.05, H, 0.08]} />
          <meshStandardMaterial
            color="#2b2b2e"
            roughness={0.4}
            metalness={0.7}
          />
        </mesh>
      ))}
      {[0.04, H - 0.04].map((y) => (
        <mesh key={y} position={[0.8, y, BACK]}>
          <boxGeometry args={[4.8, 0.08, 0.1]} />
          <meshStandardMaterial
            color="#2b2b2e"
            roughness={0.4}
            metalness={0.7}
          />
        </mesh>
      ))}
      {/* Right side: glass partition onto the office floor, a warm wall far behind it */}
      <mesh
        position={[W / 2, H / 2, (BACK + FRONT) / 2]}
        rotation={[0, -Math.PI / 2, 0]}
      >
        <planeGeometry args={[FRONT - BACK, H]} />
        <meshStandardMaterial
          color="#cfe3ea"
          transparent
          opacity={0.12}
          roughness={0.05}
          metalness={0.6}
          depthWrite={false}
        />
      </mesh>
      <mesh
        position={[W / 2 + 3, H / 2, (BACK + FRONT) / 2]}
        rotation={[0, -Math.PI / 2, 0]}
      >
        <planeGeometry args={[FRONT - BACK, H]} />
        <meshStandardMaterial color="#d9cbb5" roughness={0.9} />
      </mesh>
      <mesh
        rotation={[-Math.PI / 2, 0, 0]}
        position={[W / 2 + 1.5, 0, (BACK + FRONT) / 2]}
      >
        <planeGeometry args={[3, FRONT - BACK]} />
        <meshStandardMaterial color="#8d8a86" roughness={0.9} />
      </mesh>
      {/* Wall-mounted screen on the left wall for presentations */}
      <mesh
        position={[-W / 2 + 0.03, 1.55, -1.2]}
        rotation={[0, Math.PI / 2, 0]}
      >
        <boxGeometry args={[1.4, 0.8, 0.04]} />
        <meshStandardMaterial
          color="#0d0e10"
          roughness={0.25}
          metalness={0.4}
        />
      </mesh>
    </>
  );
}

function Furniture() {
  return (
    <>
      {/* Drawers face the interviewer; you see the plain modesty panel */}
      <Prop name="metal_office_desk" at={[0, 0, DESK_Z]} rotY={Math.PI} />
      <Prop name="modern_arm_chair_01" at={[0, 0, DESK_Z - 0.95]} />
      <Prop name="modern_arm_chair_01" at={[0.1, 0, 1.1]} rotY={Math.PI} />
      {/* Interviewer's laptop: screen faces them, lid back faces you */}
      <Prop name="classic_laptop" at={[0.38, 0.79, DESK_Z - 0.12]} rotY={Math.PI + 0.25} height={0.22} />
      {/* Your printed résumé on the interviewer's side, and a pen */}
      <mesh position={[-0.12, 0.792, DESK_Z - 0.12]} rotation={[-Math.PI / 2, 0, 0.12]} receiveShadow>
        <planeGeometry args={[0.21, 0.297]} />
        <meshStandardMaterial color="#f4f1ea" roughness={0.9} />
      </mesh>
      <mesh position={[0.02, 0.796, DESK_Z - 0.1]} rotation={[0, 0.5, Math.PI / 2]} castShadow>
        <cylinderGeometry args={[0.005, 0.005, 0.14, 8]} />
        <meshStandardMaterial color="#1d2a4a" roughness={0.3} metalness={0.4} />
      </mesh>
      <Prop name="potted_plant_01" at={[2.55, 0, BACK + 0.55]} height={1.55} />
      <Prop name="potted_plant_01" at={[-1.45, 0, BACK + 0.45]} rotY={1.2} height={1.2} />
      <Prop name="modern_ceiling_lamp_01" at={[0, H - 1.0, DESK_Z]} height={1.0} />
    </>
  );
}

const LOOK = new Vector3();
/** Fixed seated view; a slow breathing sway unless the player prefers reduced motion. */
function SeatedCamera() {
  const camera = useThree((s) => s.camera) as PerspectiveCamera;
  const still = useMemo(
    () => matchMedia("(prefers-reduced-motion: reduce)").matches,
    [],
  );
  useEffect(() => {
    const prev = {
      fov: camera.fov,
      pos: camera.position.clone(),
      quat: camera.quaternion.clone(),
    };
    camera.fov = 46;
    camera.updateProjectionMatrix();
    return () => {
      camera.fov = prev.fov;
      camera.position.copy(prev.pos);
      camera.quaternion.copy(prev.quat);
      camera.updateProjectionMatrix();
    };
  }, [camera]);
  useFrame(({ clock }) => {
    const t = still ? 0 : clock.elapsedTime;
    camera.position.set(
      0.12 + Math.sin(t * 0.21) * 0.012,
      1.2 + Math.sin(t * 1.3) * 0.006,
      0.85,
    );
    // Look left of the interviewer so they sit right of centre, clear of the interview UI on the left.
    camera.lookAt(LOOK.set(-0.42, 1.1, DESK_Z - 0.9));
  });
  return null;
}

function Lights() {
  return (
    <>
      <hemisphereLight args={["#fff0dc", "#6b5040", 1.0]} />
      {/* Low golden sun through the glass, behind-left of the interviewer */}
      <directionalLight
        position={[-4, 4.5, -7]}
        intensity={1.5}
        color="#ffc98a"
        castShadow
        shadow-mapSize={[2048, 2048]}
        shadow-bias={-0.0004}
        shadow-normalBias={0.02}
        shadow-camera-left={-4}
        shadow-camera-right={4}
        shadow-camera-top={4}
        shadow-camera-bottom={-4}
        shadow-camera-far={20}
      />
      {/* Pendant over the desk and a soft fill from the candidate's side for the face */}
      <pointLight
        position={[0, H - 1.08, DESK_Z]}
        intensity={2.2}
        distance={5}
        decay={2}
        color="#ffd9a8"
        castShadow
        shadow-bias={-0.002}
      />
      <pointLight
        position={[0.4, 1.7, 1.6]}
        intensity={3}
        distance={5}
        decay={2}
        color="#ffe6c8"
      />
    </>
  );
}

function Ready({ onReady }: { onReady?: () => void }) {
  useEffect(() => onReady?.(), [onReady]);
  return null;
}

type Props = {
  company: Company;
  interviewer?: Interviewer; // defaults to company.interviewer
  onReady?: () => void;
};

/** Glass-walled interview room seen from the candidate's chair. Render inside an R3F <Canvas shadows>. */
export function OfficeScene({
  company,
  interviewer = company.interviewer,
  onReady,
}: Props) {
  return (
    <>
      <SeatedCamera />
      <Suspense fallback={null}>
        <Sky />
        <Lights />
        <Room company={company} />
        <Furniture />
        <SeatedPerson gender={interviewer.gender} at={[0, 0, DESK_Z - 0.8]} />
        <Ready onReady={onReady} />
      </Suspense>
      <EffectComposer multisampling={0}>
        <N8AO
          halfRes
          aoRadius={0.5}
          intensity={2}
          distanceFalloff={0.5}
          color="#2a1a10"
        />
        <Bloom
          intensity={0.3}
          luminanceThreshold={0.9}
          luminanceSmoothing={0.2}
          mipmapBlur
        />
        <ToneMapping mode={ToneMappingMode.ACES_FILMIC} />
        <Vignette offset={0.3} darkness={0.4} />
      </EffectComposer>
    </>
  );
}

export { Reception } from "./Reception";
