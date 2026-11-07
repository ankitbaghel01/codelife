// Deterministic rule tests (PRD 27.6): run with `npm run check`. Node 22.6+ strips the TypeScript types.
import assert from "node:assert/strict";
import { resolve, boomLength } from "../src/game/collision.ts";
import {
  addSkill,
  balance,
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
  assert.equal(g.messages.length, 3);
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

console.log(`\n${n} checks passed`);
