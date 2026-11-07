import { useMemo } from "react";
import { CanvasTexture, SRGBColorSpace } from "three";

type Props = {
  at: [number, number, number];
  rotY?: number;
  size: [number, number];
  variant: "hills" | "city";
};

/** A framed travel-style poster painted on a canvas, so the walls have art without extra downloads. */
function paint(variant: Props["variant"]) {
  const c = document.createElement("canvas");
  c.width = 384;
  c.height = 512;
  const g = c.getContext("2d")!;
  const sky = g.createLinearGradient(0, 0, 0, 340);
  if (variant === "hills") {
    sky.addColorStop(0, "#f7d9a0");
    sky.addColorStop(1, "#f3b26a");
    g.fillStyle = sky;
    g.fillRect(0, 0, 384, 512);
    g.fillStyle = "#fff3d6";
    g.beginPath();
    g.arc(250, 150, 46, 0, Math.PI * 2);
    g.fill();
    const hills = ["#7ea35a", "#4f7d3a", "#2f5a2b"];
    hills.forEach((col, i) => {
      g.fillStyle = col;
      g.beginPath();
      g.moveTo(0, 300 + i * 50);
      for (let x = 0; x <= 384; x += 32)
        g.lineTo(x, 280 + i * 55 + Math.sin(x / 60 + i * 2) * 26);
      g.lineTo(384, 512);
      g.lineTo(0, 512);
      g.fill();
    });
  } else {
    sky.addColorStop(0, "#2d3b5c");
    sky.addColorStop(1, "#e98a4f");
    g.fillStyle = sky;
    g.fillRect(0, 0, 384, 512);
    for (let i = 0; i < 14; i++) {
      const w = 22 + ((i * 37) % 30);
      const h = 120 + ((i * 53) % 180);
      g.fillStyle = i % 2 ? "#1d2436" : "#26304a";
      g.fillRect(i * 28 - 6, 430 - h, w, h + 82);
      g.fillStyle = "#f6c76b";
      for (let y = 440 - h; y < 420; y += 18)
        if ((y + i) % 3) g.fillRect(i * 28, y, 4, 6);
    }
  }
  g.fillStyle = variant === "hills" ? "#2f3a24" : "#f5efe6";
  g.font = "bold 34px Georgia, serif";
  g.textAlign = "center";
  g.fillText(variant === "hills" ? "NANDI HILLS" : "NAMMA NAGAR", 192, 486);
  const t = new CanvasTexture(c);
  t.colorSpace = SRGBColorSpace;
  return t;
}

export function Poster({ at, rotY = 0, size, variant }: Props) {
  const tex = useMemo(() => paint(variant), [variant]);
  const [w, h] = size;
  return (
    <group position={at} rotation={[0, rotY, 0]}>
      <mesh position={[0, 0, -0.005]} castShadow>
        <boxGeometry args={[w + 0.05, h + 0.05, 0.02]} />
        <meshStandardMaterial color="#3a2a1c" roughness={0.6} />
      </mesh>
      <mesh position={[0, 0, 0.007]}>
        <planeGeometry args={[w, h]} />
        <meshStandardMaterial map={tex} roughness={0.85} />
      </mesh>
    </group>
  );
}
