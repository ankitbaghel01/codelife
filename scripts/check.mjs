// Deterministic rule tests (PRD 27.6): run with `npm run check`. Node 22.6+ strips the TypeScript types.
import assert from "node:assert/strict";
import { resolve, boomLength } from "../src/game/collision.ts";
import {
  addSkill,
  balance,
  canAttend,
  findRole,
  goToWork,
  whyCantWork,
  promote,
  interviewOutcome,
  practiceSolved,
  qualifies,
  refreshInvitations,
  respondInvitation,
  setResume,
  eat,
  newGame,
  parseSave,
  removeSkill,
  renameSkill,
  sleep,
  tick,
  validName,
} from "../src/game/state.ts";

let n = 0;
const test = (name, fn) => {
  fn();
  n++;
  console.log("ok", name);
};

test("player is pushed out of a wall", () => {
  const [x] = resolve(0.1, 1, 0.3, [
    { minX: -0.05, maxX: 0.05, minZ: 0, maxZ: 5 },
  ]);
  assert.ok(Math.abs(x - 0.35) < 1e-9);
});
test("free space is untouched", () => {
  assert.deepEqual(
    resolve(2, 2, 0.3, [{ minX: 0, maxX: 1, minZ: 0, maxZ: 1 }]),
    [2, 2],
  );
});
test("camera boom stops before a wall", () => {
  const d = boomLength(1, 1, -1, 0, 2.2, [
    { minX: -0.05, maxX: 0.05, minZ: 0, maxZ: 5 },
  ]);
  assert.ok(d < 0.8 && d > 0.6, `boom ${d}`);
});

test("new game uses PRD starting state", () => {
  const g = newGame("  Aarav ");
  assert.equal(g.name, "Aarav");
  assert.equal(balance(g), 5000);
  assert.equal(g.skills.find((s) => s.name === "HTML").proficiency, 40);
  assert.equal(g.messages.length, 4); // 3 story messages + the first job invitation
});
test("names are validated", () => {
  assert.ok(validName(""));
  assert.ok(validName("x".repeat(25)));
  assert.ok(validName("<script>"));
  assert.equal(validName("Ravi O'Neil-K."), undefined);
});
test("clock rolls over midnight and drifts stats", () => {
  const g = tick({ ...newGame("A"), minute: 1430 }, 20);
  assert.equal(g.day, 2);
  assert.equal(g.minute, 10);
  assert.ok(g.hunger > 30 && g.energy < 90);
});
test("sleep moves to next morning with full energy", () => {
  const g = sleep(newGame("A"));
  assert.equal(g.day, 2);
  assert.equal(g.energy, 100);
});
test("eating costs money and lowers hunger", () => {
  const { state, error } = eat({ ...newGame("A"), hunger: 80 });
  assert.equal(error, undefined);
  assert.equal(balance(state), 4880);
  assert.ok(state.hunger < 30);
});
test("cannot eat without money", () => {
  const g = newGame("A");
  const broke = { ...g, ledger: [{ ...g.ledger[0], amount: 50 }] };
  const r = eat(broke);
  assert.ok(r.error);
  assert.equal(r.state, broke);
});
test("claimed skills start at zero proficiency (integrity rule)", () => {
  const { state } = addSkill(newGame("A"), "  Python  ");
  const py = state.skills.at(-1);
  assert.deepEqual(py, { name: "Python", proficiency: 0, source: "claimed" });
});
test("duplicate and empty skills are rejected", () => {
  assert.ok(addSkill(newGame("A"), "html").error);
  assert.ok(addSkill(newGame("A"), "   ").error);
});
test("starting skills cannot be renamed or removed", () => {
  assert.ok(renameSkill(newGame("A"), 0, "Hacking").error);
  assert.ok(removeSkill(newGame("A"), 0).error);
});
test("claimed skills can be renamed and removed", () => {
  const a = addSkill(newGame("A"), "Pythn").state;
  const b = renameSkill(a, a.skills.length - 1, "Python").state;
  assert.equal(b.skills.at(-1).name, "Python");
  assert.equal(removeSkill(b, b.skills.length - 1).state.skills.length, 6);
});
test("saves round-trip and bad saves are rejected", () => {
  const g = newGame("A");
  assert.deepEqual(parseSave(JSON.stringify(g)), g);
  assert.equal(parseSave("{oops"), null);
  assert.equal(
    parseSave(JSON.stringify({ ...g, ledger: [{ amount: "9999999" }] })),
    null,
  );
});


// ---------- Phase 2: invitations, practice, resume ----------
test("day 1: the fresher is invited to the T1 company for day 2", () => {
  const g = newGame("A");
  assert.equal(g.invitations.length, 1);
  const v = g.invitations[0];
  assert.deepEqual([v.companyId, v.day, v.status], ["sutradhar", 2, "pending"]);
});
test("only one new invitation per day, and no duplicate for the same company", () => {
  assert.equal(refreshInvitations(newGame("A")).invitations.length, 1);
});
test("accepting an invitation and the attendance window", () => {
  let g = newGame("A");
  const id = g.invitations[0].id;
  const inv = (s) => s.invitations.find((v) => v.id === id);
  assert.ok(canAttend(g, inv(g))); // still pending
  g = respondInvitation(g, id, true).state;
  assert.match(canAttend(g, inv(g)), /Day 2/);
  g = sleep(g); // day 2, 07:00
  assert.match(canAttend(g, inv(g)), /09:00/);
  g = tick(g, 3 * 60); // 10:00
  assert.equal(canAttend(g, inv(g)), undefined);
  assert.ok(respondInvitation(g, id, false).error); // can't change after accepting
});
test("a missed interview expires the next day", () => {
  let g = newGame("A");
  g = respondInvitation(g, g.invitations[0].id, true).state;
  g = sleep(sleep(g)); // day 3
  assert.equal(g.invitations[0].status, "expired");
});
test("practice: first accepted solution raises DSA, repeats don't", () => {
  const p = { id: "t1-x", title: "X", difficulty: "medium" };
  const a = practiceSolved(newGame("A"), p);
  const dsa = (g) => g.skills.find((k) => k.name === "DSA").proficiency;
  assert.equal(dsa(a), 14);
  assert.equal(a.evidence.length, 2); // DSA + Problem solving (no Python skill listed)
  assert.equal(practiceSolved(a, p), a);
});
test("practice raises a listed Python skill (evidence for a claimed skill)", () => {
  const g = practiceSolved(addSkill(newGame("A"), "Python").state, { id: "t1-y", title: "Y", difficulty: "easy" });
  assert.equal(g.skills.find((k) => k.name === "Python").proficiency, 1);
});
test("enough practice unlocks the T2 company", () => {
  let g = newGame("A");
  const role = findRole("kiranacart", "frontend");
  assert.equal(qualifies(g, role), false);
  g = { ...g, skills: g.skills.map((k) => (k.name === "JavaScript" ? { ...k, proficiency: 40 } : k.name === "DSA" ? { ...k, proficiency: 25 } : k)) };
  assert.equal(qualifies(g, role), true);
});
test("resume validation", () => {
  const g = newGame("A");
  assert.ok(setResume(g, { summary: "x".repeat(401), projects: [] }).error);
  assert.ok(setResume(g, { summary: "", projects: [{ name: "", description: "" }] }).error);
  const ok = setResume(g, { summary: " Fresher ", projects: [{ name: " Todo app ", description: "React + localStorage" }] });
  assert.equal(ok.error, undefined);
  assert.deepEqual(ok.state.resume, { summary: "Fresher", projects: [{ name: "Todo app", description: "React + localStorage" }] });
});

// ---------- Phase 5: offer, work, salary, rent ----------
const offer = { companyId: "sutradhar", roleId: "jr-web", title: "Junior Web Developer", monthlySalary: 26000, joinInDays: 2 };
test("rejection keeps you unemployed; accepting an offer creates the job", () => {
  const g = newGame("A");
  const id = g.invitations[0].id;
  const r = interviewOutcome(g, id, null, false);
  assert.equal(r.job, null);
  assert.equal(r.invitations[0].status, "attended");
  assert.equal(interviewOutcome(g, id, offer, false).job, null); // declined offer
  assert.equal(interviewOutcome(g, id, offer, true).job.startDay, 3);
});
test("work shifts: start day, hours, once a day, energy", () => {
  let g = interviewOutcome(newGame("A"), "x", offer, true); // starts day 3
  assert.match(goToWork(g).error, /Day 3/);
  g = tick(sleep(sleep(g)), 2 * 60); // day 3, 09:00
  const w = goToWork(g);
  assert.equal(w.error, undefined);
  assert.equal(w.state.job.daysWorked, 1);
  assert.equal(w.state.minute, 17 * 60);
  assert.match(goToWork(w.state).error, /already/);
});
test("work: arriving early waits for 09:00; too late is refused with a reason", () => {
  let g = tick(sleep(sleep(interviewOutcome(newGame("A"), "x", offer, true))), 30); // day 3, 07:30
  assert.equal(whyCantWork(g), null);
  const w = goToWork(g);
  assert.equal(w.error, undefined);
  assert.equal(w.state.minute, 17 * 60); // waited until 09:00, then an 8-hour shift
  g = tick(g, 10 * 60); // 17:30
  assert.match(whyCantWork(g), /closed/);
  assert.match(goToWork(g).error, /closed/);
});
test("payday is pro-rated by days worked; rent is charged on day 30", () => {
  let g = interviewOutcome(newGame("A"), "x", offer, true); // job from day 3
  g = { ...g, job: { ...g.job, daysWorked: 10 } };
  const start = balance(g);
  while (g.day < 33) g = sleep(g); // passes day 30 (rent) and day 33 (first payday)
  assert.equal(balance(g) - start, 13000 - 4000);
  assert.equal(g.job.daysWorked, 0);
});
test("old saves without the new fields still load", () => {
  const old = { version: 1, name: "A", day: 1, minute: 0, energy: 1, hunger: 1, skills: [], ledger: [], messages: [] };
  const g = parseSave(JSON.stringify(old));
  assert.ok(g && typeof g.playerId === "string");
  assert.deepEqual([g.invitations, g.solved, g.job], [[], [], null]);
});


test("promotion after 20 days worked needs enough problem solving", () => {
  let g = interviewOutcome(newGame("A"), "x", offer, true);
  g = { ...g, job: { ...g.job, totalDaysWorked: 20 } };
  const low = promote(g); // Problem solving 20 < 35
  assert.equal(low.job.level, 1);
  assert.match(low.messages.at(-1).text, /needs Problem solving 35/);
  const ps = { ...g, skills: g.skills.map((k) => (k.name === "Problem solving" ? { ...k, proficiency: 40 } : k)) };
  const up = promote(ps);
  assert.deepEqual([up.job.level, up.job.monthlySalary, up.job.title], [2, 29900, "Junior Web Developer (Level 2)"]);
  assert.equal(promote({ ...ps, job: { ...ps.job, totalDaysWorked: 21 } }).job.level, 1); // only on every 20th day
});
test("old saves with a job get a level", () => {
  const g = interviewOutcome(newGame("A"), "x", offer, true);
  const { level, totalDaysWorked, ...oldJob } = g.job;
  const back = parseSave(JSON.stringify({ ...g, job: oldJob }));
  assert.deepEqual([back.job.level, back.job.totalDaysWorked], [1, 0]);
});

console.log(`\n${n} checks passed`);
