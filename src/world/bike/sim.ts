// Simple custom bike physics and stunt scoring. No physics engine: the bike rides the track
// height function on the ground, flies a ballistic arc in the air, and the pitch you hold
// at touchdown decides between a perfect landing, a clean one or a wipeout.
import {
  CHECKPOINTS,
  GRAVITY,
  HALF_ROAD,
  LENGTH,
  groundSlope,
  groundY,
  pickups,
  type Pickup,
} from "./track";

export type Input = { throttle: boolean; brake: boolean; steer: number };
export type StuntEvent = {
  text: string;
  pts: number;
  kind: "trick" | "land" | "coin" | "crash" | "info";
};

const TOP = 26; // m/s ≈ 94 km/h
const TOP_BOOST = 34;
const OFF_TOP = 11;
const FLIP = Math.PI * 2;
const PERFECT = 0.2; // rad between bike and ground at touchdown
const SAFE = 0.62;
const COMBO_TIME = 6;

export function newSim() {
  return {
    s: CHECKPOINTS[0],
    l: 0,
    y: groundY(0, 0),
    speed: 0,
    vy: 0,
    pitch: 0,
    pitchVel: 0,
    roll: 0, // crash tumble
    lean: 0,
    air: false,
    airT: 0,
    rot: 0,
    lockGas: false,
    lockBack: false,
    boostT: 0,
    crashT: 0,
    comp: 0, // suspension compression 0..1
    compVel: 0,
    shake: 0,
    wheelSpin: 0,
    cp: 0,
    score: 0,
    combo: 0,
    comboT: 0,
    bestCombo: 0,
    flips: 0,
    perfects: 0,
    coins: 0,
    crashes: 0,
    time: 0,
    finished: false,
    pickups: pickups().map((p) => ({ ...p, taken: false })) as (Pickup & {
      taken: boolean;
    })[],
    events: [] as StuntEvent[],
    bursts: [] as {
      kind: "dust" | "spark" | "coin";
      s: number;
      l: number;
      y: number;
      n: number;
    }[],
  };
}
export type Sim = ReturnType<typeof newSim>;

export const multiplier = (sim: Sim) => Math.min(5, 1 + sim.combo);

function award(
  sim: Sim,
  text: string,
  base: number,
  kind: StuntEvent["kind"] = "trick",
) {
  const pts = Math.round(base * multiplier(sim));
  sim.score += pts;
  sim.events.push({ text, pts, kind });
}

function bumpCombo(sim: Sim) {
  sim.combo += 1;
  sim.comboT = 0;
  sim.bestCombo = Math.max(sim.bestCombo, multiplier(sim));
}

const wrap = (a: number) => Math.atan2(Math.sin(a), Math.cos(a));

function respawn(sim: Sim) {
  const s = CHECKPOINTS[sim.cp];
  Object.assign(sim, {
    s,
    l: 0,
    y: groundY(s, 0),
    speed: 9,
    vy: 0,
    pitch: Math.atan(groundSlope(s, 0)),
    pitchVel: 0,
    roll: 0,
    air: false,
    rot: 0,
    crashT: 0,
  });
  sim.events.push({
    text: sim.cp ? `Back on at checkpoint ${sim.cp}` : "Back on at the start",
    pts: 0,
    kind: "info",
  });
}

function land(sim: Sim) {
  const slope = groundSlope(sim.s, sim.l);
  const groundA = Math.atan(slope);
  const diff = Math.abs(wrap(sim.pitch - groundA));
  const impact = Math.min(1, Math.max(0, -sim.vy) / 12);
  const airT = sim.airT;
  const turns = Math.floor((Math.abs(sim.rot) + 0.9) / FLIP);
  sim.air = false;
  sim.y = groundY(sim.s, sim.l);
  sim.vy = sim.speed * slope;
  sim.pitchVel = 0;

  if (diff > SAFE && !sim.finished) {
    sim.crashT = 1.6;
    sim.crashes += 1;
    sim.combo = 0;
    sim.comboT = 0;
    sim.shake = 1;
    sim.roll = 0;
    sim.events.push({ text: "Wipeout!", pts: 0, kind: "crash" });
    sim.bursts.push({ kind: "spark", s: sim.s, l: sim.l, y: sim.y, n: 26 });
    return;
  }
  sim.pitch = groundA;
  sim.compVel = 3 + impact * 6;
  sim.shake = Math.max(sim.shake, impact * 0.7);
  sim.bursts.push({
    kind: "dust",
    s: sim.s,
    l: sim.l,
    y: sim.y,
    n: Math.round(6 + impact * 14),
  });
  if (sim.finished) return;

  if (turns > 0) {
    const back = sim.rot > 0;
    const name = back ? "Backflip" : "Frontflip";
    const label =
      turns === 1
        ? name
        : turns === 2
          ? `Double ${name.toLowerCase()}`
          : `${turns}x ${name.toLowerCase()}`;
    bumpCombo(sim);
    award(sim, `${label}!`, 500 * turns * (turns > 1 ? 1.5 : 1));
    sim.flips += turns;
  }
  if (airT > 0.9) award(sim, airT > 1.6 ? "Huge air" : "Big air", Math.round(airT * 100));
  if (airT > 0.35) {
    if (diff < PERFECT) {
      sim.perfects += 1;
      bumpCombo(sim);
      award(sim, `Perfect landing x${multiplier(sim)}`, 250, "land");
      sim.boostT = Math.max(sim.boostT, 1.4);
      sim.speed = Math.min(TOP_BOOST, sim.speed + 4);
    } else {
      sim.speed *= 0.82;
      sim.events.push({ text: "Sketchy landing", pts: 0, kind: "info" });
    }
  }
}

/** Advance the ride by dt seconds. Pitch input: +1 = lean back (backflip), -1 = lean forward. */
export function step(sim: Sim, input: Input, dt: number) {
  sim.shake = Math.max(0, sim.shake - dt * 2.2);
  // Suspension: a damped spring pushed by landings.
  sim.compVel += (-sim.comp * 120 - sim.compVel * 9) * dt;
  sim.comp = Math.min(1, Math.max(-0.3, sim.comp + sim.compVel * dt));
  if (sim.boostT > 0) sim.boostT -= dt;

  if (sim.crashT > 0) {
    sim.crashT -= dt;
    sim.speed = Math.max(0, sim.speed - 22 * dt);
    sim.s += sim.speed * dt;
    sim.pitchVel = 5;
    sim.pitch += sim.speed * 0.25 * dt;
    sim.roll += sim.speed * 0.12 * dt;
    if (sim.air) {
      sim.vy -= GRAVITY * dt;
      sim.y = Math.max(groundY(sim.s, sim.l), sim.y + sim.vy * dt);
    } else sim.y = groundY(sim.s, sim.l);
    if (sim.crashT <= 0) respawn(sim);
    return;
  }

  const drive = sim.finished
    ? { throttle: false, brake: true, steer: 0 }
    : input;
  const steer = drive.steer;
  const onRoad = Math.abs(sim.l) <= HALF_ROAD;
  sim.lean +=
    (-steer * 0.4 * Math.min(1, sim.speed / 10) - sim.lean) *
    Math.min(1, dt * 6);

  if (!sim.air) {
    const slope = groundSlope(sim.s, sim.l);
    const top = sim.boostT > 0 ? TOP_BOOST : onRoad ? TOP : OFF_TOP;
    let acc = drive.throttle
      ? sim.boostT > 0
        ? 16
        : 10
      : drive.brake
        ? -20
        : -2.5;
    acc -= GRAVITY * 0.35 * Math.sin(Math.atan(slope));
    sim.speed += acc * dt;
    if (sim.speed > top) sim.speed = Math.max(top, sim.speed - 14 * dt);
    sim.speed = Math.max(0, sim.speed);
    sim.s += sim.speed * dt;
    sim.l += steer * Math.min(sim.speed, 12) * 0.55 * dt;
    if (!onRoad && sim.speed > 4)
      sim.bursts.push({
        kind: "dust",
        s: sim.s,
        l: sim.l,
        y: sim.y,
        n: Math.random() < dt * 20 ? 1 : 0,
      });

    const vy = sim.speed * slope;
    const ground = groundY(sim.s, sim.l);
    const ballistic = sim.y + vy * dt;
    if (ballistic > ground + 0.12 && sim.speed > 3) {
      // Ground fell away under the wheels (ramp lip): take off.
      sim.air = true;
      sim.vy = vy;
      sim.y = ballistic;
      sim.airT = 0;
      sim.rot = 0;
      sim.pitchVel = 0;
      // Keys already held at take-off (gas up the ramp) don't flip you until pressed again.
      sim.lockGas = drive.throttle;
      sim.lockBack = drive.brake;
    } else {
      sim.y = ground;
      sim.vy = vy;
      const target = Math.atan(groundSlope(sim.s, sim.l));
      sim.pitch += (target - sim.pitch) * Math.min(1, dt * 18);
      sim.comboT += dt;
      if (sim.combo > 0 && sim.comboT > COMBO_TIME) {
        sim.combo = 0;
        sim.events.push({ text: "Combo ended", pts: 0, kind: "info" });
      }
    }
  } else {
    sim.airT += dt;
    sim.vy -= GRAVITY * dt;
    sim.y += sim.vy * dt;
    sim.s += sim.speed * dt;
    sim.l += steer * 3 * dt;
    // In the air: brake/back key leans back (backflip), throttle/forward key leans forward.
    if (!drive.throttle) sim.lockGas = false;
    if (!drive.brake) sim.lockBack = false;
    const lean = sim.finished
      ? 0
      : (drive.brake && !sim.lockBack ? 1 : 0) -
        (drive.throttle && !sim.lockGas ? 1 : 0);
    sim.pitchVel += lean * 15 * dt;
    if (!lean) {
      sim.pitchVel *= 1 - Math.min(1, dt * 5);
    }
    sim.pitchVel = Math.max(-7.5, Math.min(7.5, sim.pitchVel));
    sim.pitch += sim.pitchVel * dt;
    sim.rot += sim.pitchVel * dt;
    if (sim.y <= groundY(sim.s, sim.l)) land(sim);
  }
  sim.l = Math.max(-HALF_ROAD - 8, Math.min(HALF_ROAD + 8, sim.l));
  sim.wheelSpin += (sim.speed * dt) / 0.33;
  if (!sim.finished) sim.time += dt;

  while (sim.cp + 1 < CHECKPOINTS.length && sim.s >= CHECKPOINTS[sim.cp + 1]) {
    sim.cp += 1;
    sim.events.push({ text: `Checkpoint ${sim.cp}`, pts: 0, kind: "info" });
  }
  for (const p of sim.pickups) {
    if (p.taken || Math.abs(p.s - sim.s) > 1.6) continue;
    const r = p.kind === "boost" ? 2.2 : 1.3;
    if (Math.abs(p.l - sim.l) > r || Math.abs(p.y - (sim.y + 0.7)) > 1.6)
      continue;
    p.taken = true;
    if (p.kind === "coin") {
      sim.coins += 1;
      sim.score += 25;
      sim.bursts.push({ kind: "coin", s: p.s, l: p.l, y: p.y, n: 5 });
    } else {
      sim.boostT = 2.5;
      sim.speed = Math.max(sim.speed, TOP);
      sim.events.push({ text: "Boost!", pts: 0, kind: "info" });
    }
  }
  if (!sim.finished && sim.s >= LENGTH) sim.finished = true;
}

/** Stars for the results card: 1 for finishing, more for a strong score. */
export const stars = (score: number) =>
  score >= 10000 ? 3 : score >= 5000 ? 2 : 1;
