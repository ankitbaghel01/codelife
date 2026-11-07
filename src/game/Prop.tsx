import { useMemo } from "react";
import { useLoader } from "@react-three/fiber";
import { Box3, Mesh, Vector3 } from "three";
import { GLTFLoader } from "three/examples/jsm/loaders/GLTFLoader.js";

type Props = {
  name: string; // Poly Haven model id, stored under public/assets/models/<name>/<name>.gltf
  at: [number, number, number]; // where the bottom-centre of the model goes
  rotY?: number;
  height?: number; // uniform scale so the model is this tall
  size?: [number, number, number]; // or stretch to this exact w/h/d (before rotation)
};

const box = new Box3();
const dims = new Vector3();
const centre = new Vector3();

/** A CC0 model placed by its real bounding box, so positions in layout.ts stay in plain metres. */
export function Prop({ name, at, rotY = 0, height, size }: Props) {
  const gltf = useLoader(GLTFLoader, `/assets/models/${name}/${name}.gltf`);
  const obj = useMemo(() => {
    const o = gltf.scene.clone(true);
    o.traverse((c) => {
      if ((c as Mesh).isMesh) {
        c.castShadow = true;
        c.receiveShadow = true;
      }
    });
    box.setFromObject(o).getSize(dims);
    if (size) o.scale.set(size[0] / dims.x, size[1] / dims.y, size[2] / dims.z);
    else if (height) o.scale.setScalar(height / dims.y);
    box.setFromObject(o).getCenter(centre);
    o.position.set(-centre.x, -box.min.y, -centre.z);
    return o;
  }, [gltf, height, size]);

  return (
    <group position={at} rotation={[0, rotY, 0]}>
      <primitive object={obj} />
    </group>
  );
}
