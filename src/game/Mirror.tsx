import { Suspense, useEffect, useMemo, useRef } from "react";
import { Hero } from "./Hero";
import { useFrame } from "@react-three/fiber";
import { Group, PlaneGeometry } from "three";
import { Reflector } from "three/examples/jsm/objects/Reflector.js";
import { BATHROOM, MIRROR } from "./layout";
import { HERO_LAYER } from "./Hero";
import { pose } from "./pose";

/**
 * The hero's body. In first-person only the mirror sees it (render layer 1);
 * in third-person (V) the main camera turns layer 1 on too.
 */
export function HeroAndMirror() {
  const body = useRef<Group>(null);
  const reflector = useMemo(
    () =>
      new Reflector(new PlaneGeometry(MIRROR.w, MIRROR.h), {
        textureWidth: 1024,
        textureHeight: 800,
        color: 0x9aa4a6,
      }),
    [],
  );

  useEffect(() => {
    // The hero lives on layer 1: the mirror's camera sees it, the first-person camera doesn't.
    reflector.camera.layers.enable(HERO_LAYER);
    return () => reflector.dispose();
  }, [reflector]);

  useFrame(() => {
    // Reflections cost a second render, so draw the mirror only while you are in the bathroom.
    reflector.visible =
      pose.x > BATHROOM.minX &&
      pose.x < BATHROOM.maxX &&
      pose.z > BATHROOM.minZ &&
      pose.z < BATHROOM.maxZ;
    const b = body.current;
    if (b) {
      b.position.set(pose.x, 0, pose.z);
      b.rotation.y = pose.yaw + Math.PI; // the Rocketbox model faces +z
    }
  });

  return (
    <>
      <primitive object={reflector} position={[MIRROR.x, MIRROR.y, MIRROR.z]} />
      <mesh position={[MIRROR.x, MIRROR.y, MIRROR.z - 0.01]}>
        <planeGeometry args={[MIRROR.w + 0.08, MIRROR.h + 0.08]} />
        <meshStandardMaterial color="#5c4a38" />
      </mesh>
      <group ref={body}>
        <Suspense fallback={null}>
          <Hero />
        </Suspense>
      </group>
    </>
  );
}
