import { useEffect, useMemo, useRef, useState } from "react";
import { fmtTime } from "../game/state.ts";
import { COMPANIES, type Company } from "./companies";
import "./world.css";

type Invitation = {
  id: string;
  companyId: string;
  roleId: string;
  day: number;
  time: number;
  status: string;
};
type Job = { companyId: string; title: string } | null;

type Props = {
  day: number;
  minute: number;
  invitations: Invitation[];
  job: Job;
  /** Why a shift can't start if you leave now (null = you can work). */
  workWhy: string | null;
  onGo: (placeId: string) => void;
  onClose: () => void;
};

type Place = {
  id: string; // "home" | "company:<id>" | "library" | "cafe"
  name: string;
  sub: string;
  x: number; // position in the 1000×640 map
  y: number;
  about: string;
  company?: Company;
  soon?: string; // set when the place is not open yet
};

const HOME = { x: 170, y: 470 };
// Hand-placed pins for the known companies; new companies fall back to free lots.
const SPOTS: Record<string, [number, number]> = {
  sutradhar: [360, 170],
  kiranacart: [520, 420],
  rupiya: [700, 150],
  nimbus: [800, 480],
};
const SPARE: [number, number][] = [
  [600, 290],
  [300, 330],
  [880, 300],
  [420, 560],
];

const PLACES: Place[] = [
  {
    id: "home",
    name: "Home",
    sub: "Your apartment · Old Town",
    ...HOME,
    about:
      "Your one-room flat above the chai shop. Your laptop, your bed and your fridge are here.",
  },
  ...COMPANIES.map((c, i): Place => {
    const [x, y] = SPOTS[c.id] ?? SPARE[i % SPARE.length];
    return {
      id: `company:${c.id}`,
      name: c.name,
      sub: `${c.tier} · ${c.location}`,
      x,
      y,
      about: c.about,
      company: c,
    };
  }),
  {
    id: "library",
    name: "City Library",
    sub: "Old Town",
    x: 270,
    y: 580,
    about: "Quiet reading rooms and shelves of programming books.",
    soon: "The library opens in a later update.",
  },
  {
    id: "cafe",
    name: "Filter Coffee Café",
    sub: "Startup Street",
    x: 640,
    y: 560,
    about: "Where developers meet for coffee and side projects.",
    soon: "The café opens in a later update.",
  },
];

/** Bus time from home: 20 to 45 minutes depending on distance. */
const travel = (p: Place) =>
  p.id === "home"
    ? 0
    : Math.min(
        45,
        Math.max(
          20,
          Math.round(15 + Math.hypot(p.x - HOME.x, p.y - HOME.y) / 25),
        ),
      );

type Status = {
  badge?: string;
  tone?: "today" | "later" | "work";
  canGo: boolean;
  why: string;
  doNow: string;
};

function statusOf(
  p: Place,
  day: number,
  minute: number,
  invitations: Invitation[],
  job: Job,
  workWhy: string | null,
): Status {
  if (p.soon) return { canGo: false, why: p.soon, doNow: "Nothing yet." };
  if (!p.company)
    return {
      canGo: true,
      why: "",
      doNow: "Rest, eat, practise on your laptop or check your phone.",
    };
  const id = p.company.id;
  if (job?.companyId === id)
    return {
      badge: "Your workplace",
      tone: "work",
      canGo: !workWhy,
      why: workWhy ?? "",
      doNow: `Go to work as ${job.title}.`,
    };
  const live = invitations.filter(
    (i) =>
      i.companyId === id && (i.status === "pending" || i.status === "accepted"),
  );
  const today = live.find((i) => i.day === day);
  if (today) {
    const late = minute + travel(p) > today.time;
    return {
      badge: `Interview today ${fmtTime(today.time)}`,
      tone: "today",
      canGo: true,
      why: "",
      doNow: `Your interview with ${p.company.interviewer.name} starts at ${fmtTime(today.time)}.${
        late ? " The bus takes a while, so you may arrive late." : ""
      }`,
    };
  }
  const next = live
    .filter((i) => i.day > day)
    .sort((a, b) => a.day - b.day || a.time - b.time)[0];
  if (next)
    return {
      badge: `Interview on Day ${next.day}`,
      tone: "later",
      canGo: false,
      why: `Your interview is on Day ${next.day} at ${fmtTime(next.time)}. Reception only lets candidates in on their interview day.`,
      doNow: "Come back on your interview day.",
    };
  return {
    canGo: false,
    why: "You don't have an interview here. Wait for an invitation on your phone.",
    doNow: "Nothing until they invite you.",
  };
}

/** Illustrated map of Namma Nagar: pick a place, read about it, travel there. */
export function CityMap({
  day,
  minute,
  invitations,
  job,
  workWhy,
  onGo,
  onClose,
}: Props) {
  const [sel, setSel] = useState<string | null>(null);
  const root = useRef<HTMLDivElement>(null);
  const statuses = useMemo(
    () =>
      new Map(
        PLACES.map((p) => [p.id, statusOf(p, day, minute, invitations, job, workWhy)]),
      ),
    [day, minute, invitations, job, workWhy],
  );
  const place = PLACES.find((p) => p.id === sel);
  const st = place && statuses.get(place.id)!;

  useEffect(() => {
    root.current?.querySelector<HTMLButtonElement>(".pin")?.focus();
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  return (
    <div
      className="citymap"
      role="dialog"
      aria-modal="true"
      aria-labelledby="citymap-title"
      ref={root}
    >
      <header className="citymap-head">
        <div>
          <p className="eyebrow">City map</p>
          <h2 id="citymap-title">Namma Nagar</h2>
        </div>
        <p className="mono citymap-clock">
          Day {day} · {fmtTime(minute)}
        </p>
        <button
          className="icon-btn citymap-close"
          onClick={onClose}
          aria-label="Close map"
        >
          ✕
        </button>
      </header>

      <div className="citymap-body">
        <div className="citymap-board">
          <div className="citymap-art">
            <MapArt />
            {PLACES.map((p) => {
              const s = statuses.get(p.id)!;
              return (
                <button
                  key={p.id}
                  className={`pin ${p.id === "home" ? "home" : ""} ${p.soon ? "soon" : ""} ${s.tone ?? ""} ${sel === p.id ? "on" : ""}`}
                  style={{ left: `${p.x / 10}%`, top: `${(p.y / 640) * 100}%` }}
                  aria-pressed={sel === p.id}
                  aria-label={`${p.name}, ${p.sub}${s.badge ? `, ${s.badge}` : ""}${p.soon ? ", coming later" : ""}`}
                  onClick={() => setSel(p.id)}
                >
                  {s.badge && <span className="pin-badge">{s.badge}</span>}
                  <span className="pin-dot" aria-hidden="true" />
                  <span className="pin-label">
                    <b>{p.name}</b>
                    <small>
                      {p.company
                        ? p.company.tier
                        : p.soon
                          ? "Coming later"
                          : "You live here"}
                    </small>
                  </span>
                </button>
              );
            })}
          </div>
        </div>

        <aside
          className="citymap-card"
          aria-live="polite"
          aria-label="Place details"
        >
          {place && st ? (
            <>
              <p className="eyebrow">
                {place.company
                  ? `Company · ${place.company.tier}`
                  : place.soon
                    ? "Coming later"
                    : "Home"}
              </p>
              <h3>{place.name}</h3>
              <p className="citymap-sub">
                {place.company?.location ?? place.sub}
              </p>
              {st.badge && <p className={`chip ${st.tone}`}>{st.badge}</p>}
              <p>{place.about}</p>
              <dl className="facts">
                <dt>Travel</dt>
                <dd>
                  {travel(place)
                    ? `About ${travel(place)} min by bus`
                    : "You're already nearby"}
                </dd>
                <dt>Now</dt>
                <dd>{st.doNow}</dd>
              </dl>
              {!st.canGo && <p className="citymap-why">{st.why}</p>}
              <button
                className="btn primary citymap-go"
                disabled={!st.canGo}
                onClick={() => onGo(place.id)}
              >
                {place.id === "home"
                  ? "Go home"
                  : st.tone === "work"
                    ? "Go to work"
                    : `Go to ${place.name}`}
              </button>
            </>
          ) : (
            <div className="citymap-empty">
              <p className="eyebrow">Where to?</p>
              <p>
                Pick a place on the map to see what you can do there and how
                long the bus takes.
              </p>
              <ul className="citymap-legend">
                <li>
                  <span className="pin-dot today" aria-hidden="true" />{" "}
                  Interview today
                </li>
                <li>
                  <span className="pin-dot later" aria-hidden="true" />{" "}
                  Interview coming up
                </li>
                <li>
                  <span className="pin-dot work" aria-hidden="true" /> Your
                  workplace
                </li>
              </ul>
            </div>
          )}
        </aside>
      </div>
    </div>
  );
}

/** The illustration: land, lake, river, roads, districts and a bus route, all in one SVG. */
function MapArt() {
  const blocks: [number, number, number, number][] = [
    [80, 400, 150, 120],
    [250, 430, 120, 90],
    [90, 540, 120, 70],
    [300, 120, 140, 110],
    [460, 100, 110, 90],
    [640, 90, 160, 120],
    [830, 110, 110, 100],
    [450, 360, 160, 120],
    [630, 380, 90, 90],
    [560, 520, 160, 80],
    [240, 260, 120, 90],
    [560, 240, 110, 80],
  ];
  const trees: [number, number][] = [
    [120, 140],
    [150, 170],
    [100, 190],
    [190, 120],
    [905, 410],
    [940, 450],
    [700, 600],
    [740, 610],
    [380, 300],
    [410, 320],
    [200, 350],
    [960, 220],
  ];
  return (
    <svg
      className="citymap-svg"
      viewBox="0 0 1000 640"
      aria-hidden="true"
      focusable="false"
    >
      <defs>
        <linearGradient id="cm-land" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="#7a5a3a" />
          <stop offset="1" stopColor="#4d3825" />
        </linearGradient>
        <radialGradient id="cm-sun" cx="0.85" cy="0.08" r="0.7">
          <stop offset="0" stopColor="#ffcf7a" stopOpacity="0.55" />
          <stop offset="1" stopColor="#ffcf7a" stopOpacity="0" />
        </radialGradient>
        <linearGradient id="cm-water" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#5b8fa3" />
          <stop offset="1" stopColor="#35596b" />
        </linearGradient>
        <pattern
          id="cm-win"
          width="10"
          height="10"
          patternUnits="userSpaceOnUse"
        >
          <rect width="10" height="10" fill="#8a6644" />
          <rect
            x="2"
            y="2"
            width="4"
            height="3"
            fill="#f2c27a"
            opacity="0.55"
          />
        </pattern>
      </defs>
      <rect width="1000" height="640" fill="url(#cm-land)" />
      {/* Parks */}
      <path
        d="M60 110 Q140 70 230 110 L210 220 Q120 240 70 200 Z"
        fill="#5f6f3e"
      />
      <path
        d="M880 380 Q960 360 990 420 L990 520 Q930 500 880 470 Z"
        fill="#5f6f3e"
      />
      {/* River into the lake */}
      <path
        d="M0 300 C160 280 220 360 380 350 S620 300 720 400 S820 520 900 560"
        fill="none"
        stroke="url(#cm-water)"
        strokeWidth="26"
        strokeLinecap="round"
      />
      <ellipse cx="900" cy="575" rx="150" ry="80" fill="url(#cm-water)" />
      <path
        d="M800 560 Q860 540 940 556"
        stroke="#cfe6ee"
        strokeOpacity="0.35"
        strokeWidth="3"
        fill="none"
      />
      {/* City blocks with lit windows */}
      {blocks.map(([x, y, w, h], i) => (
        <rect
          key={i}
          x={x}
          y={y}
          width={w}
          height={h}
          rx="8"
          fill="url(#cm-win)"
          stroke="#3a2a1c"
          strokeWidth="2"
        />
      ))}
      {/* Roads */}
      <g
        fill="none"
        stroke="#e9c992"
        strokeLinecap="round"
        strokeLinejoin="round"
      >
        <path d="M40 380 H960" strokeWidth="14" />
        <path d="M440 20 V620" strokeWidth="14" />
        <rect x="60" y="80" width="880" height="525" rx="70" strokeWidth="9" />
        <path
          d="M230 380 V620 M620 80 V380 M620 380 Q700 470 800 480"
          strokeWidth="6"
        />
      </g>
      <g fill="none" stroke="#7a5a3a" strokeWidth="1.5" strokeDasharray="10 10">
        <path d="M40 380 H960 M440 20 V620" />
      </g>
      {/* Bus route */}
      <path
        d="M170 470 L230 470 L230 380 L360 380 L360 170 M440 380 L520 380 L520 420 M440 150 L700 150 M620 380 Q700 470 800 480"
        fill="none"
        stroke="#f2b544"
        strokeWidth="3"
        strokeDasharray="2 8"
        strokeLinecap="round"
      />
      {trees.map(([x, y], i) => (
        <circle
          key={i}
          cx={x}
          cy={y}
          r="11"
          fill="#4e6a35"
          stroke="#33461f"
          strokeWidth="2"
        />
      ))}
      {/* District names */}
      <g className="citymap-district">
        <text x="300" y="64">
          TECH PARK
        </text>
        <text x="640" y="64">
          FINANCE DISTRICT
        </text>
        <text x="455" y="345">
          STARTUP STREET
        </text>
        <text x="840" y="625">
          LAKESIDE
        </text>
        <text x="90" y="405">
          OLD TOWN
        </text>
      </g>
      <rect width="1000" height="640" fill="url(#cm-sun)" />
    </svg>
  );
}
