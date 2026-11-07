/// <reference types="vite/client" />
// Practice-mode Python runner: Pyodide in a Web Worker, so an infinite loop can be killed by terminating the worker.

const PYODIDE = "https://cdn.jsdelivr.net/pyodide/v0.26.4/full/";

// Optional glob so the build still works before content/harness.py exists.
const harnessFiles = import.meta.glob("/content/harness.py", {
  query: "?raw",
  import: "default",
  eager: true,
}) as Record<string, string>;
const HARNESS = harnessFiles["/content/harness.py"];

type Py = {
  runPython: (code: string) => unknown;
  runPythonAsync: (code: string) => Promise<unknown>;
  globals: { set: (k: string, v: unknown) => void };
  setStdout: (o: { batched: (s: string) => void }) => void;
};

let ready: Promise<Py> | null = null;

function boot(): Promise<Py> {
  return (async () => {
    if (!HARNESS)
      throw new Error(
        "The test harness (content/harness.py) isn't installed yet, so tests can't run.",
      );
    const mod = await import(/* @vite-ignore */ `${PYODIDE}pyodide.mjs`);
    const py: Py = await mod.loadPyodide({ indexURL: PYODIDE });
    py.setStdout({ batched: () => {} }); // the harness captures user stdout itself
    py.runPython(HARNESS);
    return py;
  })();
}

self.onmessage = async (e: MessageEvent) => {
  const { id, code, problem, which } = e.data;
  const post = (m: object) => self.postMessage({ id, ...m });
  try {
    if (!ready) {
      post({ type: "status", status: "loading" });
      ready = boot();
      ready.catch(() => (ready = null)); // a failed boot (offline, CDN down) is retried on the next run
    }
    const py = await ready;
    post({ type: "started" });
    py.globals.set("__cl_code", code);
    py.globals.set("__cl_problem", JSON.stringify(problem));
    py.globals.set("__cl_which", which);
    // JSON round trip gives plain JS values (None -> null) without proxy cleanup.
    const out = (await py.runPythonAsync(
      "import json as __cl_json\n__cl_json.dumps(run_tests(__cl_code, __cl_json.loads(__cl_problem), __cl_which), default=repr)",
    )) as string;
    post({ type: "result", result: JSON.parse(out) });
  } catch (err) {
    post({
      type: "error",
      message: err instanceof Error ? err.message : String(err),
    });
  }
};
