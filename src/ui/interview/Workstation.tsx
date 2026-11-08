// Full-screen coding workstation (PRD 12.2). Code runs only on the server's executor; nothing is judged in the browser.
import { useEffect, useRef, useState } from "react";
import Editor, { type BeforeMount, type OnMount } from "@monaco-editor/react";
import { getHealth, runCode, submitCode } from "../../api/client";
import type {
  CodingTask,
  InterviewView,
  RunResult,
  TestResult,
} from "../../api/types";
import { Markdown, py } from "../laptop/Markdown";
import { Confirm } from "./Confirm";
import { elapsed, initials, keys, store } from "./shared";

type Props = {
  view: InterviewView;
  task: CodingTask;
  companyName: string;
  playerId: string;
  /** Back to the conversation without submitting. */
  onExit: () => void;
  /** Server state after a Submit; the parent returns to the conversation once it leaves coding. */
  onSubmitted: (v: InterviewView) => void;
};

type Shown = { r: RunResult; submit: boolean; at: number };
type Verdict = { ok: boolean; title: string; detail?: string };

const RETURN_DELAY_MS = 2500;

const defineTheme: BeforeMount = (monaco) => {
  monaco.editor.defineTheme("codelife-interview", {
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
      "scrollbarSlider.background": "#4a3d3155",
      "scrollbarSlider.hoverBackground": "#4a3d3199",
    },
  });
};

function verdict({ r, submit }: Shown): Verdict {
  if (r.compileError)
    return { ok: false, title: "Compile error", detail: r.compileError };
  if (r.ok && r.total > 0)
    return submit
      ? { ok: true, title: "Accepted" }
      : { ok: true, title: `Sample tests passed · ${r.passed}/${r.total}` };
  const failed = r.results.filter((t) => !t.passed);
  if (failed.some((t) => t.error && /time limit/i.test(t.error)))
    return {
      ok: false,
      title: `Time limit exceeded · ${r.passed}/${r.total} passed`,
    };
  if (failed.some((t) => t.error))
    return {
      ok: false,
      title: `Runtime error · ${r.passed}/${r.total} passed`,
    };
  return { ok: false, title: `Wrong answer · ${r.passed}/${r.total} passed` };
}

export function Workstation({
  view,
  task,
  companyName,
  playerId,
  onExit,
  onSubmitted,
}: Props) {
  const draftKey = keys.draft(view.id, task.questionId);
  const [initial] = useState(() => store.get(draftKey) ?? task.starter.python);
  const [startedAt] = useState(() => {
    const k = keys.started(view.id, task.questionId);
    const saved = Number(store.get(k));
    if (saved > 0) return saved;
    const now = Date.now();
    store.set(k, String(now));
    return now;
  });
  const [now, setNow] = useState(Date.now());
  const [running, setRunning] = useState<"run" | "submit" | null>(null);
  const [shown, setShown] = useState<Shown | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [tab, setTab] = useState<"tests" | "console">("tests");
  const [executor, setExecutor] = useState<RunResult["executor"] | null>(null);
  const [returning, setReturning] = useState<InterviewView | null>(null);
  const [confirm, setConfirm] = useState<"exit" | "reset" | "submit" | null>(null);
  const [sideOpen, setSideOpen] = useState(true);
  const editorRef = useRef<Parameters<OnMount>[0] | null>(null);
  const busyRef = useRef(false); // state lags a render; this blocks a double Submit from one key press
  const doneRef = useRef(false); // a final submit is in; no more runs
  const submittedRef = useRef(onSubmitted);
  submittedRef.current = onSubmitted; // the parent passes a fresh callback each render; the return timer must not restart

  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(t);
  }, []);

  useEffect(() => {
    getHealth(playerId)
      .then((h) => setExecutor((e) => e ?? h.executor))
      .catch(() => {}); // the label fills in from the first run instead
  }, [playerId]);

  useEffect(() => {
    if (!returning) return;
    const t = setTimeout(() => submittedRef.current(returning), RETURN_DELAY_MS);
    return () => clearTimeout(t);
  }, [returning]);

  const code = () =>
    editorRef.current?.getValue() ?? store.get(draftKey) ?? initial;

  // Only one submit per coding question: always confirm first.
  const askSubmit = useRef(() => {});
  askSubmit.current = () => {
    if (!busyRef.current && !doneRef.current) setConfirm("submit");
  };

  const exec = useRef(async (_: "run" | "submit") => {});
  exec.current = async (kind) => {
    if (busyRef.current || doneRef.current) return;
    busyRef.current = true;
    const src = code(); // read the editor itself: the code on screen is the code that runs
    store.set(draftKey, src);
    setRunning(kind);
    setError(null);
    setTab("tests");
    try {
      if (kind === "run") {
        const r = await runCode(playerId, view.id, task.questionId, src);
        setExecutor(r.executor);
        setShown({ r, submit: false, at: Date.now() });
      } else {
        const { result, interview } = await submitCode(
          playerId,
          view.id,
          task.questionId,
          src,
        );
        setExecutor(result.executor);
        setShown({ r: result, submit: true, at: Date.now() });
        const left =
          interview.status !== "coding" ||
          interview.coding?.questionId !== task.questionId;
        if (left) {
          doneRef.current = true;
          setReturning(interview);
        } else onSubmitted(interview); // resubmission allowed: stay, refresh the side panel
      }
    } catch (e) {
      setError((e as Error).message);
    } finally {
      busyRef.current = false;
      setRunning(null);
      // The clicked button was disabled while running, which drops focus to <body>; keep shortcuts working.
      requestAnimationFrame(() => {
        if (document.activeElement === document.body) editorRef.current?.focus();
      });
    }
  };

  const onMount: OnMount = (editor, monaco) => {
    editorRef.current = editor;
    const { KeyMod, KeyCode } = monaco;
    editor.addCommand(
      KeyMod.CtrlCmd | KeyCode.Enter,
      () => void exec.current("run"),
    );
    editor.addCommand(
      KeyMod.CtrlCmd | KeyMod.Shift | KeyCode.Enter,
      () => askSubmit.current(),
    );
    editor.focus();
  };

  useEffect(() => () => store.set(draftKey, code()), []); // eslint-disable-line react-hooks/exhaustive-deps

  const reset = () => {
    editorRef.current?.setValue(task.starter.python);
    store.set(draftKey, task.starter.python);
    setConfirm(null);
    editorRef.current?.focus();
  };

  const busy = running !== null;
  const locked = busy || returning !== null;
  const latest = view.messages.filter((m) => m.speaker !== "player").slice(-5);
  const sig = `def ${task.function.name}(${task.function.params.map((p) => `${p.name}: ${p.type}`).join(", ")}) -> ${task.function.returns}`;
  const params = task.function.params.map((p) => p.name);

  return (
    <div
      className={`iv-ide${sideOpen ? "" : " side-closed"}`}
      onKeyDown={(e) => {
        if (
          e.defaultPrevented ||
          !(e.ctrlKey || e.metaKey) ||
          e.key !== "Enter"
        )
          return;
        e.preventDefault();
        if (e.shiftKey) askSubmit.current();
        else void exec.current("run");
      }}
    >
      <header className="iv-ide-top">
        <span className="iv-ide-where">
          {companyName} · {view.round.name}
        </span>
        <h1 className="iv-ide-title">{task.title}</h1>
        <span className={`iv-diff ${task.difficulty.toLowerCase()}`}>
          {task.difficulty}
        </span>
        <label className="sr-only" htmlFor="iv-lang">
          Language
        </label>
        <select
          id="iv-lang"
          className="iv-select"
          value="python"
          onChange={() => {}}
        >
          <option value="python">Python 3</option>
          <option value="java" disabled>
            Java (coming soon)
          </option>
        </select>
        <span className="iv-spacer" />
        <span className="iv-status-chip">
          {returning ? "Submitted" : "Coding question"}
          {view.question.mandatory ? " · Mandatory" : ""}
        </span>
        <span
          className="iv-timer mono"
          aria-label={`Time on this problem: ${elapsed(now - startedAt)}`}
        >
          {elapsed(now - startedAt)}
        </span>
        <button
          className="iv-btn ghost sm"
          aria-expanded={sideOpen}
          aria-controls="iv-ide-side"
          onClick={() => setSideOpen((o) => !o)}
        >
          {sideOpen ? "Hide interviewer" : "Show interviewer"}
        </button>
        <button
          className="iv-btn sm"
          onClick={() => setConfirm("exit")}
          disabled={busy}
        >
          Exit
        </button>
      </header>

      <aside className="iv-ide-problem" aria-label="Problem">
        <div className="iv-prose">
          <Markdown text={task.statement} />
          <p className="iv-sig mono">{sig}</p>
          {task.examples.map((ex, i) => (
            <div key={i} className="iv-example">
              <h3>Example {i + 1}</h3>
              <pre>
                <b>Input: </b>
                {params.map((p, j) => `${p} = ${py(ex.args[j])}`).join(", ")}
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
          {task.constraints.length > 0 && (
            <>
              <h3>Constraints</h3>
              <ul className="iv-constraints">
                {task.constraints.map((c) => (
                  <li key={c}>
                    <code>{c}</code>
                  </li>
                ))}
              </ul>
            </>
          )}
          {task.visibleTests.length > 0 && (
            <>
              <h3>Sample tests</h3>
              <ul className="iv-samples mono">
                {task.visibleTests.map((t, i) => (
                  <li key={i}>
                    {task.function.name}({t.args.map(py).join(", ")}) →{" "}
                    {py(t.expected)}
                  </li>
                ))}
              </ul>
            </>
          )}
          <p className="iv-muted iv-limits">
            Limits: {task.limits.timeMs.toLocaleString("en-IN")} ms ·{" "}
            {task.limits.memoryMb} MB. Hidden tests run on Submit.
          </p>
        </div>
      </aside>

      <section className="iv-ide-main">
        <div className="iv-ide-toolbar">
          <span className="iv-file mono">solution.py</span>
          <button
            className="iv-btn ghost sm"
            onClick={() => setConfirm("reset")}
            disabled={locked}
          >
            Reset
          </button>
          <span className="iv-spacer" />
          <button
            className="iv-btn sm"
            onClick={() => void exec.current("run")}
            disabled={locked}
            aria-busy={running === "run"}
            title="Run examples and sample tests (Ctrl+Enter)"
          >
            {running === "run" && (
              <span className="iv-spin sm" aria-hidden="true" />
            )}
            {running === "run" ? "Running…" : "Run"}
          </button>
          <button
            className="iv-btn primary sm"
            onClick={() => askSubmit.current()}
            disabled={locked}
            aria-busy={running === "submit"}
            title="Final submission: runs every test once, including hidden ones (Ctrl+Shift+Enter)"
          >
            {running === "submit" && (
              <span className="iv-spin sm dark" aria-hidden="true" />
            )}
            {running === "submit" ? "Submitting…" : "Submit"}
          </button>
        </div>

        <div className="iv-editor">
          <Editor
            language="python"
            theme="codelife-interview"
            defaultValue={initial}
            onChange={(v) => store.set(draftKey, v ?? "")}
            beforeMount={defineTheme}
            onMount={onMount}
            loading={
              <div className="iv-center-fill iv-muted">Loading editor…</div>
            }
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
              fixedOverflowWidgets: true,
              readOnly: returning !== null,
              ariaLabel: `${task.title} solution editor`,
            }}
          />
        </div>

        <div className="iv-out">
          <div className="iv-out-head">
            <div className="iv-tabs" role="tablist" aria-label="Output">
              {(["tests", "console"] as const).map((t) => (
                <button
                  key={t}
                  role="tab"
                  id={`iv-tab-${t}`}
                  aria-selected={tab === t}
                  aria-controls="iv-out-body"
                  className={tab === t ? "on" : ""}
                  onClick={() => setTab(t)}
                >
                  {t === "tests" ? "Tests" : "Console"}
                  {t === "tests" && shown && !shown.r.compileError && (
                    <span
                      className={`iv-count-pill ${shown.r.ok ? "ok" : "bad"}`}
                    >
                      {shown.r.passed}/{shown.r.total}
                    </span>
                  )}
                </button>
              ))}
            </div>
            <span className="iv-spacer" />
            {executor === "dev-subprocess" ? (
              <span
                className="iv-exec warn"
                title="Code runs as a plain local process. Fine for development, unsafe for real users."
              >
                DEV executor — not sandboxed
              </span>
            ) : executor ? (
              <span className="iv-exec">Executor: Judge0 sandbox</span>
            ) : null}
          </div>
          <div
            className="iv-out-body"
            id="iv-out-body"
            role="tabpanel"
            aria-labelledby={`iv-tab-${tab}`}
            aria-live="polite"
          >
            {error && (
              <div className="iv-alert" role="alert">
                <b>That didn't go through.</b> {error}
              </div>
            )}
            {busy ? (
              <p className="iv-busy">
                <span className="iv-spin sm" aria-hidden="true" />
                {running === "submit"
                  ? "Submitting: running every test, including hidden ones…"
                  : "Running examples and sample tests…"}
              </p>
            ) : !shown ? (
              !error && (
                <p className="iv-muted">
                  <b>Run</b> (<kbd>Ctrl</kbd>+<kbd>Enter</kbd>) checks the
                  examples and sample tests as often as you like. <b>Submit</b>{" "}
                  (<kbd>Ctrl</kbd>+<kbd>Shift</kbd>+<kbd>Enter</kbd>) runs every
                  test, including hidden ones, and hands the result to the
                  interviewer. You get one submission, so Run first.
                </p>
              )
            ) : tab === "tests" ? (
              <TestsView
                s={shown}
                params={params}
                returning={returning}
                onContinue={() => returning && onSubmitted(returning)}
              />
            ) : (
              <ConsoleView r={shown.r} />
            )}
          </div>
        </div>
      </section>

      <aside
        id="iv-ide-side"
        className="iv-ide-side"
        aria-label="Interviewer"
        hidden={!sideOpen}
      >
        <div className="iv-interviewer sm">
          <div className="iv-avatar sm" aria-hidden="true">
            {initials(view.interviewer.name)}
          </div>
          <div>
            <p className="iv-name">{view.interviewer.name}</p>
            <p className="iv-muted">{view.interviewer.title}</p>
          </div>
        </div>
        <div className="iv-side-log">
          {latest.length === 0 ? (
            <p className="iv-muted">No messages yet.</p>
          ) : (
            latest.map((m) => (
              <p key={m.id} className={`iv-side-msg ${m.speaker}`}>
                {m.text}
              </p>
            ))
          )}
        </div>
      </aside>

      {confirm === "exit" && (
        <Confirm
          title="Leave the editor?"
          confirmLabel="Back to the conversation"
          cancelLabel="Keep coding"
          onCancel={() => setConfirm(null)}
          onConfirm={() => {
            store.set(draftKey, code());
            onExit();
          }}
        >
          <p>
            Nothing is submitted. Your code is saved as a draft, and you can
            reopen the editor from the conversation.
          </p>
        </Confirm>
      )}
      {confirm === "submit" && (
        <Confirm
          title="Submit your final solution?"
          confirmLabel="Final submit"
          cancelLabel="Keep working"
          onCancel={() => setConfirm(null)}
          onConfirm={() => {
            setConfirm(null);
            void exec.current("submit");
          }}
        >
          <p>
            Final submission — you can't change it afterwards. Every test runs, including hidden
            ones, and the result goes to the interviewer. Run is still unlimited until then.
          </p>
        </Confirm>
      )}
      {confirm === "reset" && (
        <Confirm
          title="Reset to the starter code?"
          confirmLabel="Reset code"
          danger
          onCancel={() => setConfirm(null)}
          onConfirm={reset}
        >
          <p>Your current code for this problem will be replaced.</p>
        </Confirm>
      )}
    </div>
  );
}

function TestsView({
  s,
  params,
  returning,
  onContinue,
}: {
  s: Shown;
  params: string[];
  returning: InterviewView | null;
  onContinue: () => void;
}) {
  const v = verdict(s);
  const ms = s.r.results.reduce((sum, t) => sum + t.timeMs, 0);
  const firstFail = s.r.results.find((t) => !t.passed && t.kind !== "hidden");
  return (
    <>
      <div
        className={`iv-verdict ${v.ok ? "ok" : "bad"}${s.submit ? " big" : ""}`}
        role="status"
      >
        <div>
          <b>{v.title}</b>
          {!v.detail && s.r.total > 0 && (
            <p className="iv-muted">
              {s.r.passed}/{s.r.total} tests passed · {ms.toFixed(1)} ms ·{" "}
              {s.submit ? "Submitted" : "Ran"} at{" "}
              {new Date(s.at).toLocaleTimeString([], {
                hour: "2-digit",
                minute: "2-digit",
              })}
            </p>
          )}
          {!s.submit && v.ok && (
            <p className="iv-muted">
              Run only checks samples. Submit to run the hidden tests too.
            </p>
          )}
          {v.detail && <pre>{v.detail}</pre>}
        </div>
        {returning && (
          <div className="iv-verdict-actions">
            <span className="iv-muted">Returning to the interview…</span>
            <button className="iv-btn sm" onClick={onContinue} autoFocus>
              Continue now
            </button>
          </div>
        )}
      </div>
      <ul className="iv-results">
        {s.r.results.map((t, i) => (
          <li key={`${t.name}-${i}`} className={t.passed ? "ok" : "bad"}>
            {t.kind === "hidden" ? (
              <div className="iv-test-row">
                <Dot ok={t.passed} />
                <span className="iv-test-name">{t.name}</span>
                <span className="iv-hidden-tag">hidden</span>
                {t.error && <span className="iv-test-err">{t.error}</span>}
                <span className="iv-test-time">{t.timeMs.toFixed(1)} ms</span>
              </div>
            ) : (
              <details open={t === firstFail}>
                <summary className="iv-test-row">
                  <Dot ok={t.passed} />
                  <span className="iv-test-name">{t.name}</span>
                  <span className="iv-test-kind">{t.kind}</span>
                  <span className="iv-test-time">{t.timeMs.toFixed(1)} ms</span>
                </summary>
                <TestIO t={t} params={params} />
              </details>
            )}
          </li>
        ))}
      </ul>
    </>
  );
}

function TestIO({ t, params }: { t: TestResult; params: string[] }) {
  return (
    <dl className="iv-io mono">
      <dt>Input</dt>
      <dd>
        {(t.args ?? [])
          .map((a, i) => `${params[i] ?? `arg${i + 1}`} = ${py(a)}`)
          .join(", ")}
      </dd>
      <dt>Expected</dt>
      <dd>{py(t.expected)}</dd>
      <dt>{t.error ? "Error" : "Got"}</dt>
      <dd className={t.passed ? "" : "bad"}>{t.error ?? py(t.got)}</dd>
      {t.stdout && (
        <>
          <dt>Stdout</dt>
          <dd>
            <pre>{t.stdout}</pre>
          </dd>
        </>
      )}
    </dl>
  );
}

function ConsoleView({ r }: { r: RunResult }) {
  const out = r.results.filter((t) => t.stdout || t.error);
  return (
    <div className="iv-console mono">
      {r.compileError && <pre className="bad">{r.compileError}</pre>}
      {out.map((t, i) => (
        <div key={`${t.name}-${i}`}>
          <p className="iv-console-head">── {t.name} ──</p>
          {t.stdout && <pre>{t.stdout}</pre>}
          {t.error && <pre className="bad">{t.error}</pre>}
        </div>
      ))}
      {!out.length && !r.compileError && (
        <p className="iv-muted">
          Nothing printed. Output from print() appears here, per test.
        </p>
      )}
    </div>
  );
}

const Dot = ({ ok }: { ok: boolean }) => (
  <span
    className={`iv-dot ${ok ? "ok" : "bad"}`}
    role="img"
    aria-label={ok ? "passed" : "failed"}
  >
    {ok ? "✓" : "✕"}
  </span>
);
