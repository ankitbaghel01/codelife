import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type MutableRefObject,
} from "react";
import { Canvas, useFrame } from "@react-three/fiber";
import {
  Bloom,
  EffectComposer,
  ToneMapping,
  Vignette,
} from "@react-three/postprocessing";
import { ToneMappingMode } from "postprocessing";
import { DirectionalLight, Group, PerspectiveCamera, Vector3 } from "three";
import { COM, Motorbike } from "./bike/Motorbike";
import { Particles, Pickups } from "./bike/Dynamic";
import { Scenery, SUN_DIR } from "./bike/Scenery";
import {
  multiplier,
  newSim,
  stars,
  step,
  type Input,
  type Sim,
  type StuntEvent,
} from "./bike/sim";
import { CHECKPOINTS, HALF_ROAD, LENGTH, heading, toWorld } from "./bike/track";
import "./world.css";
import "./biketrip.css";

type Phase = "intro" | "countdown" | "ride" | "finished";
const BEST_KEY = "codelife.biketrip.best";

function readBest() {
  try {
    return Number(localStorage.getItem(BEST_KEY)) || 0;
  } catch {
    return 0;
  }
}
function saveBest(score: number) {
  try {
    localStorage.setItem(BEST_KEY, String(score));
  } catch {
    /* private mode: the best score just isn't remembered */
  }
}

function readInput(k: Set<string>): Input {
  return {
    throttle: k.has("w") || k.has("arrowup"),
    brake: k.has("s") || k.has("arrowdown"),
    steer:
      (k.has("d") || k.has("arrowright") ? 1 : 0) -
      (k.has("a") || k.has("arrowleft") ? 1 : 0),
  };
}

const fmtTime = (t: number) =>
  `${Math.floor(t / 60)}:${(t % 60).toFixed(1).padStart(4, "0")}`;

/** Steps the simulation and drives the bike, chase camera, sun shadow and sky every frame. */
function Rig({
  sim,
  keys,
  phase,
  paused,
  reduced,
}: {
  sim: MutableRefObject<Sim>;
  keys: MutableRefObject<Set<string>>;
  phase: MutableRefObject<Phase>;
  paused: MutableRefObject<boolean>;
  reduced: boolean;
}) {
  const bike = useRef<Group>(null);
  const light = useRef<DirectionalLight>(null);
  const pitchInput = useRef(0);
  const cam = useRef({
    pos: new Vector3(),
    look: new Vector3(),
    orbit: 0,
    ready: false,
  });
  const tmp = useMemo(() => ({ want: new Vector3(), look: new Vector3() }), []);

  useFrame(({ camera, scene }, dt0) => {
    const dt = Math.min(dt0, 1 / 30);
    const s = sim.current;
    const ph = phase.current;
    const input = readInput(keys.current);
    pitchInput.current = (input.brake ? 1 : 0) - (input.throttle ? 1 : 0);
    if ((ph === "ride" || ph === "finished") && !paused.current) {
      step(s, input, dt / 2);
      step(s, input, dt / 2);
    }

    const h = heading(s.s);
    const [x, , z] = toWorld(s.s, s.l, 0);
    const y = s.y + COM;
    if (bike.current) {
      bike.current.position.set(x, y, z);
      bike.current.rotation.set(s.pitch, -h, s.lean + s.roll, "YXZ");
    }

    // Chase camera; slow orbit on the intro and results screens.
    const c = cam.current;
    const fx = Math.sin(h);
    const fz = -Math.cos(h);
    if (ph === "intro" || ph === "finished") {
      c.orbit += dt * 0.22;
      const a = c.orbit + h + 2.2;
      tmp.want.set(x + Math.sin(a) * 7, y + 2.2, z + Math.cos(a) * 7);
    } else {
      const back = 4.6 + s.speed * 0.03;
      tmp.want.set(x - fx * back, y + 1.9 + (s.air ? 0.6 : 0), z - fz * back);
    }
    const orbiting = ph === "intro" || ph === "finished";
    tmp.look.set(x + (orbiting ? 0 : fx * 4), y + (orbiting ? -1.4 : 0.7), z + (orbiting ? 0 : fz * 4));
    if (!c.ready) {
      c.pos.copy(tmp.want);
      c.look.copy(tmp.look);
      c.ready = true;
    }
    c.pos.lerp(tmp.want, 1 - Math.exp(-dt * 12));
    c.look.lerp(tmp.look, 1 - Math.exp(-dt * 10));
    camera.position.copy(c.pos);
    if (!reduced && s.shake > 0) {
      const k = s.shake * 0.25;
      camera.position.x += (Math.random() - 0.5) * k;
      camera.position.y += (Math.random() - 0.5) * k;
    }
    camera.lookAt(c.look);
    const pc = camera as PerspectiveCamera;
    const fov = 60 + Math.min(1, s.speed / 34) * 16 + (s.boostT > 0 ? 6 : 0);
    if (Math.abs(pc.fov - fov) > 0.05) {
      pc.fov += (fov - pc.fov) * Math.min(1, dt * 3);
      pc.updateProjectionMatrix();
    }

    // Sun shadow follows the bike; the sky dome follows the camera.
    const L = light.current;
    if (L) {
      L.position.set(
        x + SUN_DIR[0] * 60,
        y + SUN_DIR[1] * 60,
        z + SUN_DIR[2] * 60,
      );
      L.target.position.set(x, y, z);
      L.target.updateMatrixWorld();
    }
    const sky = scene.getObjectByName("sky");
    if (sky) sky.position.copy(camera.position);
  });

  return (
    <>
      <hemisphereLight args={["#ffe2b8", "#5b6b3a", 0.6]} />
      <directionalLight
        ref={light}
        intensity={1.7}
        color="#ffd29a"
        castShadow
        shadow-mapSize={[1024, 1024]}
        shadow-camera-left={-22}
        shadow-camera-right={22}
        shadow-camera-top={22}
        shadow-camera-bottom={-22}
        shadow-camera-near={1}
        shadow-camera-far={140}
        shadow-bias={-0.0006}
        shadow-normalBias={0.04}
      />
      <group ref={bike}>
        <Motorbike sim={sim} pitchInput={pitchInput} />
      </group>
    </>
  );
}

type Hud = {
  s: number;
  speed: number;
  score: number;
  mult: number;
  comboLeft: number;
  coins: number;
  time: number;
  boost: boolean;
  offRoad: boolean;
  air: boolean;
};
type Popup = StuntEvent & { id: number };
type Results = {
  time: number;
  score: number;
  bestCombo: number;
  flips: number;
  perfects: number;
  coins: number;
  crashes: number;
  stars: number;
  best: number;
  newBest: boolean;
  skipped: boolean;
};

const hudOf = (s: Sim): Hud => ({
  s: Math.min(LENGTH, s.s),
  speed: s.speed,
  score: s.score,
  mult: multiplier(s),
  comboLeft: s.combo > 0 ? Math.max(0, 1 - s.comboT / 6) : 0,
  coins: s.coins,
  time: s.time,
  boost: s.boostT > 0,
  offRoad: Math.abs(s.l) > HALF_ROAD,
  air: s.air,
});

function Speedo({ speed, boost }: { speed: number; boost: boolean }) {
  const kmh = Math.round(speed * 3.6);
  const frac = Math.min(1, kmh / 130);
  const angle = -120 + frac * 240;
  return (
    <div
      className={`bt-speedo${boost ? " boost" : ""}`}
      aria-label={`${kmh} km/h`}
    >
      <svg viewBox="0 0 120 120" aria-hidden="true">
        <path
          className="bt-gauge-track"
          d="M 21.9 82 A 44 44 0 1 1 98.1 82"
          pathLength={100}
        />
        <path
          className="bt-gauge-fill"
          d="M 21.9 82 A 44 44 0 1 1 98.1 82"
          pathLength={100}
          strokeDasharray={`${frac * 100} 100`}
        />
        <line
          className="bt-needle"
          x1="60"
          y1="60"
          x2="60"
          y2="22"
          style={{ transform: `rotate(${angle}deg)` }}
        />
        <circle cx="60" cy="60" r="5" className="bt-hub" />
      </svg>
      <div className="bt-speed-num">
        <strong>{kmh}</strong>
        <span>km/h</span>
      </div>
      {boost && <span className="bt-boost-tag">Boost</span>}
    </div>
  );
}

const TOUCH: { key: string; label: string; area: string }[] = [
  { key: "a", label: "◀", area: "left" },
  { key: "d", label: "▶", area: "right" },
  { key: "s", label: "Brake", area: "brake" },
  { key: "w", label: "Gas", area: "gas" },
];

/** The company trip: a stunt ride up the valley road to the Mistgiri Hills viewpoint. */
export function BikeTrip({
  company,
  onDone,
}: {
  company: string;
  onDone: () => void;
}) {
  const sim = useRef<Sim>(newSim());
  const keys = useRef(new Set<string>());
  const [phase, setPhaseState] = useState<Phase>("intro");
  const phaseRef = useRef<Phase>("intro");
  const [paused, setPausedState] = useState(false);
  const pausedRef = useRef(false);
  const [count, setCount] = useState<number | null>(null);
  const [hud, setHud] = useState<Hud>(() => hudOf(sim.current));
  const [popups, setPopups] = useState<Popup[]>([]);
  const [results, setResults] = useState<Results | null>(null);
  const best = useRef(readBest());
  const doneOnce = useRef(false);
  const popupId = useRef(0);
  const reduced = useMemo(
    () => matchMedia("(prefers-reduced-motion: reduce)").matches,
    [],
  );

  const setPhase = useCallback((p: Phase) => {
    phaseRef.current = p;
    setPhaseState(p);
  }, []);
  const setPaused = useCallback((p: boolean) => {
    pausedRef.current = p;
    setPausedState(p);
  }, []);

  const finish = useCallback(
    (skipped: boolean) => {
      const s = sim.current;
      s.finished = true;
      const newBest = !skipped && s.score > best.current;
      if (newBest) {
        best.current = s.score;
        saveBest(s.score);
      }
      setResults({
        time: s.time,
        score: s.score,
        bestCombo: s.bestCombo,
        flips: s.flips,
        perfects: s.perfects,
        coins: s.coins,
        crashes: s.crashes,
        stars: skipped ? 0 : stars(s.score),
        best: best.current,
        newBest,
        skipped,
      });
      setPaused(false);
      setPhase("finished");
    },
    [setPaused, setPhase],
  );

  const start = useCallback(() => {
    if (phaseRef.current === "intro") setPhase("countdown");
  }, [setPhase]);

  const restart = useCallback(() => {
    Object.assign(sim.current, newSim());
    setResults(null);
    setPopups([]);
    setPaused(false);
    setHud(hudOf(sim.current));
    setPhase("countdown");
  }, [setPaused, setPhase]);

  const goHome = useCallback(() => {
    if (doneOnce.current) return;
    doneOnce.current = true;
    onDone();
  }, [onDone]);

  // 3-2-1-GO
  useEffect(() => {
    if (phase !== "countdown") return;
    let n = 3;
    setCount(n);
    const id = window.setInterval(() => {
      n -= 1;
      setCount(n);
      if (n === 0) setPhase("ride");
      if (n < 0) {
        setCount(null);
        window.clearInterval(id);
      }
    }, 750);
    return () => window.clearInterval(id);
  }, [phase, setPhase]);

  // Keyboard on window, so synthetic window KeyboardEvents drive it too.
  useEffect(() => {
    const down = (e: KeyboardEvent) => {
      const k = e.key.toLowerCase();
      if (k === "escape") {
        if (phaseRef.current === "ride") setPaused(!pausedRef.current);
        return;
      }
      if (
        (k === "enter" || k === " ") &&
        phaseRef.current === "intro" &&
        !(e.target instanceof HTMLButtonElement)
      ) {
        start();
        return;
      }
      if (k.startsWith("arrow") || k === " ") e.preventDefault();
      keys.current.add(k);
    };
    const up = (e: KeyboardEvent) => keys.current.delete(e.key.toLowerCase());
    const blur = () => keys.current.clear();
    window.addEventListener("keydown", down);
    window.addEventListener("keyup", up);
    window.addEventListener("blur", blur);
    return () => {
      window.removeEventListener("keydown", down);
      window.removeEventListener("keyup", up);
      window.removeEventListener("blur", blur);
    };
  }, [setPaused, start]);

  // HUD + popups at 10 Hz; also notices crossing the finish line.
  useEffect(() => {
    const id = window.setInterval(() => {
      const s = sim.current;
      setHud(hudOf(s));
      const evs = s.events.splice(0);
      if (evs.length) {
        const fresh = evs.map((e) => ({ ...e, id: ++popupId.current }));
        setPopups((p) => [...p, ...fresh].slice(-4));
        for (const f of fresh)
          window.setTimeout(
            () => setPopups((p) => p.filter((x) => x.id !== f.id)),
            1700,
          );
      }
      if (s.finished && phaseRef.current === "ride") finish(false);
    }, 100);
    return () => window.clearInterval(id);
  }, [finish]);

  useEffect(() => {
    if (import.meta.env.DEV)
      Object.assign(window, { __bike: { sim, keys, restart, finish } });
  }, [restart, finish]);

  const press = (k: string, on: boolean) =>
    on ? keys.current.add(k) : keys.current.delete(k);
  const progress = hud.s / LENGTH;

  return (
    <div className="biketrip bt" role="dialog" aria-label="Bike trip">
      <Canvas
        shadows
        camera={{ fov: 62, near: 0.1, far: 900 }}
        dpr={[1, 1.5]}
        gl={{ powerPreference: "high-performance", antialias: false }}
      >
        <Scenery />
        <Pickups sim={sim} />
        <Particles sim={sim} />
        <Rig
          sim={sim}
          keys={keys}
          phase={phaseRef}
          paused={pausedRef}
          reduced={reduced}
        />
        <EffectComposer multisampling={2}>
          <Bloom
            intensity={0.55}
            luminanceThreshold={1}
            luminanceSmoothing={0.25}
            mipmapBlur
          />
          <ToneMapping mode={ToneMappingMode.ACES_FILMIC} />
          <Vignette offset={0.28} darkness={0.5} />
        </EffectComposer>
      </Canvas>

      <div
        className="bt-speedlines"
        aria-hidden="true"
        style={{
          opacity:
            phase === "ride" && !paused
              ? Math.max(0, (hud.speed - 20) / 14) * (hud.boost ? 1 : 0.6)
              : 0,
        }}
      />

      {phase !== "intro" && (
        <div className="bt-hud">
          <div className="bt-panel bt-score">
            <p className="eyebrow">{company} team ride</p>
            <div className="bt-score-row">
              <strong className="bt-score-num">
                {hud.score.toLocaleString("en-IN")}
              </strong>
              {hud.mult > 1 && <span className="bt-combo">x{hud.mult}</span>}
            </div>
            <div className="bt-combo-bar" aria-hidden="true">
              <span style={{ transform: `scaleX(${hud.comboLeft})` }} />
            </div>
          </div>

          <div className="bt-panel bt-progress">
            <div className="bt-progress-labels mono">
              <span>Start</span>
              <span>
                {(hud.s / 1000).toFixed(2)} / {(LENGTH / 1000).toFixed(1)} km
              </span>
              <span>View</span>
            </div>
            <div
              className="bt-track"
              role="progressbar"
              aria-valuemin={0}
              aria-valuemax={100}
              aria-valuenow={Math.round(progress * 100)}
              aria-label="Distance to the viewpoint"
            >
              <span
                className="bt-track-fill"
                style={{ transform: `scaleX(${progress})` }}
              />
              {CHECKPOINTS.slice(1).map((c) => (
                <i
                  key={c}
                  className={`bt-tick${hud.s >= c ? " passed" : ""}`}
                  style={{ left: `${(c / LENGTH) * 100}%` }}
                />
              ))}
              <b className="bt-marker" style={{ left: `${progress * 100}%` }} />
            </div>
          </div>

          <div className="bt-panel bt-meta mono">
            <span className="bt-time">{fmtTime(hud.time)}</span>
            <span className="bt-coins">
              <i aria-hidden="true" /> {hud.coins}
            </span>
          </div>

          <Speedo speed={hud.speed} boost={hud.boost} />

          <p className="bt-help">
            {hud.offRoad ? (
              <strong>Gravel! Steer back onto the road.</strong>
            ) : hud.air ? (
              <>
                In the air: <kbd>S</kbd>/<kbd>↓</kbd> backflip · <kbd>W</kbd>/
                <kbd>↑</kbd> frontflip · land level
              </>
            ) : (
              <>
                <kbd>W</kbd>/<kbd>↑</kbd> gas · <kbd>S</kbd>/<kbd>↓</kbd> brake
                · <kbd>A</kbd>
                <kbd>D</kbd> steer · <kbd>Esc</kbd> pause
              </>
            )}
          </p>

          <div className="bt-touch" aria-hidden="true">
            {TOUCH.map((t) => (
              <button
                key={t.key}
                className={`bt-touch-btn ${t.area}`}
                onPointerDown={(e) => {
                  e.currentTarget.setPointerCapture(e.pointerId);
                  press(t.key, true);
                }}
                onPointerUp={() => press(t.key, false)}
                onPointerCancel={() => press(t.key, false)}
                tabIndex={-1}
              >
                {t.label}
              </button>
            ))}
            {phase === "ride" && (
              <button
                className="bt-touch-btn pause"
                onClick={() => setPaused(true)}
                tabIndex={-1}
              >
                II
              </button>
            )}
          </div>
        </div>
      )}

      <div className="bt-popups" aria-live="polite">
        {popups.map((p) => (
          <div key={p.id} className={`bt-popup ${p.kind}`}>
            {p.text}
            {p.pts > 0 && <span> +{p.pts.toLocaleString("en-IN")}</span>}
          </div>
        ))}
      </div>

      {count !== null && (
        <div className="bt-count" key={count} aria-live="assertive">
          {count > 0 ? count : "GO!"}
        </div>
      )}

      {phase === "intro" && (
        <div className="reception bt-overlay">
          <div className="reception-card bt-card">
            <p className="eyebrow">{company} team trip · Mistgiri Hills</p>
            <h2 className="bt-title">Ride to the viewpoint</h2>
            <p className="bt-lede">
              1.5 km of valley road with ramps. Hit them fast, flip in the air
              and land level for big points. Wipe out and you're back at the
              last checkpoint.
            </p>
            <ul className="bt-keys">
              <li>
                <span>
                  <kbd>W</kbd> <kbd>↑</kbd>
                </span>
                Gas · frontflip in the air
              </li>
              <li>
                <span>
                  <kbd>S</kbd> <kbd>↓</kbd>
                </span>
                Brake · backflip in the air
              </li>
              <li>
                <span>
                  <kbd>A</kbd> <kbd>D</kbd>
                </span>
                Steer · stay off the gravel
              </li>
              <li>
                <span>
                  <kbd>Esc</kbd>
                </span>
                Pause
              </li>
            </ul>
            <p className="bt-tip mono">
              Perfect landing = boost. Chain stunts within 6 s to raise the
              multiplier (up to x5).
              {best.current > 0 && (
                <> Your best: {best.current.toLocaleString("en-IN")}.</>
              )}
            </p>
            <div className="reception-actions">
              <button className="btn primary" autoFocus onClick={start}>
                Let's ride
              </button>
            </div>
          </div>
        </div>
      )}

      {paused && phase === "ride" && (
        <div className="reception bt-overlay center">
          <div className="reception-card bt-card">
            <p className="eyebrow">Paused</p>
            <h2 className="bt-title">Take a breather</h2>
            <div className="reception-actions">
              <button
                className="btn primary"
                autoFocus
                onClick={() => setPaused(false)}
              >
                Resume
              </button>
              <button className="btn" onClick={restart}>
                Restart ride
              </button>
              <button className="btn" onClick={() => finish(true)}>
                Skip to the viewpoint
              </button>
            </div>
          </div>
        </div>
      )}

      {phase === "finished" && results && (
        <div className="reception bt-overlay">
          <div className="reception-card bt-card bt-results">
            <p className="eyebrow">
              {results.skipped ? "You skipped ahead" : "You made it"}
            </p>
            <h2 className="bt-title">Mistgiri Hills viewpoint</h2>
            {!results.skipped && (
              <div
                className="bt-stars"
                role="img"
                aria-label={`${results.stars} of 3 stars`}
              >
                {[1, 2, 3].map((n) => (
                  <span
                    key={n}
                    className={n <= results.stars ? "on" : ""}
                    style={{ animationDelay: `${n * 0.15}s` }}
                  >
                    ★
                  </span>
                ))}
              </div>
            )}
            <dl className="bt-stats">
              {(
                [
                  ["Score", results.score.toLocaleString("en-IN")],
                  ["Time", fmtTime(results.time)],
                  ["Best combo", `x${results.bestCombo || 1}`],
                  ["Flips", results.flips],
                  ["Perfect landings", results.perfects],
                  ["Coins", results.coins],
                  ["Wipeouts", results.crashes],
                ] as const
              ).map(([k, v]) => (
                <div key={k}>
                  <dt>{k}</dt>
                  <dd>{v}</dd>
                </div>
              ))}
              <div>
                <dt>Best score</dt>
                <dd>
                  {results.best.toLocaleString("en-IN")}
                  {results.newBest && <em className="bt-new">New!</em>}
                </dd>
              </div>
            </dl>
            <p className="reception-line">
              The whole team stops at the viewpoint. Chai, a view over the
              valley, and an easy ride back. You feel fully rested.
            </p>
            <div className="reception-actions">
              <button className="btn primary" autoFocus onClick={goHome}>
                Finish the trip
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
