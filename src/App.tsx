import { useCallback, useEffect, useRef, useState } from "react";
import { Canvas } from "@react-three/fiber";
import { Scene } from "./game/Scene";
import { Player } from "./game/Player";
import { useGame } from "./game/useGame";
import { CONFIG } from "./game/config.ts";
import {
  canAttend,
  eat,
  findCompany,
  fmtTime,
  goToWork,
  finishShift,
  takeTrip,
  catchUp,
  nextWorkday,
  weekday,
  workTaskSolved,
  whyCantWork,
  interviewOutcome,
  newGame,
  practiceSolved,
  sleep,
  tick,
} from "./game/state.ts";
import { CityMap } from "./world/CityMap";
import { WorkDesk, type Leave } from "./world/WorkDesk";
import { BikeTrip } from "./world/BikeTrip";
import { OfficeScene, Reception } from "./world/OfficeScene";
import { InterviewScreen } from "./ui/interview/InterviewScreen";
import { Menu } from "./ui/Menu";
import { Hud } from "./ui/Hud";
import { Phone } from "./ui/Phone";
import { Laptop } from "./ui/laptop/Laptop";
import { addSolved, loadProblems } from "./ui/laptop/problems.ts";

type Screen = "menu" | "intro" | "play";
// Where the player is. The apartment is walkable; the city is a map; companies are focused scenes.
type Place =
  | { kind: "home" }
  | { kind: "city" }
  | { kind: "reception"; invitationId: string }
  | { kind: "interview"; invitationId: string }
  | { kind: "work"; clockIn: number } // your own desk; interviews happen at other companies
  | { kind: "trip" }
  | { kind: "vacationDone" }; // the trip is over for good: back to work

const LINES: Record<string, string> = {
  mirror: "You look tired, but ready. Today could be the day.",
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
  const [place, setPlace] = useState<Place>({ kind: "home" });
  const atHome = place.kind === "home";
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
    // Real days since the last session pass in the game too (absences, rent, payday).
    update((g) => catchUp(g, new Date().toLocaleDateString("en-CA")));
    enterFullscreen();
    setScreen("intro");
    window.setTimeout(() => setScreen("play"), 3200);
  };

  // In-game clock: 1 real second = 1 game minute, only while you are actually playing.
  useEffect(() => {
    if (screen !== "play" || !locked || phone || !atHome) return;
    const id = window.setInterval(() => update((g) => tick(g, 1)), 1000);
    return () => window.clearInterval(id);
  }, [screen, locked, phone, atHome, update]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (screen !== "play" || laptop || !atHome) return; // laptop, map and interviews own the keyboard
      const typing = e.target instanceof HTMLInputElement;
      if (phone && e.code === "Escape") setPhone(false);
      else if (!typing && e.code === "KeyP") setPhone((p) => !p);
      else if (!typing && e.code === "KeyV" && locked) setThird((t) => !t);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [screen, phone, locked, laptop, atHome]);

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
      } else if (id === "door") {
        setPlace({ kind: "city" });
      } else {
        say(LINES[id] ?? "");
      }
    },
    [update, say],
  );

  const travel = CONFIG.travelMinutes;
  const goPlace = (id: string) => {
    if (!game) return;
    if (id === "home") {
      update((g) => tick(g, travel));
      setPlace({ kind: "home" });
      return;
    }
    const companyId = id.replace(/^company:/, "");
    if (game.job?.companyId === companyId) {
      const r = goToWork(tick(game, travel));
      if (r.error) return say(r.error);
      setGame(r.state);
      setPlace({ kind: "work", clockIn: r.state.minute });
      return;
    }
    const inv = game.invitations.find((v) => v.companyId === companyId && v.day === game.day && v.status !== "expired" && v.status !== "declined");
    const why = inv ? canAttend(game, inv) : "You don't have an interview here.";
    if (!inv || why) return say(why ?? "");
    update((g) => tick(g, travel));
    setPlace({ kind: "reception", invitationId: inv.id });
  };

  // Leaving your desk finishes the shift; you choose where to go next.
  const leaveWork = (to: Leave, clockIn: number, unfinished: string[]) => {
    if (!game) return;
    const g = finishShift(game, clockIn, unfinished);
    if (to === "trip") {
      setGame(g);
      setPlace({ kind: "trip" });
    } else if (to === "city") {
      setGame(g);
      setPlace({ kind: "city" });
    } else {
      setGame(tick(g, travel));
      setPlace({ kind: "home" });
      const home = fmtTime(tick(g, travel).minute);
      say(
        unfinished.length
          ? `You're home at ${home}. ${unfinished.length} unfinished task${unfinished.length === 1 ? "" : "s"} moved to your next workday at half pay.`
          : `You're back home at ${home}, tired but a little better at your job.`,
      );
    }
  };

  // Dev-only hook so automated browser tests can act without pointer lock.
  useEffect(() => {
    if (import.meta.env.DEV) Object.assign(window, { __app: { interact, update, setPlace, game, place } });
  });

  const laptopEl = laptop && (
    <Laptop
      game={game ?? { day: 1, minute: 8 * 60 }}
      onClose={() => setLaptop(false)}
      onSolved={(id) => {
        addSolved(id);
        // Practice raises proficiency through explicit rules (state.ts), only on the first accepted solution.
        loadProblems().then((ps) => {
          const p = ps.find((x) => x.id === id);
          if (p) update((g) => practiceSolved(g, p));
        });
      }}
    />
  );

  const invitation =
    place.kind === "reception" || place.kind === "interview" ? game?.invitations.find((v) => v.id === place.invitationId) : undefined;
  const visiting = invitation ? findCompany(invitation.companyId) : undefined;
  const workplace = place.kind === "work" && game?.job ? findCompany(game.job.companyId) : undefined;

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
      <Canvas
        shadows
        camera={{ fov: 70, near: 0.05, far: 60 }}
        dpr={[1, 1.75]}
        // The bike trip has its own canvas on top; pausing this one keeps the ride smooth.
        frameloop={place.kind === "trip" ? "never" : "always"}
      >
        {visiting || workplace ? (
          <OfficeScene company={(visiting ?? workplace)!} alone={!visiting} />
        ) : (
          <Scene onReady={onSceneReady} />
        )}
        {!visiting && !workplace && (
          <Player
          enabled={screen === "play" && !phone && !laptop && atHome}
          thirdPerson={third}
          onLockChange={setLocked}
          onNear={setNear}
          onInteract={interact}
        />
        )}
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
          {atHome && (
          <Hud
            game={game}
            near={locked ? near : null}
            subtitle={subtitle}
            thirdPerson={third}
          />
          )}
          {!locked && !phone && !laptop && atHome && (
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
          {place.kind === "city" && (
            <CityMap
              day={game.day}
              minute={game.minute}
              invitations={game.invitations}
              job={game.job}
              workWhy={whyCantWork(tick(game, travel))}
              onGo={goPlace}
              onClose={() => setPlace({ kind: "home" })}
            />
          )}
          {place.kind === "work" && workplace && (
            <WorkDesk
              game={game}
              company={workplace}
              clockIn={place.clockIn}
              onSolved={(p) => update((g) => workTaskSolved(g, p))}
              onLeave={(to, unfinished) => leaveWork(to, place.clockIn, unfinished)}
            />
          )}
          {place.kind === "trip" && (
            <BikeTrip
              company={findCompany(game.job?.companyId ?? "")?.name ?? "Your company"}
              onDone={() => {
                const r = takeTrip(game);
                if (r.error) {
                  setPlace({ kind: "home" });
                  return say(r.error);
                }
                setGame(tick(r.state, travel));
                setPlace({ kind: "vacationDone" });
              }}
            />
          )}
          {place.kind === "vacationDone" && (() => {
            const workedToday = game.job?.lastWorkedDay === game.day;
            const next = workedToday ? nextWorkday(game.day + 1, 0) : nextWorkday(game.day, game.minute);
            return (
              <div className="reception vacation" role="dialog" aria-labelledby="vacation-title">
                <div className="reception-card">
                  <p className="eyebrow">
                    Day {game.day} · {weekday(game.day)} · {fmtTime(game.minute)}
                  </p>
                  <h2 id="vacation-title">Vacation complete 🏍️</h2>
                  <p className="reception-line">
                    I hope you enjoyed the ride to Mistgiri Hills! You're home, fully rested. Now it's back to work.
                  </p>
                  <p className="vacation-next">
                    Your next workday: <b>Day {next}, {weekday(next)}</b> · shift 09:00–17:00
                  </p>
                  <div className="reception-actions">
                    <button className="btn primary" autoFocus onClick={() => setPlace({ kind: "home" })}>
                      Back to work
                    </button>
                  </div>
                </div>
              </div>
            );
          })()}
          {place.kind === "reception" && invitation && visiting && (
            <Reception
              company={visiting}
              time={invitation.time}
              onCheckIn={() => setPlace({ kind: "interview", invitationId: invitation.id })}
              onLeave={() => setPlace({ kind: "city" })}
            />
          )}
          {place.kind === "interview" && invitation && (
            <InterviewScreen
              invitation={invitation}
              playerId={game.playerId}
              profile={{ name: game.name, skills: game.skills, resume: game.resume }}
              onExit={() => setPlace({ kind: "city" })}
              onDone={({ evaluation, accepted }) => {
                update((g) => tick(interviewOutcome(g, invitation.id, evaluation.offer, accepted), travel));
                setPlace({ kind: "home" });
                say(
                  evaluation.offer
                    ? accepted
                      ? `You accepted the offer from ${visiting?.name}. Check your phone for your start day.`
                      : "You declined the offer. More companies will call as your skills grow."
                    : "Not this time. Your report shows what to practise next.",
                );
              }}
            />
          )}
        </>
      )}
    </div>
  );
}
