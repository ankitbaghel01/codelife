import { CONFIG } from "./config.ts";
import COMPANIES from "../../content/companies.json" with { type: "json" };

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
export type Project = { name: string; description: string };
export type Resume = { summary: string; projects: Project[] };
export type Invitation = {
  id: string;
  companyId: string;
  roleId: string;
  day: number; // interview day
  time: number; // interview start, game minutes
  status: "pending" | "accepted" | "declined" | "expired" | "attended";
  createdDay: number;
};
export type Job = {
  companyId: string;
  roleId: string;
  title: string;
  monthlySalary: number;
  startDay: number;
  daysWorked: number; // since the last payday
  lastWorkedDay: number;
  level: number; // 1 at joining; promotions raise it
  totalDaysWorked: number;
  tasksDone: { id: string; day: number }[]; // work tasks solved at this company
  tripsTaken: number;
  carryOver: string[]; // tasks left unfinished: due on the next workday, at late pay
  absentDays: number[]; // workdays missed since the last payday
};
export type Evidence = {
  day: number;
  skill: string;
  delta: number;
  reason: string;
};

export type GameState = {
  version: 1;
  playerId: string;
  name: string;
  day: number;
  minute: number; // 0–1439
  energy: number; // 0–100
  hunger: number; // 0–100
  skills: Skill[];
  ledger: Txn[];
  messages: Message[];
  resume: Resume;
  invitations: Invitation[];
  job: Job | null;
  solved: string[]; // practice problem ids solved at least once
  evidence: Evidence[];
  lastPlayed?: string; // real calendar date (YYYY-MM-DD) of the last session
};

export type Result = { state: GameState; error?: string };

export type Company = (typeof COMPANIES.companies)[number];
export type Role = Company["roles"][number];
export const companies: Company[] = COMPANIES.companies;
export const findCompany = (id: string) => companies.find((c) => c.id === id);
export const findRole = (companyId: string, roleId: string) =>
  findCompany(companyId)?.roles.find((r) => r.id === roleId);

const clamp = (n: number) =>
  Math.max(0, Math.min(100, Math.round(n * 10) / 10));
const newId = () =>
  globalThis.crypto?.randomUUID?.() ??
  `p-${Date.now().toString(36)}-${Math.random().toString(36).slice(2)}`;

export function validName(raw: string): string | undefined {
  const s = raw.trim();
  if (!s) return "Enter a name.";
  if (s.length > 24) return "Keep the name under 24 characters.";
  if (!/^[\p{L} .'-]+$/u.test(s))
    return "Use letters, spaces, dots, apostrophes or hyphens.";
}

export function newGame(rawName: string, playerId = newId()): GameState {
  const s = CONFIG.start;
  const g: GameState = {
    version: 1,
    playerId,
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
    resume: { summary: "", projects: [] },
    invitations: [],
    job: null,
    solved: [],
    evidence: [],
  };
  return refreshInvitations(g);
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

function addMessage(
  s: GameState,
  id: string,
  from: string,
  text: string,
): GameState {
  if (s.messages.some((m) => m.id === id)) return s;
  return {
    ...s,
    messages: [...s.messages, { id, from, text, day: s.day, read: false }],
  };
}

/** Advance the clock; hunger and energy drift at fixed hourly rates. Crossing midnight runs the new-day rules. */
export function tick(s: GameState, minutes: number): GameState {
  const total = s.minute + minutes;
  const h = minutes / 60;
  let g: GameState = {
    ...s,
    day: s.day + Math.floor(total / 1440),
    minute: total % 1440,
    hunger: clamp(s.hunger + h * CONFIG.rates.hungerPerHour),
    energy: clamp(s.energy - h * CONFIG.rates.energyPerHour),
  };
  for (let d = s.day + 1; d <= g.day; d++) g = onNewDay({ ...g, day: d });
  return g;
}

/** Sleep until the next morning. */
export function sleep(s: GameState): GameState {
  return onNewDay({
    ...s,
    day: s.day + 1,
    minute: CONFIG.rates.wakeMinute,
    energy: 100,
    hunger: clamp(s.hunger + CONFIG.rates.sleepHunger),
  });
}

const WEEKDAYS = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
/** Day 1 is a Monday; the office is closed on Saturdays and Sundays. */
export const weekday = (day: number) => WEEKDAYS[day % 7];
export const isWorkday = (day: number) => day % 7 !== 6 && day % 7 !== 0;
/** The next day you can start a shift: today if it's a workday and not past 17:00, else the next weekday. */
export function nextWorkday(day: number, minute: number): number {
  let d = isWorkday(day) && minute <= CONFIG.work.endMinute - 60 ? day : day + 1;
  while (!isWorkday(d)) d++;
  return d;
}

/** A workday that ended without a shift counts as absent (unpaid, since pay is pro-rated by days worked). */
function markAbsence(s: GameState, day: number): GameState {
  const j = s.job;
  if (!j || day < j.startDay || !isWorkday(day) || j.lastWorkedDay === day || j.absentDays.includes(day)) return s;
  const absentDays = [...j.absentDays, day];
  const company = findCompany(j.companyId)?.name ?? "HR";
  let g: GameState = { ...s, job: { ...j, absentDays } };
  g = addMessage(g, `absent-${day}`, `${company} · HR`, `You were marked absent on Day ${day} (${weekday(day)}). That day is unpaid.`);
  if (absentDays.length === CONFIG.work.absenceWarnAt)
    g = addMessage(
      g,
      `absent-warn-${day}`,
      `${company} · HR`,
      `Warning: ${absentDays.length} absences this month. Please come to work on every weekday (09:00–17:00).`,
    );
  return g;
}

/** Real days away from the game pass in the game too (capped): rent, payday and absences all apply. */
export function catchUp(s: GameState, today: string): GameState {
  const days = s.lastPlayed
    ? Math.min(CONFIG.away.maxDays, Math.round((Date.parse(today) - Date.parse(s.lastPlayed)) / 86400000))
    : 0;
  let g: GameState = { ...s, lastPlayed: today };
  if (!(days > 0)) return g;
  for (let i = 0; i < days; i++) g = sleep(g);
  return addMessage(
    g,
    `away-${today}`,
    "CodeLife",
    `You were away for ${days} day${days === 1 ? "" : "s"}. Life went on: it's now Day ${g.day}.`,
  );
}

/** Rent, payday and new job invitations, once per game day. */
export function onNewDay(s: GameState): GameState {
  let g = s;
  if (g.day % CONFIG.rentEvery === 0) {
    g = addTxn(g, "Rent", -CONFIG.costs.rent);
    g = addMessage(
      g,
      `rent-${g.day}`,
      "Mr. Gowda (landlord)",
      `Rent of ₹${CONFIG.costs.rent.toLocaleString("en-IN")} received. Thank you.`,
    );
  }
  g = markAbsence(g, g.day - 1);
  const j = g.job;
  if (j && g.day > j.startDay && (g.day - j.startDay) % 30 === 0) {
    // Salary is pro-rated by days actually worked, so skipping work has a cost.
    const pay = Math.round(
      (j.monthlySalary * Math.min(j.daysWorked, CONFIG.work.fullMonthDays)) /
        CONFIG.work.fullMonthDays,
    );
    g = { ...g, job: { ...j, daysWorked: 0, absentDays: [] } };
    if (pay > 0)
      g = addTxn(
        g,
        `Salary · ${findCompany(j.companyId)?.name ?? j.companyId}`,
        pay,
      );
    g = addMessage(
      g,
      `pay-${g.day}`,
      findCompany(j.companyId)?.name ?? "Payroll",
      `Payday: ₹${pay.toLocaleString("en-IN")} credited for ${j.daysWorked} day(s) worked${
        j.absentDays.length ? ` (${j.absentDays.length} absent, unpaid)` : ""
      }.`,
    );
  }
  return refreshInvitations(g);
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

// ---------- Practice (PRD 8, Flow B) ----------

function raise(
  s: GameState,
  skill: string,
  delta: number,
  reason: string,
): GameState {
  const i = s.skills.findIndex(
    (k) => k.name.toLowerCase() === skill.toLowerCase(),
  );
  if (i < 0 || delta <= 0) return s;
  const before = s.skills[i].proficiency;
  const after = clamp(before + delta);
  if (after === before) return s;
  return {
    ...s,
    skills: s.skills.map((k, j) =>
      j === i ? { ...k, proficiency: after } : k,
    ),
    evidence: [
      ...s.evidence,
      { day: s.day, skill: s.skills[i].name, delta: after - before, reason },
    ].slice(-200),
  };
}

/** First accepted solution of a practice problem raises DSA, problem solving and (if listed) Python. */
export function practiceSolved(
  s: GameState,
  p: { id: string; title: string; difficulty: string },
): GameState {
  if (s.solved.includes(p.id)) return s;
  const gain = CONFIG.practiceGain[p.difficulty] ?? CONFIG.practiceGain.easy;
  const why = `Solved “${p.title}” (${p.difficulty})`;
  let g: GameState = { ...s, solved: [...s.solved, p.id] };
  g = raise(g, "DSA", gain, why);
  g = raise(g, "Problem solving", gain / 2, why);
  g = raise(g, "Python", 1, why);
  return refreshInvitations(g);
}

// ---------- Resume (PRD 9) ----------

export function setResume(s: GameState, r: Resume): Result {
  const summary = r.summary.trim();
  if (summary.length > 400)
    return { state: s, error: "Keep the summary under 400 characters." };
  if (r.projects.length > 5)
    return { state: s, error: "List at most 5 projects." };
  const projects = r.projects.map((p) => ({
    name: p.name.trim(),
    description: p.description.trim(),
  }));
  if (projects.some((p) => !p.name || p.name.length > 60))
    return {
      state: s,
      error: "Each project needs a name under 60 characters.",
    };
  if (projects.some((p) => p.description.length > 300))
    return {
      state: s,
      error: "Keep each project description under 300 characters.",
    };
  return { state: { ...s, resume: { summary, projects } } };
}

// ---------- Job invitations (PRD 9.1: explicit rules, no AI) ----------

export function qualifies(s: GameState, role: Role): boolean {
  const level = (name: string) =>
    s.skills.find((k) => k.name.toLowerCase() === name.toLowerCase());
  return (
    role.requiredSkills.every((name) => level(name)) &&
    Object.entries(role.minProficiency).every(
      ([name, min]) => (level(name)?.proficiency ?? 0) >= (min as number),
    )
  );
}

/** Expire missed interviews, then invite the player to the best company they now qualify for (one per day). */
export function refreshInvitations(s: GameState): GameState {
  let g: GameState = {
    ...s,
    invitations: s.invitations.map((v) =>
      (v.status === "pending" || v.status === "accepted") && v.day < s.day
        ? { ...v, status: "expired" }
        : v,
    ),
  };
  if (g.invitations.some((v) => v.createdDay === g.day)) return g;
  const cool = CONFIG.interview.cooldownDays;
  const open = (cid: string) =>
    g.invitations.some(
      (v) =>
        v.companyId === cid &&
        (v.status === "pending" || v.status === "accepted"),
    ) ||
    g.invitations.some(
      (v) =>
        v.companyId === cid &&
        v.status !== "expired" &&
        g.day - v.createdDay < cool,
    ) ||
    g.job?.companyId === cid;
  const pick = [...companies]
    .reverse() // companies.json lists tiers low → high; invite to the highest the player qualifies for
    .find((c) => !open(c.id) && qualifies(g, c.roles[0]));
  if (!pick) return g;
  const role = pick.roles[0];
  const inv: Invitation = {
    id: `${pick.id}-${g.day}`,
    companyId: pick.id,
    roleId: role.id,
    day: g.day + 1,
    time: CONFIG.interview.minute,
    status: "pending",
    createdDay: g.day,
  };
  g = { ...g, invitations: [...g.invitations, inv] };
  return addMessage(
    g,
    `invite-${inv.id}`,
    `${pick.name} · HR`,
    `Hi ${g.name}, we liked your profile. Interview for ${role.title} (₹${role.packageLpa} LPA) on Day ${inv.day} at 11:00, ${pick.location}. Open the Jobs tab to accept.`,
  );
}

export function respondInvitation(
  s: GameState,
  id: string,
  accept: boolean,
): Result {
  const v = s.invitations.find((x) => x.id === id);
  if (!v || v.status !== "pending")
    return { state: s, error: "This invitation can't be changed any more." };
  return {
    state: {
      ...s,
      invitations: s.invitations.map((x) =>
        x.id === id ? { ...x, status: accept ? "accepted" : "declined" } : x,
      ),
    },
  };
}

/** You may enter the company on the interview day, from 9:00 until the end of the working day. */
export function canAttend(s: GameState, v: Invitation): string | undefined {
  if (v.status !== "accepted")
    return v.status === "pending"
      ? "Accept the invitation first (Phone → Jobs)."
      : "This interview is closed.";
  if (s.day < v.day) return `Your interview is on Day ${v.day}.`;
  if (s.day > v.day) return "You missed this interview.";
  if (s.minute < CONFIG.work.startMinute || s.minute > CONFIG.work.endMinute)
    return "The office is open 09:00–18:00.";
}

type Offer = {
  companyId: string;
  roleId: string;
  title: string;
  monthlySalary: number;
  joinInDays: number;
};

/** Record the interview outcome. Employment changes only when the player accepts an offer (PRD 13). */
export function interviewOutcome(
  s: GameState,
  invitationId: string,
  offer: Offer | null,
  accepted: boolean,
): GameState {
  let g: GameState = {
    ...s,
    invitations: s.invitations.map((x) =>
      x.id === invitationId ? { ...x, status: "attended" } : x,
    ),
  };
  const company = findCompany(
    offer?.companyId ??
      s.invitations.find((x) => x.id === invitationId)?.companyId ??
      "",
  );
  if (offer && accepted) {
    g = {
      ...g,
      job: {
        companyId: offer.companyId,
        roleId: offer.roleId,
        title: offer.title,
        monthlySalary: offer.monthlySalary,
        startDay: g.day + offer.joinInDays,
        daysWorked: 0,
        lastWorkedDay: 0,
        level: 1,
        totalDaysWorked: 0,
        tasksDone: [],
        tripsTaken: 0,
        carryOver: [],
        absentDays: [],
      },
    };
    g = addMessage(
      g,
      `joined-${invitationId}`,
      `${company?.name ?? "HR"} · HR`,
      `Welcome aboard! You start as ${offer.title} on Day ${g.day + offer.joinInDays}. Work hours are 09:00–18:00.`,
    );
  } else if (!offer) {
    g = addMessage(
      g,
      `rejected-${invitationId}`,
      `${company?.name ?? "HR"} · HR`,
      "Thank you for interviewing with us. We won't move forward this time. Your report shows what to practise next.",
    );
  }
  return g;
}

/** Why you can't start a shift on arrival at state [s], or null when you can. Shared by the city map and [goToWork]. */
export function whyCantWork(s: GameState): string | null {
  const j = s.job;
  if (!j) return "You don't have a job yet.";
  if (s.day < j.startDay) return `You start on Day ${j.startDay}.`;
  if (!isWorkday(s.day)) return `It's ${weekday(s.day)}. The office is closed at the weekend.`;
  if (j.lastWorkedDay === s.day) return "You've already worked today. Come back tomorrow.";
  if (s.minute > CONFIG.work.endMinute - 60)
    return "Your office is closed for today. A shift has to start by 17:00 (the bus takes 30 min).";
  if (s.energy < CONFIG.work.energyCost) return "You're too tired to work. Sleep first.";
  return null;
}

/** Clock in at your office: the day counts as worked. Arriving before 09:00, you wait for the shift to start.
 * Time, energy and experience for the shift are applied by [finishShift] when you leave. */
export function goToWork(s0: GameState): Result {
  const why = whyCantWork(s0);
  if (why) return { state: s0, error: why };
  const s = s0.minute < CONFIG.work.startMinute ? tick(s0, CONFIG.work.startMinute - s0.minute) : s0;
  const j = s.job!;
  return {
    state: { ...s, job: { ...j, daysWorked: j.daysWorked + 1, totalDaysWorked: j.totalDaysWorked + 1, lastWorkedDay: s.day } },
  };
}

/** Leave the office: the shift runs its full length from [clockIn], then costs energy and builds experience. */
export function finishShift(s: GameState, clockIn: number, unfinished: string[] = []): GameState {
  const left = clockIn + CONFIG.work.shiftMinutes - s.minute;
  let g: GameState = s.job ? { ...s, job: { ...s.job, carryOver: unfinished } } : s;
  g = left > 0 ? tick(g, left) : g;
  g = { ...g, energy: clamp(g.energy - CONFIG.work.energyCost) };
  g = raise(g, "Problem solving", 0.5, "A day of real work");
  g = raise(g, "Communication", 0.5, "A day of real work");
  return promote(g);
}

// Same order all day, a new order every day (FNV-1a hash of day + id).
const dayRank = (day: number, id: string) => {
  let h = 2166136261 ^ day;
  for (const c of id) h = Math.imul(h ^ c.charCodeAt(0), 16777619);
  return h >>> 0;
};

/** Today's work tasks (problem ids): late ones carried over, the ones already solved today, then new problems up to tasksPerDay. */
export function workTasks(s: GameState, problemIds: string[]): string[] {
  const j = s.job;
  if (!j) return [];
  const today = j.tasksDone.filter((t) => t.day === s.day).map((t) => t.id);
  const done = new Set(j.tasksDone.map((t) => t.id));
  const late = j.carryOver.filter((id) => !done.has(id) && problemIds.includes(id));
  const fresh = problemIds
    .filter((id) => !done.has(id) && !late.includes(id))
    .sort((a, b) => dayRank(s.day, a) - dayRank(s.day, b))
    .slice(0, Math.max(0, CONFIG.work.tasksPerDay - today.length - late.length));
  return [...late, ...today, ...fresh];
}

/** What a task pays: full on the day it's assigned, latePayRate once it has been carried over. */
export const taskPay = (difficulty: string, late = false) =>
  Math.round((CONFIG.work.taskPay[difficulty] ?? CONFIG.work.taskPay.easy) * (late ? CONFIG.work.latePayRate : 1));

/** Trips earned (one per tripEveryTasks tasks) and not taken yet. */
export const tripsWaiting = (s: GameState) =>
  s.job ? Math.floor(s.job.tasksDone.length / CONFIG.work.tripEveryTasks) - s.job.tripsTaken : 0;

/** A work task solved: paid on the spot, and every tripEveryTasks tasks the company sends you on a bike trip. */
export function workTaskSolved(
  s: GameState,
  p: { id: string; title: string; difficulty: string },
): GameState {
  const j = s.job;
  if (!j || j.tasksDone.some((t) => t.id === p.id)) return s;
  const late = j.carryOver.includes(p.id);
  const pay = taskPay(p.difficulty, late);
  let g: GameState = {
    ...s,
    job: { ...j, tasksDone: [...j.tasksDone, { id: p.id, day: s.day }], carryOver: j.carryOver.filter((id) => id !== p.id) },
  };
  g = addTxn(g, `${late ? "Late work task" : "Work task"}: ${p.title}`, pay);
  g = raise(g, "DSA", (CONFIG.practiceGain[p.difficulty] ?? 2) / 2, `Work task “${p.title}”`);
  const n = g.job!.tasksDone.length;
  if (n % CONFIG.work.tripEveryTasks === 0) {
    g = addMessage(
      g,
      `trip-${j.companyId}-${n}`,
      findCompany(j.companyId)?.name ?? "Your manager",
      `You've solved ${n} work tasks. As a thank-you, the company is sending you on a bike trip to Mistgiri Hills! Start it from your desk at work.`,
    );
  }
  return g;
}

/** The bike trip: a few hours out of the city that leave you rested and closer to your team. */
export function takeTrip(s: GameState): Result {
  if (tripsWaiting(s) <= 0) return { state: s, error: "You don't have a trip waiting." };
  let g = tick({ ...s, job: { ...s.job!, tripsTaken: s.job!.tripsTaken + 1 } }, 4 * 60);
  g = { ...g, energy: 100 };
  return { state: raise(g, "Communication", 2, "Company bike trip with the team") };
}

/** Every N days worked, a good enough problem solver is promoted: higher level, title and salary. */
export function promote(s: GameState): GameState {
  const j = s.job;
  const w = CONFIG.work;
  if (!j || j.totalDaysWorked === 0 || j.totalDaysWorked % w.promotionEveryDays !== 0) return s;
  const need = w.promotionMinSkill[Math.min(j.level - 1, w.promotionMinSkill.length - 1)];
  const skill = s.skills.find((k) => k.name === "Problem solving")?.proficiency ?? 0;
  const company = findCompany(j.companyId)?.name ?? "Your manager";
  if (skill < need) {
    return addMessage(
      s,
      `promo-review-${j.totalDaysWorked}`,
      company,
      `Performance review: good work, but a promotion needs Problem solving ${need}+ (you have ${Math.floor(skill)}). Keep practising.`,
    );
  }
  const level = j.level + 1;
  const monthlySalary = Math.round((j.monthlySalary * (1 + w.promotionRaise)) / 100) * 100;
  const title = `${j.title.replace(/ \(Level \d+\)$/, "")} (Level ${level})`;
  const g = { ...s, job: { ...j, level, monthlySalary, title } };
  return addMessage(
    g,
    `promo-${j.totalDaysWorked}`,
    company,
    `Congratulations! You're promoted to ${title}. New salary: ₹${monthlySalary.toLocaleString("en-IN")} a month.`,
  );
}

// ---------- Saves ----------

/** Saves come from localStorage, so check the shape before trusting them; older saves get the new fields. */
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
      Array.isArray(v.messages) &&
      (v.invitations === undefined || Array.isArray(v.invitations)) &&
      (v.solved === undefined ||
        (Array.isArray(v.solved) &&
          v.solved.every((x: unknown) => typeof x === "string")));
    if (!ok) return null;
    return {
      ...v,
      playerId: typeof v.playerId === "string" ? v.playerId : newId(),
      resume:
        v.resume &&
        typeof v.resume.summary === "string" &&
        Array.isArray(v.resume.projects)
          ? v.resume
          : { summary: "", projects: [] },
      invitations: v.invitations ?? [],
      job: v.job ? { level: 1, totalDaysWorked: 0, tasksDone: [], tripsTaken: 0, carryOver: [], absentDays: [], ...v.job } : null,
      solved: v.solved ?? [],
      evidence: Array.isArray(v.evidence) ? v.evidence : [],
    } as GameState;
  } catch {
    return null;
  }
}

export const fmtTime = (minute: number) =>
  `${String(Math.floor(minute / 60)).padStart(2, "0")}:${String(minute % 60).padStart(2, "0")}`;

export const fmtMoney = (n: number) =>
  `${n < 0 ? "−" : ""}₹${Math.abs(n).toLocaleString("en-IN")}`;
