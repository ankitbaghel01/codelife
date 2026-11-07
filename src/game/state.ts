import { CONFIG } from "./config.ts";

// Deterministic game rules. UI and AI never change state except through these functions.

export type Skill = {
  name: string;
  proficiency: number;
  source: "start" | "claimed";
};
export type Txn = {
  id: number;
  day: number;
  minute: number;
  label: string;
  amount: number;
};
export type Message = {
  id: string;
  from: string;
  text: string;
  day: number;
  read: boolean;
};

export type GameState = {
  version: 1;
  name: string;
  day: number;
  minute: number; // 0–1439
  energy: number; // 0–100
  hunger: number; // 0–100
  skills: Skill[];
  ledger: Txn[];
  messages: Message[];
};

export type Result = { state: GameState; error?: string };

const clamp = (n: number) =>
  Math.max(0, Math.min(100, Math.round(n * 10) / 10));

export function validName(raw: string): string | undefined {
  const s = raw.trim();
  if (!s) return "Enter a name.";
  if (s.length > 24) return "Keep the name under 24 characters.";
  if (!/^[\p{L} .'-]+$/u.test(s))
    return "Use letters, spaces, dots, apostrophes or hyphens.";
}

export function newGame(rawName: string): GameState {
  const s = CONFIG.start;
  return {
    version: 1,
    name: rawName.trim(),
    day: s.day,
    minute: s.minute,
    energy: s.energy,
    hunger: s.hunger,
    skills: CONFIG.skills.map((k) => ({ ...k, source: "start" as const })),
    ledger: [
      {
        id: 1,
        day: s.day,
        minute: s.minute,
        label: "Savings",
        amount: s.balance,
      },
    ],
    messages: CONFIG.messages.map((m) => ({ ...m, day: s.day, read: false })),
  };
}

export const balance = (s: GameState) =>
  s.ledger.reduce((sum, t) => sum + t.amount, 0);

function addTxn(s: GameState, label: string, amount: number): GameState {
  const id = s.ledger.length ? s.ledger[s.ledger.length - 1].id + 1 : 1;
  return {
    ...s,
    ledger: [...s.ledger, { id, day: s.day, minute: s.minute, label, amount }],
  };
}

/** Advance the clock; hunger and energy drift at fixed hourly rates. */
export function tick(s: GameState, minutes: number): GameState {
  const total = s.minute + minutes;
  const h = minutes / 60;
  return {
    ...s,
    day: s.day + Math.floor(total / 1440),
    minute: total % 1440,
    hunger: clamp(s.hunger + h * CONFIG.rates.hungerPerHour),
    energy: clamp(s.energy - h * CONFIG.rates.energyPerHour),
  };
}

/** Sleep until the next morning. */
export function sleep(s: GameState): GameState {
  return {
    ...s,
    day: s.day + 1,
    minute: CONFIG.rates.wakeMinute,
    energy: 100,
    hunger: clamp(s.hunger + CONFIG.rates.sleepHunger),
  };
}

export function eat(s: GameState): Result {
  const cost = CONFIG.costs.meal;
  if (balance(s) < cost)
    return {
      state: s,
      error: `A meal costs ₹${cost}. You don't have enough money.`,
    };
  const paid = addTxn(s, "Meal", -cost);
  const later = tick(paid, CONFIG.rates.mealMinutes);
  return {
    state: { ...later, hunger: clamp(later.hunger - CONFIG.rates.mealHunger) },
  };
}

function cleanSkill(raw: string) {
  return raw.trim().replace(/\s+/g, " ");
}

function skillError(s: GameState, name: string, skip = -1): string | undefined {
  if (!name) return "Type a skill first.";
  if (name.length > 30) return "Keep it under 30 characters.";
  if (
    s.skills.some(
      (k, i) => i !== skip && k.name.toLowerCase() === name.toLowerCase(),
    )
  )
    return "You already have that skill.";
}

/** Integrity rule (PRD 5.1): a claimed skill starts at 0 proficiency. Only practice raises it. */
export function addSkill(s: GameState, raw: string): Result {
  const name = cleanSkill(raw);
  const error = skillError(s, name);
  return error
    ? { state: s, error }
    : {
        state: {
          ...s,
          skills: [...s.skills, { name, proficiency: 0, source: "claimed" }],
        },
      };
}

export function renameSkill(s: GameState, index: number, raw: string): Result {
  const k = s.skills[index];
  if (!k || k.source !== "claimed")
    return { state: s, error: "Only skills you added can be renamed." };
  const name = cleanSkill(raw);
  const error = skillError(s, name, index);
  return error
    ? { state: s, error }
    : {
        state: {
          ...s,
          skills: s.skills.map((x, i) => (i === index ? { ...x, name } : x)),
        },
      };
}

export function removeSkill(s: GameState, index: number): Result {
  const k = s.skills[index];
  if (!k || k.source !== "claimed")
    return { state: s, error: "Only skills you added can be removed." };
  return { state: { ...s, skills: s.skills.filter((_, i) => i !== index) } };
}

export function markRead(s: GameState, id: string): GameState {
  return {
    ...s,
    messages: s.messages.map((m) => (m.id === id ? { ...m, read: true } : m)),
  };
}

/** Saves come from localStorage, so check the shape before trusting them. */
export function parseSave(raw: string | null): GameState | null {
  if (!raw) return null;
  try {
    const v = JSON.parse(raw);
    const num = (x: unknown) => typeof x === "number" && Number.isFinite(x);
    const ok =
      v?.version === 1 &&
      typeof v.name === "string" &&
      [v.day, v.minute, v.energy, v.hunger].every(num) &&
      Array.isArray(v.skills) &&
      v.skills.every(
        (k: Skill) =>
          typeof k?.name === "string" &&
          num(k.proficiency) &&
          (k.source === "start" || k.source === "claimed"),
      ) &&
      Array.isArray(v.ledger) &&
      v.ledger.every(
        (t: Txn) => num(t?.id) && num(t.amount) && typeof t.label === "string",
      ) &&
      Array.isArray(v.messages);
    return ok ? (v as GameState) : null;
  } catch {
    return null;
  }
}

export const fmtTime = (minute: number) =>
  `${String(Math.floor(minute / 60)).padStart(2, "0")}:${String(minute % 60).padStart(2, "0")}`;

export const fmtMoney = (n: number) =>
  `${n < 0 ? "−" : ""}₹${Math.abs(n).toLocaleString("en-IN")}`;
