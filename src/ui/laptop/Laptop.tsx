import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type PointerEvent as RPointerEvent,
  type ReactNode,
} from "react";
import { fmtTime } from "../../game/state.ts";
import { CodeApp } from "./Code";
import { FilesApp } from "./Files";
import * as I from "./icons";
import {
  fileName,
  nextProblem,
  readSolved,
  type Problem,
} from "./problems.ts";
import "./laptop.css";

type Props = {
  game: { day: number; minute: number };
  onClose: () => void;
  onSolved: (problemId: string) => void;
};
type AppId = "files" | "code";
type Win = {
  open: boolean;
  min: boolean;
  max: boolean;
  z: number;
  x: number;
  y: number;
  w: number;
  h: number;
};

const APP_NAME: Record<AppId, string> = { files: "Files", code: "Code" };

export function Laptop({ game, onClose, onSolved }: Props) {
  const [wins, setWins] = useState<Record<AppId, Win>>({
    files: {
      open: true,
      min: false,
      max: false,
      z: 2,
      x: 72,
      y: 40,
      // Fit above the dock on small screens (1280x720).
      w: Math.min(900, window.innerWidth - 220),
      h: Math.min(560, window.innerHeight - 240),
    },
    code: {
      open: false,
      min: false,
      max: true,
      z: 1,
      x: 120,
      y: 36,
      w: 1100,
      h: 680,
    },
  });
  const [problem, setProblem] = useState<Problem | null>(null);
  const [reveal, setReveal] = useState<{ problem: Problem }>();
  const [solved, setSolved] = useState(readSolved);
  const [menu, setMenu] = useState(false);
  const [shutdown, setShutdown] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);

  const visible = (Object.keys(wins) as AppId[])
    .filter((id) => wins[id].open && !wins[id].min)
    .sort((a, b) => wins[b].z - wins[a].z);
  const focused = visible[0] ?? null;

  const patch = useCallback(
    (id: AppId, p: Partial<Win>) =>
      setWins((w) => ({ ...w, [id]: { ...w[id], ...p } })),
    [],
  );
  const focus = useCallback(
    (id: AppId) =>
      setWins((w) => {
        const top = Math.max(...Object.values(w).map((x) => x.z));
        return w[id].z === top && w[id].open && !w[id].min
          ? w
          : { ...w, [id]: { ...w[id], open: true, min: false, z: top + 1 } };
      }),
    [],
  );
  const closeWin = (id: AppId) => patch(id, { open: false });

  const openProblem = useCallback(
    (p: Problem) => {
      setProblem(p);
      patch("code", { max: true });
      focus("code");
    },
    [patch, focus],
  );
  const markSolved = useCallback(
    (id: string) => {
      setSolved((s) => (s.includes(id) ? s : [...s, id]));
      onSolved(id);
    },
    [onSolved],
  );

  // Esc closes the topmost thing; with nothing open it asks before shutting down.
  // Bubble phase + defaultPrevented: Monaco and in-app dialogs consume their own Esc first.
  const esc = useRef(() => {});
  esc.current = () => {
    if (shutdown) setShutdown(false);
    else if (menu) setMenu(false);
    else if (focused) closeWin(focused);
    else setShutdown(true);
  };
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape" && !e.defaultPrevented) {
        e.preventDefault();
        esc.current();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  // Keep keyboard focus inside the laptop so keys never fall through to the room.
  useEffect(() => rootRef.current?.focus(), []);

  const dockApp = (id: AppId, label: string, icon: ReactNode) => (
    <button
      className={`lt-dock-btn${wins[id].open ? " running" : ""}`}
      aria-label={`${label}${wins[id].open ? " (open)" : ""}`}
      data-tip={label}
      onClick={() => (focused === id ? patch(id, { min: true }) : focus(id))}
    >
      {icon}
    </button>
  );

  return (
    <div className="lt" role="dialog" aria-label="Laptop" aria-modal="true">
      <div className="lt-lid">
        <span className="lt-cam" aria-hidden="true" />
        <div className="lt-screen" ref={rootRef} tabIndex={-1}>
          <header className="lt-topbar">
            <div className="lt-top-left">
              <button
                className="lt-os-btn"
                aria-haspopup="menu"
                aria-expanded={menu}
                onClick={() => setMenu((m) => !m)}
              >
                <I.Logo />
                <span>ByteOS</span>
              </button>
              <b className="lt-app-name">
                {focused ? APP_NAME[focused] : "Desktop"}
              </b>
            </div>
            <div className="lt-top-right" aria-label="Status">
              <span className="lt-ico" title="Wi-Fi: connected">
                <I.Wifi />
              </span>
              <span className="lt-ico" title="Battery: 82%">
                <I.Battery />
              </span>
              <span className="lt-clock mono">
                <span>Day {game.day}</span>
                <span>{fmtTime(game.minute)}</span>
              </span>
            </div>
            {menu && (
              <>
                <div className="lt-scrim" onMouseDown={() => setMenu(false)} />
                <div className="lt-menu" role="menu" aria-label="ByteOS">
                  <MenuItem
                    autoFocus
                    onClick={() => (setMenu(false), focus("files"))}
                  >
                    Open Files
                  </MenuItem>
                  <MenuItem onClick={() => (setMenu(false), focus("code"))}>
                    Open Code
                  </MenuItem>
                  <hr />
                  <MenuItem onClick={() => (setMenu(false), setShutdown(true))}>
                    Shut down…
                  </MenuItem>
                </div>
              </>
            )}
          </header>

          <main className="lt-desk">
            {!visible.length && (
              <div className="lt-note">
                <p className="lt-note-eyebrow mono">ByteOS</p>
                <p>
                  Your practice problems live in Files. Pick one to open it in
                  Code.
                </p>
                <button
                  className="lt-btn primary"
                  onClick={() => focus("files")}
                >
                  Open Files
                </button>
              </div>
            )}

            {(Object.keys(wins) as AppId[]).map((id) => {
              const w = wins[id];
              if (!w.open) return null;
              const title =
                id === "code" && problem
                  ? `${fileName(problem)} — Code`
                  : APP_NAME[id];
              return (
                <Window
                  key={id}
                  title={title}
                  win={w}
                  focused={focused === id}
                  onFocus={() => focus(id)}
                  onClose={() => closeWin(id)}
                  onMin={() => patch(id, { min: true })}
                  onMax={() => patch(id, { max: !w.max })}
                  onMove={(x, y) => patch(id, { x, y })}
                >
                  {id === "files" ? (
                    <FilesApp solved={solved} onOpen={openProblem} reveal={reveal} />
                  ) : (
                    <CodeApp
                      problem={problem}
                      solved={!!problem && solved.includes(problem.id)}
                      onSolved={markSolved}
                      onOpenFiles={() => focus("files")}
                      onShowFolder={() => {
                        if (problem) setReveal({ problem });
                        focus("files");
                      }}
                      onNext={() => {
                        if (!problem) return;
                        nextProblem(problem, solved).then((p) =>
                          p ? openProblem(p) : (setReveal({ problem }), focus("files")),
                        );
                      }}
                    />
                  )}
                </Window>
              );
            })}
          </main>

          <nav className="lt-dock" aria-label="Dock">
            {dockApp("files", "Files", <I.FilesApp />)}
            {dockApp("code", "Code", <I.CodeApp />)}
            <button
              className="lt-dock-btn disabled"
              aria-disabled="true"
              aria-label="Browser, not available yet"
              data-tip="Browser · not available yet"
            >
              <I.BrowserApp />
              <span className="lt-dock-lock">
                <I.Lock />
              </span>
            </button>
            <span className="lt-dock-sep" aria-hidden="true" />
            <button
              className="lt-dock-btn"
              aria-label="Power: close the laptop"
              data-tip="Close laptop"
              onClick={onClose}
            >
              <I.PowerApp />
            </button>
          </nav>

          {shutdown && (
            <div className="lt-modal-scrim">
              <div
                className="lt-modal"
                role="alertdialog"
                aria-labelledby="lt-sd-title"
                aria-describedby="lt-sd-desc"
              >
                <h2 id="lt-sd-title">Shut down?</h2>
                <p id="lt-sd-desc">
                  Your code is saved on this laptop. You’ll return to the room.
                </p>
                <div className="lt-modal-actions">
                  <button className="lt-btn" onClick={() => setShutdown(false)}>
                    Cancel
                  </button>
                  <button className="lt-btn danger" autoFocus onClick={onClose}>
                    Shut down
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
      <div className="lt-base" aria-hidden="true">
        <span />
      </div>
    </div>
  );
}

function MenuItem(props: {
  children: ReactNode;
  onClick: () => void;
  autoFocus?: boolean;
}) {
  return (
    <button
      role="menuitem"
      className="lt-menu-item"
      autoFocus={props.autoFocus}
      onClick={props.onClick}
      onKeyDown={(e) => {
        const dir = e.key === "ArrowDown" ? 1 : e.key === "ArrowUp" ? -1 : 0;
        if (!dir) return;
        e.preventDefault();
        const items = [
          ...e.currentTarget.parentElement!.querySelectorAll<HTMLElement>(
            "[role=menuitem]",
          ),
        ];
        items[
          (items.indexOf(e.currentTarget) + dir + items.length) % items.length
        ].focus();
      }}
    >
      {props.children}
    </button>
  );
}

function Window(props: {
  title: string;
  win: Win;
  focused: boolean;
  children: ReactNode;
  onFocus: () => void;
  onClose: () => void;
  onMin: () => void;
  onMax: () => void;
  onMove: (x: number, y: number) => void;
}) {
  const { win, title } = props;
  const drag = (e: RPointerEvent<HTMLElement>) => {
    if (
      win.max ||
      e.button !== 0 ||
      (e.target as HTMLElement).closest("button")
    )
      return;
    const el = e.currentTarget;
    const sx = e.clientX - win.x;
    const sy = e.clientY - win.y;
    el.setPointerCapture(e.pointerId);
    const move = (m: PointerEvent) =>
      props.onMove(m.clientX - sx, Math.max(0, m.clientY - sy));
    const up = () => {
      el.removeEventListener("pointermove", move);
      el.removeEventListener("pointerup", up);
    };
    el.addEventListener("pointermove", move);
    el.addEventListener("pointerup", up);
  };
  return (
    <section
      className={`lt-win${win.max ? " max" : ""}${props.focused ? " focused" : ""}`}
      style={{
        zIndex: win.z,
        display: win.min ? "none" : undefined,
        ...(win.max
          ? {}
          : { left: win.x, top: win.y, width: win.w, height: win.h }),
      }}
      aria-label={title}
      onMouseDownCapture={props.onFocus}
      onFocusCapture={props.onFocus}
    >
      <header
        className="lt-titlebar"
        onPointerDown={drag}
        onDoubleClick={props.onMax}
      >
        <span className="lt-title">{title}</span>
        <div className="lt-win-ctrls">
          <button aria-label={`Minimise ${title}`} onClick={props.onMin}>
            <I.Minimise />
          </button>
          <button
            aria-label={`${win.max ? "Restore" : "Maximise"} ${title}`}
            onClick={props.onMax}
          >
            <I.Maximise />
          </button>
          <button
            className="close"
            aria-label={`Close ${title}`}
            onClick={props.onClose}
          >
            <I.Close />
          </button>
        </div>
      </header>
      <div className="lt-win-body">{props.children}</div>
    </section>
  );
}
