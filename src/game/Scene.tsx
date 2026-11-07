import { Suspense, useEffect } from "react";
import {
  Bloom,
  EffectComposer,
  N8AO,
  ToneMapping,
  Vignette,
} from "@react-three/postprocessing";
import { ToneMappingMode } from "postprocessing";
import { Flat } from "./Flat";
import { HeroAndMirror } from "./Mirror";

function Ready({ onReady }: { onReady: () => void }) {
  useEffect(onReady, [onReady]);
  return null;
}

/** Everything drawn in the apartment, plus the film look: ambient occlusion, soft bloom, AgX tone mapping. */
export function Scene({ onReady }: { onReady: () => void }) {
  return (
    <>
      <Suspense fallback={null}>
        <Flat />
        <Ready onReady={onReady} />
      </Suspense>
      <HeroAndMirror />
      <EffectComposer multisampling={0}>
        <N8AO
          halfRes
          aoRadius={0.6}
          intensity={2.2}
          distanceFalloff={0.5}
          color="#2a1a10"
        />
        <Bloom
          intensity={0.35}
          luminanceThreshold={0.85}
          luminanceSmoothing={0.2}
          mipmapBlur
        />
        <ToneMapping mode={ToneMappingMode.ACES_FILMIC} />
        <Vignette offset={0.3} darkness={0.45} />
      </EffectComposer>
    </>
  );
}
