/// <reference types="vite/client" />
export type Test = { args: unknown[]; expected: unknown; explanation?: string };
export type Problem = {
  id: string;
  title: string;
  tier: string;
  difficulty: "easy" | "medium" | "hard";
  folder?: string;
  topic: string;
  tags: string[];
  statement: string;
  function: {
    name: string;
    params: { name: string; type: string }[];
    returns: string;
  };
  constraints: string[];
  examples: Test[];
  starter: { python: string };
  visibleTests: Test[];
  hiddenTests: Test[];
  limits: { timeMs: number; memoryMb: number };
  hints: string[];
  followUps: string[];
};

// shortcut: the whole problem (hidden tests included) ships to the browser for practice mode; interviews must load a stripped copy from the server.
const loaders = import.meta.glob("/content/problems/*.json", {
  import: "default",
}) as Record<string, () => Promise<Problem>>;

let all: Promise<Problem[]> | null = null;
/** Every problem, in the order Files lists them (tier, then title). */
export const loadProblems = () =>
  (all ??= Promise.all(Object.values(loaders).map((l) => l())).then((ps) =>
    ps.sort(
      (a, b) => a.tier.localeCompare(b.tier) || a.title.localeCompare(b.title),
    ),
  ));

export const FOLDERS: { id: string; name: string; topics: string[] }[] = [
  {
    id: "basics",
    name: "Basics",
    topics: ["arrays", "strings", "sorting", "searching", "merging", "math"],
  },
  {
    id: "data-structures",
    name: "Data Structures",
    topics: [
      "linked-list",
      "stack",
      "queue",
      "hash-map",
      "tree",
      "graph",
      "heap",
    ],
  },
  {
    id: "interview-prep",
    name: "Interview Prep",
    topics: [
      "two-pointers",
      "sliding-window",
      "recursion",
      "dynamic-programming",
      "mixed",
    ],
  },
];

export const topicName = (slug: string) =>
  slug
    .split("-")
    .map((w) => w[0]?.toUpperCase() + w.slice(1))
    .join(" ");

export const folderOf = (p: Problem) =>
  FOLDERS.some((f) => f.id === p.folder) ? p.folder! : "basics";

/** Topic slugs shown inside a folder: the fixed list plus any topic a problem brings that isn't in it. */
export function topicsIn(folder: string, problems: Problem[]) {
  const fixed = FOLDERS.find((f) => f.id === folder)?.topics ?? [];
  const extra = problems
    .filter((p) => folderOf(p) === folder && !fixed.includes(p.topic))
    .map((p) => p.topic);
  return [...fixed, ...new Set(extra)];
}

export const fileName = (p: Problem) => `${p.function.name}.py`;

const DRAFT = "codelife.draft.";
export function loadDraft(p: Problem) {
  try {
    return localStorage.getItem(DRAFT + p.id) ?? p.starter.python;
  } catch {
    return p.starter.python;
  }
}
export function saveDraft(p: Problem, code: string) {
  try {
    localStorage.setItem(DRAFT + p.id, code);
  } catch {
    /* storage blocked: the draft lives only until the laptop closes */
  }
}

const SOLVED = "codelife.solved";
export function readSolved(): string[] {
  try {
    const v = JSON.parse(localStorage.getItem(SOLVED) ?? "[]");
    return Array.isArray(v) ? v.filter((x) => typeof x === "string") : [];
  } catch {
    return [];
  }
}
export function addSolved(id: string) {
  const s = readSolved();
  if (s.includes(id)) return;
  try {
    localStorage.setItem(SOLVED, JSON.stringify([...s, id]));
  } catch {
    /* storage blocked */
  }
}

/** The next unsolved problem: same topic first, then same folder, then anywhere. */
export async function nextProblem(current: Problem, solved: string[]) {
  const ps = (await loadProblems()).filter(
    (p) => p.id !== current.id && !solved.includes(p.id),
  );
  const f = folderOf(current);
  return (
    ps.find((p) => folderOf(p) === f && p.topic === current.topic) ??
    ps.find((p) => folderOf(p) === f) ??
    ps[0] ??
    null
  );
}

export type Submission = {
  at: number; // Date.now()
  verdict: string;
  passed: number;
  total: number;
  ms: number;
};
const SUBS = "codelife.submissions.";
export function readSubmissions(id: string): Submission[] {
  try {
    const v = JSON.parse(localStorage.getItem(SUBS + id) ?? "[]");
    return Array.isArray(v) ? v : [];
  } catch {
    return [];
  }
}
export function addSubmission(id: string, s: Submission): Submission[] {
  const list = [s, ...readSubmissions(id)].slice(0, 20);
  try {
    localStorage.setItem(SUBS + id, JSON.stringify(list));
  } catch {
    /* storage blocked: history lasts until the laptop closes */
  }
  return list;
}
