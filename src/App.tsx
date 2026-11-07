import { useCallback, useEffect, useRef, useState } from "react";
import { Canvas } from "@react-three/fiber";
import { Scene } from "./game/Scene";
import { Player } from "./game/Player";
import { useGame } from "./game/useGame";
import { CONFIG } from "./game/config.ts";
import { eat, newGame, sleep, tick } from "./game/state.ts";
import { Menu } from "./ui/Menu";
import { Hud } from "./ui/Hud";
import { Phone } from "./ui/Phone";
import { Laptop } from "./ui/laptop/Laptop";
import { addSolved } from "./ui/laptop/problems.ts";

type Screen = "menu" | "intro" | "play";

const LINES: Record<string, string> = {
  mirror: "You look tired, but ready. Today could be the day.",
  door: "The city is outside. Streets and companies open in the next build (Phase 2).",
};

function enterFullscreen() {
  document.documentElement.requestFullscreen?.().catch(() => {
    /* the browser refused (e.g. iframe); the game still works windowed */
  });
}

export default function App() {
  const { game, setGame, update, hasSave } = useGame();
  const [screen, setScreen] = useState<Screen>("menu");
  const [locked, setLocked] = useState(false);
  const [phone, setPhone] = useState(false);
  // Dev shortcut: ?laptop=1 opens the laptop straight away (no pointer lock needed).
  const [laptop, setLaptop] = useState(
    () =>
      import.meta.env.DEV && new URLSearchParams(location.search).has("laptop"),
  );
  const [third, setThird] = useState(false);
  const [near, setNear] = useState<string | null>(null);
  const [subtitle, setSubtitle] = useState<string | null>(null);
  const timer = useRef<number>();
  const [sceneReady, setSceneReady] = useState(false);
  const onSceneReady = useCallback(() => setSceneReady(true), []);

  const say = useCallback((text: string) => {
    setSubtitle(text);
    window.clearTimeout(timer.current);
    timer.current = window.setTimeout(() => setSubtitle(null), 4500);
  }, []);

  const begin = () => {
    enterFullscreen();
    setScreen("intro");
    window.setTimeout(() => setScreen("play"), 3200);
  };

  // In-game clock: 1 real second = 1 game minute, only while you are actually playing.
  useEffect(() => {
    if (screen !== "play" || !locked || phone) return;
    const id = window.setInterval(() => update((g) => tick(g, 1)), 1000);
    return () => window.clearInterval(id);
  }, [screen, locked, phone, update]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (screen !== "play" || laptop) return; // the laptop owns the keyboard while open
      const typing = e.target instanceof HTMLInputElement;
      if (phone && e.code === "Escape") setPhone(false);
      else if (!typing && e.code === "KeyP") setPhone((p) => !p);
      else if (!typing && e.code === "KeyV" && locked) setThird((t) => !t);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [screen, phone, locked, laptop]);

  const interact = useCallback(
    (id: string) => {
      if (id === "bed") {
        update(sleep);
        say("You sleep through the night. A new day, full energy.");
      } else if (id === "kitchen") {
        update((g) => {
          const r = eat(g);
          say(r.error ?? `You cook a simple meal. −₹${CONFIG.costs.meal}.`);
          return r.state;
        });
      } else if (id === "laptop") {
        setLaptop(true);
      } else {
        say(LINES[id] ?? "");
      }
    },
    [update, say],
  );

  const laptopEl = laptop && (
    <Laptop
      game={game ?? { day: 1, minute: 8 * 60 }}
      onClose={() => setLaptop(false)}
      onSolved={addSolved}
    />
  );

  if (screen === "menu" || !game) {
    return (
      laptopEl || (
        <Menu
          hasSave={hasSave}
          onContinue={begin}
          onNewGame={(name) => {
            setGame(newGame(name));
            begin();
          }}
        />
      )
    );
  }

  return (
    <div className="stage">
      <Canvas shadows camera={{ fov: 70, near: 0.05, far: 60 }} dpr={[1, 1.75]}>
        <Scene onReady={onSceneReady} />
        <Player
          enabled={screen === "play" && !phone && !laptop}
          thirdPerson={third}
          onLockChange={setLocked}
          onNear={setNear}
          onInteract={interact}
        />
      </Canvas>

      {!sceneReady && screen === "play" && (
        <div className="intro loading" role="status">
          <p className="mono">LOADING YOUR ROOM…</p>
        </div>
      )}

      {screen === "intro" && (
        <div className="intro">
          <p className="mono">
            DAY {game.day} ·{" "}
            {Math.floor(game.minute / 60) < 12 ? "MORNING" : "LATER"}
          </p>
          <p>Your alarm rings. {game.name}, it’s time to get up.</p>
        </div>
      )}

      {screen === "play" && (
        <>
          <Hud
            game={game}
            near={locked ? near : null}
            subtitle={subtitle}
            thirdPerson={third}
          />
          {!locked && !phone && !laptop && (
            <div className="pause">
              <div className="menu-card">
                <h2>Paused</h2>
                <p className="help">
                  Click Resume, then move the mouse to look around.
                </p>
                <div className="menu-actions">
                  <button
                    className="btn primary"
                    onClick={() => document.querySelector("canvas")?.click()}
                  >
                    Resume
                  </button>
                  <button className="btn" onClick={() => setPhone(true)}>
                    Open phone
                  </button>
                  <button
                    className="btn"
                    onClick={() => {
                      document.exitFullscreen?.().catch(() => {});
                      setScreen("menu");
                    }}
                  >
                    Save and quit to menu
                  </button>
                </div>
                <p className="help">Your game saves automatically.</p>
              </div>
            </div>
          )}
          {phone && (
            <Phone
              game={game}
              onChange={setGame}
              onClose={() => setPhone(false)}
            />
          )}
          {laptopEl}
        </>
      )}
    </div>
  );
}
