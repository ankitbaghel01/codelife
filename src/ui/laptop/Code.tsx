import { useEffect, useRef, useState } from "react";
import Editor, { type OnMount, type BeforeMount } from "@monaco-editor/react";
import {
  pythonLoaded,
  runTests,
  type RunResult,
  type Which,
} from "../../runner/runner.ts";
import * as I from "./icons";
import { Markdown, py } from "./Markdown";
import {
  addSubmission,
  fileName,
  loadDraft,
  readSubmissions,
  saveDraft,
  type Problem,
  type Submission,
} from "./problems.ts";

type Props = {
  problem: Problem | null;
  solved: boolean;
  onSolved: (id: string) => void;
  onOpenFiles: () => void;
  onNext: () => void; // open the next unsolved problem
  onShowFolder: () => void; // show this problem's folder in Files
};

export function CodeApp(props: Props) {
  if (!props.problem)
    return (
      <div className="ide-none">
        <I.CodeApp />
        <p>No file open</p>
        <p className="fx-muted">Open a problem from Files to start coding.</p>
        <button className="lt-btn primary" onClick={props.onOpenFiles}>
          Open Files
        </button>
      </div>
    );
  return <Ide key={props.problem.id} {...props} problem={props.problem} />;
}

const defineTheme: BeforeMount = (monaco) => {
  monaco.editor.defineTheme("byteos-ink", {
    base: "vs-dark",
    inherit: true,
    rules: [
      { token: "comment", foreground: "7d6e60", fontStyle: "italic" },
      { token: "keyword", foreground: "f2b544" },
      { token: "string", foreground: "a8d08d" },
      { token: "number", foreground: "f59e6b" },
      { token: "identifier", foreground: "e9e1d6" },
      { token: "delimiter", foreground: "b3a594" },
      { token: "type", foreground: "6cb4ee" },
    ],
    colors: {
      "editor.background": "#1b1714",
      "editor.foreground": "#e9e1d6",
      "editorLineNumber.foreground": "#5a4d42",
      "editorLineNumber.activeForeground": "#c4b8a7",
      "editor.lineHighlightBackground": "#241e1a",
      "editor.lineHighlightBorder": "#00000000",
      "editor.selectionBackground": "#f2b54438",
      "editorCursor.foreground": "#f2b544",
      "editorIndentGuide.background1": "#2c2520",
      "editorWidget.background": "#221d19",
      "editorWidget.border": "#4a3d31",
      "editorSuggestWidget.selectedBackground": "#3a2f26",
      "scrollbarSlider.background": "#4a3d3155",
      "scrollbarSlider.hoverBackground": "#4a3d3199",
    },
  });
};

type Status = "idle" | "loading" | "running";
type Shown = RunResult & { which: Which; at: number };
type Verdict = { ok: boolean; title: string; detail?: string };

const clock = (t: number) =>
  new Date(t).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });

/** One-line outcome of a Run or Submit, in judge terms. */
function verdict(r: Shown): Verdict {
  const passed = r.results.filter((t) => t.passed).length;
  const total = r.results.length;
  if (r.fatal?.startsWith("Time limit"))
    return { ok: false, title: "Time limit exceeded", detail: r.fatal };
  if (r.fatal)
    return { ok: false, title: "Couldn’t run your code", detail: r.fatal };
  if (r.compileError)
    return { ok: false, title: "Compile error", detail: r.compileError };
  if (r.ok && total > 0)
    return r.which === "all"
      ? { ok: true, title: "Accepted" }
      : { ok: true, title: `Sample tests passed — ${passed}/${total}` };
  const firstFail = r.results.find((t) => !t.passed);
  return {
    ok: false,
    title: `${firstFail?.error ? "Runtime error" : "Wrong answer"} — ${passed}/${total} tests passed`,
  };
}

function Ide({
  problem,
  solved,
  onSolved,
  onNext,
  onShowFolder,
}: Props & { problem: Problem }) {
  const [initial] = useState(() => loadDraft(problem));
  const [status, setStatus] = useState<Status>("idle");
  const [running, setRunning] = useState<Which | null>(null);
  const [result, setResult] = useState<Shown | null>(null);
  const [tab, setTab] = useState<"tests" | "console" | "history">("tests");
  const [history, setHistory] = useState(() => readSubmissions(problem.id));
  const [confirmReset, setConfirmReset] = useState(false);
  const [cursor, setCursor] = useState({ line: 1, col: 1 });
  const codeRef = useRef(initial);
  const editorRef = useRef<Parameters<OnMount>[0] | null>(null);

  const run = useRef((_: Which) => {});
  const busyRef = useRef(false); // state lags a render; this blocks a double start from one key press
  run.current = (which) => {
    if (busyRef.current) return;
    busyRef.current = true;
    // Read the editor itself: the code on screen is the code that runs.
    const code = editorRef.current?.getValue() ?? codeRef.current;
    saveDraft(problem, code);
    setTab("tests");
    setRunning(which);
    setStatus(pythonLoaded() ? "running" : "loading");
    runTests(code, problem, which, setStatus).then((r) => {
      busyRef.current = false;
      setStatus("idle");
      setRunning(null);
      const shown = { ...r, which, at: Date.now() };
      setResult(shown);
      if (which !== "all") return;
      const v = verdict(shown);
      setHistory(
        addSubmission(problem.id, {
          at: shown.at,
          verdict: v.title.split(" — ")[0],
          passed: r.results.filter((t) => t.passed).length,
          total: r.results.length,
          ms: r.results.reduce((sum, t) => sum + t.timeMs, 0),
        }),
      );
      if (v.ok) onSolved(problem.id);
    });
  };

  const onMount: OnMount = (editor, monaco) => {
    editorRef.current = editor;
    const { KeyMod, KeyCode } = monaco;
    editor.addCommand(KeyMod.CtrlCmd | KeyCode.Enter, () =>
      run.current("visible"),
    );
    editor.addCommand(KeyMod.CtrlCmd | KeyMod.Shift | KeyCode.Enter, () =>
      run.current("all"),
    );
    editor.onDidChangeCursorPosition((e) =>
      setCursor({ line: e.position.lineNumber, col: e.position.column }),
    );
    editor.focus();
  };

  // Uncontrolled editor: a controlled `value` lags a render behind fast typing and eats keystrokes.
  const change = (v = "") => {
    codeRef.current = v;
    saveDraft(problem, v);
  };

  const reset = () => {
    editorRef.current?.setValue(problem.starter.python);
    change(problem.starter.python);
    setConfirmReset(false);
    editorRef.current?.focus();
  };

  useEffect(
    () => () =>
      saveDraft(problem, editorRef.current?.getValue() ?? codeRef.current),
    [problem],
  );

  const busy = status !== "idle";
  const passed = result?.results.filter((r) => r.passed).length ?? 0;
  const total = result?.results.length ?? 0;

  return (
    <div
      className="ide"
      onKeyDown={(e) => {
        if (
          e.defaultPrevented ||
          !(e.ctrlKey || e.metaKey) ||
          e.key !== "Enter"
        )
          return;
        e.preventDefault();
        run.current(e.shiftKey ? "all" : "visible");
      }}
    >
      <aside className="ide-problem" aria-label="Problem">
        <div className="ide-problem-head">
          <h1>{problem.title}</h1>
          <div className="ide-meta">
            <span className={`badge ${problem.difficulty}`}>
              {problem.difficulty}
            </span>
            {problem.tags.map((t) => (
              <span key={t} className="tag">
                {t}
              </span>
            ))}
            {solved && (
              <span className="ide-solved">
                <I.Check size={12} /> Solved
              </span>
            )}
          </div>
        </div>
        <div className="ide-statement">
          <Markdown text={problem.statement} />
          <p className="ide-sig mono">
            def {problem.function.name}(
            {problem.function.params
              .map((p) => `${p.name}: ${p.type}`)
              .join(", ")}
            ) -&gt; {problem.function.returns}
          </p>
          {problem.examples.map((ex, i) => (
            <div key={i} className="ide-example">
              <h3>Example {i + 1}</h3>
              <pre>
                <b>Input: </b>
                {problem.function.params
                  .map((p, j) => `${p.name} = ${py(ex.args[j])}`)
                  .join(", ")}
                {"\n"}
                <b>Output: </b>
                {py(ex.expected)}
                {ex.explanation && (
                  <>
                    {"\n"}
                    <b>Why: </b>
                    {ex.explanation}
                  </>
                )}
              </pre>
            </div>
          ))}
          <h3>Constraints</h3>
          <ul className="ide-constraints">
            {problem.constraints.map((c) => (
              <li key={c}>
                <code>{c}</code>
              </li>
            ))}
          </ul>
        </div>
      </aside>

      <section className="ide-main">
        <div className="ide-toolbar">
          <div className="ide-file-tab">
            <I.PyFile size={14} />
            <span>{fileName(problem)}</span>
          </div>
          <label className="sr-only" htmlFor="ide-lang">
            Language
          </label>
          <select
            id="ide-lang"
            className="ide-select"
            value="python"
            onChange={() => {}}
          >
            <option value="python">Python 3</option>
            <option value="java" disabled>
              Java (coming soon)
            </option>
          </select>
          <div className="ide-reset-wrap">
            <button
              className="lt-btn ghost"
              onClick={() => setConfirmReset(true)}
              disabled={busy}
            >
              <I.Reset /> Reset
            </button>
            {confirmReset && (
              <div
                className="ide-pop"
                role="alertdialog"
                aria-label="Reset code?"
                onKeyDown={(e) => {
                  if (e.key !== "Escape") return;
                  e.preventDefault(); // keeps Esc from closing the window too
                  setConfirmReset(false);
                }}
              >
                <p>
                  <b>Reset to the starter code?</b>
                  <br />
                  Your current code for this problem will be replaced.
                </p>
                <div className="lt-modal-actions">
                  <button
                    className="lt-btn"
                    autoFocus
                    onClick={() => setConfirmReset(false)}
                  >
                    Cancel
                  </button>
                  <button className="lt-btn danger" onClick={reset}>
                    Reset code
                  </button>
                </div>
              </div>
            )}
          </div>
          <span className="ide-spacer" />
          <button
            className="lt-btn"
            onClick={() => run.current("visible")}
            disabled={busy}
            aria-busy={running === "visible"}
            title="Run sample tests (Ctrl+Enter)"
          >
            {running === "visible" ? (
              <span className="spin" aria-hidden="true" />
            ) : (
              <I.Play />
            )}
            {running === "visible" ? "Running…" : "Run"}
          </button>
          <button
            className="lt-btn primary"
            onClick={() => run.current("all")}
            disabled={busy}
            aria-busy={running === "all"}
            title="Submit: run all tests (Ctrl+Shift+Enter)"
          >
            {running === "all" ? (
              <span className="spin dark" aria-hidden="true" />
            ) : (
              <I.Send />
            )}
            {running === "all" ? "Submitting…" : "Submit"}
          </button>
        </div>

        <div className="ide-editor">
          <Editor
            language="python"
            theme="byteos-ink"
            defaultValue={initial}
            onChange={change}
            beforeMount={defineTheme}
            onMount={onMount}
            loading={<div className="ide-loading">Loading editor…</div>}
            options={{
              fontFamily: "'JetBrains Mono', monospace",
              fontSize: 14,
              lineHeight: 22,
              minimap: { enabled: false },
              scrollBeyondLastLine: false,
              automaticLayout: true,
              tabSize: 4,
              insertSpaces: true,
              padding: { top: 12, bottom: 12 },
              renderLineHighlight: "line",
              smoothScrolling: true,
              fixedOverflowWidgets: true,
              ariaLabel: `${fileName(problem)} editor`,
            }}
          />
        </div>

        <div className="ide-panel">
          <div className="ide-panel-head">
            <div className="ide-tabs" role="tablist">
              {(["tests", "console", "history"] as const).map((t) => (
                <button
                  key={t}
                  role="tab"
                  aria-selected={tab === t}
                  className={tab === t ? "on" : ""}
                  onClick={() => setTab(t)}
                >
                  {t === "tests"
                    ? "Tests"
                    : t === "console"
                      ? "Console"
                      : "Submissions"}
                  {t === "history" && history.length > 0 && (
                    <span className="ide-count">{history.length}</span>
                  )}
                  {t === "tests" &&
                    result &&
                    !result.fatal &&
                    !result.compileError && (
                      <span
                        className={`ide-count ${passed === total ? "ok" : "bad"}`}
                      >
                        {passed}/{total}
                      </span>
                    )}
                </button>
              ))}
            </div>
            <span className="ide-practice">
              Practice mode — your code runs in this browser
            </span>
          </div>
          <div className="ide-panel-body" role="tabpanel" aria-live="polite">
            {tab === "history" ? (
              <HistoryView list={history} />
            ) : busy ? (
              <div className="ide-busy">
                <span className="spin" aria-hidden="true" />
                {status === "loading"
                  ? "Starting Python… first run downloads ~10 MB"
                  : running === "all"
                    ? "Submitting: running every test, including hidden ones…"
                    : "Running sample tests…"}
              </div>
            ) : !result ? (
              <p className="ide-hint">
                <b>Run</b> <kbd>Ctrl</kbd>+<kbd>Enter</kbd> checks the examples
                and sample tests. <b>Submit</b> <kbd>Ctrl</kbd>+<kbd>Shift</kbd>
                +<kbd>Enter</kbd> runs every test, including hidden ones.
              </p>
            ) : tab === "tests" ? (
              <TestsView
                params={problem.function.params.map((p) => p.name)}
                r={result}
                passed={passed}
                total={total}
                onNext={onNext}
                onShowFolder={onShowFolder}
              />
            ) : (
              <ConsoleView r={result} />
            )}
          </div>
        </div>

        <footer className="ide-status">
          <span>Python 3.12 · Pyodide</span>
          <span>UTF-8</span>
          <span>Spaces: 4</span>
          <span className="ide-spacer" />
          <span>
            Ln {cursor.line}, Col {cursor.col}
          </span>
          <span>Draft saved</span>
        </footer>
      </section>
    </div>
  );
}

function TestsView({
  r,
  params,
  passed,
  total,
  onNext,
  onShowFolder,
}: {
  r: Shown;
  params: string[];
  passed: number;
  total: number;
  onNext: () => void;
  onShowFolder: () => void;
}) {
  const v = verdict(r);
  const ms = r.results.reduce((sum, x) => sum + x.timeMs, 0);
  const firstFail = r.results.find((t) => !t.passed && t.kind !== "hidden");
  const accepted = v.ok && r.which === "all";
  return (
    <>
      <div
        className={`ide-verdict ${v.ok ? "ok" : "bad"}${accepted ? " big" : ""}`}
        role="status"
      >
        <span className="ide-verdict-icon" aria-hidden="true">
          {v.ok ? (
            <I.Check size={accepted ? 22 : 16} />
          ) : (
            <I.Cross size={accepted ? 22 : 16} />
          )}
        </span>
        <div className="ide-verdict-text">
          <b>{v.title}</b>
          {accepted ? (
            <p>Your solution is correct. Submitted successfully.</p>
          ) : r.which === "visible" && v.ok ? (
            <p>
              Run only checks the examples and sample tests. Submit to run the
              hidden tests too.
            </p>
          ) : null}
          {total > 0 && !v.detail && (
            <p className="ide-verdict-meta">
              {passed}/{total} tests passed · {ms.toFixed(1)} ms ·{" "}
              {r.which === "all" ? "Submitted" : "Ran"} at {clock(r.at)}
            </p>
          )}
          {v.detail && <pre>{v.detail}</pre>}
        </div>
        {accepted && (
          <div className="ide-verdict-actions">
            <button className="lt-btn" onClick={onShowFolder}>
              Back to folder
            </button>
            <button className="lt-btn primary" onClick={onNext}>
              Next problem
            </button>
          </div>
        )}
      </div>
      <ul className="ide-results">
        {r.results.map((t) => (
          <li key={t.name} className={t.passed ? "ok" : "bad"}>
            {t.kind === "hidden" ? (
              <div className="ide-row">
                <StatusIcon ok={t.passed} />
                <span className="ide-row-name">{t.name}</span>
                <span className="ide-hidden">
                  <I.Lock /> hidden
                </span>
                {t.error && <span className="ide-row-err">{t.error}</span>}
                <span className="ide-row-time">{t.timeMs.toFixed(1)} ms</span>
              </div>
            ) : (
              <details open={t === firstFail}>
                <summary className="ide-row">
                  <StatusIcon ok={t.passed} />
                  <span className="ide-row-name">{t.name}</span>
                  <span className="ide-row-time">{t.timeMs.toFixed(1)} ms</span>
                </summary>
                <dl className="ide-io">
                  <dt>Input</dt>
                  <dd>{(t.args ?? [])
                      .map((a, i) => `${params[i] ?? `arg${i + 1}`} = ${py(a)}`)
                      .join(", ")}</dd>
                  <dt>Expected</dt>
                  <dd>{py(t.expected)}</dd>
                  <dt>{t.error ? "Error" : "Got"}</dt>
                  <dd className={t.passed ? "" : "bad"}>
                    {t.error ?? py(t.got)}
                  </dd>
                  {t.stdout && (
                    <>
                      <dt>Stdout</dt>
                      <dd>
                        <pre>{t.stdout}</pre>
                      </dd>
                    </>
                  )}
                </dl>
              </details>
            )}
          </li>
        ))}
      </ul>
    </>
  );
}

function HistoryView({ list }: { list: Submission[] }) {
  if (!list.length)
    return (
      <p className="ide-hint">
        No submissions yet. Each Submit runs every test and is recorded here.
      </p>
    );
  return (
    <table className="ide-history">
      <thead>
        <tr>
          <th>Submitted</th>
          <th>Result</th>
          <th>Tests</th>
          <th>Time</th>
        </tr>
      </thead>
      <tbody>
        {list.map((h) => (
          <tr key={h.at}>
            <td>
              {new Date(h.at).toLocaleDateString([], {
                day: "numeric",
                month: "short",
              })}
              , {clock(h.at)}
            </td>
            <td className={h.verdict === "Accepted" ? "ok" : "bad"}>
              {h.verdict}
            </td>
            <td>
              {h.passed}/{h.total}
            </td>
            <td>{h.ms.toFixed(1)} ms</td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}

function ConsoleView({ r }: { r: Shown }) {
  const out = r.results.filter(
    (t) => t.stdout || (t.error && t.kind !== "hidden"),
  );
  return (
    <div className="ide-console mono">
      {r.fatal && <pre className="bad">{r.fatal}</pre>}
      {r.compileError && <pre className="bad">{r.compileError}</pre>}
      {out.map((t) => (
        <div key={t.name}>
          <p className="ide-console-head">── {t.name} ──</p>
          {t.stdout && <pre>{t.stdout}</pre>}
          {t.error && <pre className="bad">{t.error}</pre>}
        </div>
      ))}
      {!out.length && !r.fatal && !r.compileError && (
        <p className="ide-hint">
          Nothing printed. Output from print() appears here, per test.
        </p>
      )}
      <p className="ide-console-head">
        Finished in {r.wallMs} ms ({r.which === "all" ? "Submit" : "Run"})
      </p>
    </div>
  );
}

const StatusIcon = ({ ok }: { ok: boolean }) => (
  <span
    className={`ide-dot ${ok ? "ok" : "bad"}`}
    aria-label={ok ? "passed" : "failed"}
  >
    {ok ? <I.Check size={12} /> : <I.Cross size={12} />}
  </span>
);
