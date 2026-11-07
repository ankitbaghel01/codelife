import { useEffect, useMemo, useRef } from "react";
import { useFrame, useLoader } from "@react-three/fiber";
import {
  AnimationMixer,
  Box3,
  Group,
  LoadingManager,
  Material,
  Mesh,
  MeshStandardMaterial,
  SkinnedMesh,
  SRGBColorSpace,
  Texture,
  TextureLoader,
  Vector3,
} from "three";
import { FBXLoader } from "three/examples/jsm/loaders/FBXLoader.js";
import { clone } from "three/examples/jsm/utils/SkeletonUtils.js";
import { pose } from "./pose";

const DIR = "/assets/hero";
const HEIGHT = 1.76;
export const HERO_LAYER = 1;

// Rocketbox ships 12 MB .tga textures; fetch_assets.py converts them, so point the FBX at the small copies.
const manager = new LoadingManager();
manager.setURLModifier((url) => {
  const m = url.match(/([^/\\]+)\.tga$/i);
  if (!m) return url;
  return `${DIR}/textures/${m[1]}.${/opacity/i.test(m[1]) ? "png" : "jpg"}`;
});
manager.addHandler(/\.tga$/i, new TextureLoader(manager));

function withManager(loader: FBXLoader) {
  loader.manager = manager;
}

/** Old 3ds Max Phong materials → physically based ones, so the hero matches the room's lighting. */
function toStandard(m: Material): MeshStandardMaterial {
  const src = m as Material & {
    map?: Texture | null;
    normalMap?: Texture | null;
    name: string;
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
    transparent: false,
    alphaTest: hair ? 0.5 : 0,
    side: hair ? 2 : 0,
  });
}

/** The realistic hero (Microsoft Rocketbox, MIT). Idles when still, walks when moving. */
export function Hero() {
  const fbx = useLoader(FBXLoader, `${DIR}/Male_Adult_07.fbx`, withManager);
  const [idle, walk] = useLoader(
    FBXLoader,
    [`${DIR}/anim_idle.fbx`, `${DIR}/anim_walk.fbx`],
    withManager,
  );
  const root = useRef<Group>(null);

  const model = useMemo(() => {
    const m = clone(fbx) as Group;
    m.traverse((c) => {
      c.layers.set(HERO_LAYER);
      const mesh = c as Mesh | SkinnedMesh;
      if (!mesh.isMesh) return;
      mesh.castShadow = true;
      mesh.frustumCulled = false; // skinned bounds don't follow the animation
      mesh.material = Array.isArray(mesh.material)
        ? mesh.material.map(toStandard)
        : toStandard(mesh.material);
    });
    const size = new Box3().setFromObject(m).getSize(new Vector3());
    m.scale.multiplyScalar(HEIGHT / size.y);
    const box = new Box3().setFromObject(m);
    const mid = box.getCenter(new Vector3());
    m.position.set(m.position.x - mid.x, m.position.y - box.min.y, m.position.z - mid.z);
    return m;
  }, [fbx]);

  const mixer = useMemo(() => new AnimationMixer(model), [model]);
  const actions = useMemo(() => {
    const a = {
      idle: mixer.clipAction(idle.animations[0]),
      walk: mixer.clipAction(walk.animations[0]),
    };
    a.idle.play();
    a.walk.play().setEffectiveWeight(0);
    return a;
  }, [mixer, idle, walk]);
  useEffect(() => () => void mixer.stopAllAction(), [mixer]);

  const blend = useRef(0);
  useFrame((_, dt) => {
    blend.current +=
      ((pose.moving ? 1 : 0) - blend.current) * Math.min(1, dt * 8);
    actions.walk.setEffectiveWeight(blend.current);
    actions.idle.setEffectiveWeight(1 - blend.current);
    mixer.update(dt);
  });

  return (
    <group ref={root}>
      <primitive object={model} />
    </group>
  );
}
