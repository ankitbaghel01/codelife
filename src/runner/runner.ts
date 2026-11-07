// Main-thread wrapper around the Pyodide worker: one run at a time, with a hard time limit.
// Practice mode only. Interview grading will run on the server.

export type TestResult = {
  name: string;
  kind: "example" | "visible" | "hidden";
  passed: boolean;
  args: unknown[] | null;
  expected: unknown;
  got: unknown;
  error: string | null;
  stdout: string;
  timeMs: number;
};
export type RunResult = {
  ok: boolean;
  compileError: string | null;
  results: TestResult[];
  fatal?: string; // the run never finished: time limit, Python failed to load, harness missing
  wallMs: number;
};
export type Which = "visible" | "all";
export type RunProblem = {
  limits: { timeMs: number };
  examples: unknown[];
  visibleTests: unknown[];
  hiddenTests: unknown[];
};

let worker: Worker | null = null;
let booted = false;
let seq = 0;

export const pythonLoaded = () => booted;

export function runTests(
  code: string,
  problem: RunProblem,
  which: Which,
  onStatus: (s: "loading" | "running") => void,
): Promise<RunResult> {
  worker ??= new Worker(new URL("./pyWorker.ts", import.meta.url), {
    type: "module",
  });
  const w = worker;
  const id = ++seq;
  const tests =
    problem.examples.length +
    problem.visibleTests.length +
    (which === "all" ? problem.hiddenTests.length : 0);
  const limit = Math.min(20000, Math.max(5000, problem.limits.timeMs * tests));
  const t0 = performance.now();

  return new Promise((resolve) => {
    let timer = 0;
    const done = (r: Omit<RunResult, "wallMs">) => {
      window.clearTimeout(timer);
      w.removeEventListener("message", onMsg);
      w.removeEventListener("error", onErr);
      resolve({ ...r, wallMs: Math.round(performance.now() - t0) });
    };
    const fail = (fatal: string) =>
      done({ ok: false, compileError: null, results: [], fatal });
    const kill = () => {
      w.terminate();
      if (worker === w) worker = null; // a fresh worker is created on the next run
      booted = false;
    };
    const onMsg = (e: MessageEvent) => {
      const m = e.data;
      if (m.id !== id) return;
      if (m.type === "status") onStatus("loading");
      else if (m.type === "started") {
        booted = true;
        onStatus("running");
        // The clock starts only once Python is loaded, so the ~10 MB first download never counts.
        timer = window.setTimeout(() => {
          kill();
          fail(
            `Time limit exceeded: your code ran longer than ${limit / 1000} s. Look for an infinite loop or a slow algorithm.`,
          );
        }, limit);
      } else if (m.type === "result") done(m.result);
      else if (m.type === "error") fail(m.message);
    };
    const onErr = (e: ErrorEvent) => {
      kill();
      fail(e.message || "The Python worker crashed. Try again.");
    };
    w.addEventListener("message", onMsg);
    w.addEventListener("error", onErr);
    w.postMessage({ id, code, problem, which });
  });
}
