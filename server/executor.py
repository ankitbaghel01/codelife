"""Code execution adapters. Player code NEVER runs inside the API process.

Both executors run ONE self-contained Python program: content/harness.py + the
test INPUTS + the player's code. It prints only what the code returned (via
harness.run_inputs) after a per-request nonce marker line. Expected outputs and
the compare rule never leave the server: grade() compares here, so a program
that prints a fake "all passed" result gains nothing.
"""

import importlib.util
import json
import logging
import os
import secrets
import subprocess
import sys
import tempfile
import threading
from pathlib import Path

import httpx

log = logging.getLogger("codelife.executor")
HARNESS_PATH = Path(__file__).resolve().parent.parent / "content" / "harness.py"
HARNESS = HARNESS_PATH.read_text(encoding="utf-8")
_spec = importlib.util.spec_from_file_location("codelife_harness", HARNESS_PATH)
harness = importlib.util.module_from_spec(_spec)
_spec.loader.exec_module(harness)  # trusted file; used only for its comparison logic
MAX_OUTPUT = 1_000_000  # bytes of stdout we accept from a run
MAX_TEXT = 2000


def _tests(problem: dict, which: str) -> list[tuple[str, str, dict]]:
    """(name, kind, test) for each test a run ("visible") or submit ("all") covers."""
    groups = [
        ("example", "Example", problem.get("examples", [])),
        ("visible", "Test", problem.get("visibleTests", [])),
    ]
    if which == "all":
        groups.append(("hidden", "Hidden test", problem.get("hiddenTests", [])))
    return [
        (f"{label} {i}", kind, t)
        for kind, label, tests in groups
        for i, t in enumerate(tests, 1)
    ]


def build_program(problem: dict, code: str, which: str) -> tuple[str, str]:
    """Return (program source, marker line). Only args, param/return types and hidden flags go in."""
    function = {
        "name": problem["function"]["name"],
        "params": [
            {"name": x["name"], "type": x.get("type")}
            for x in problem["function"]["params"]
        ],
        "returns": problem["function"].get("returns"),
    }
    cases = [
        {"args": t["args"], "hidden": kind == "hidden"}
        for _, kind, t in _tests(problem, which)
    ]
    marker = f"<<CODELIFE:{secrets.token_hex(16)}>>"
    runner = [
        "# ---- CodeLife runner (inputs only) ----",
        f"_FUNCTION = json.loads({json.dumps(json.dumps(function))})",
        f"_CASES = json.loads({json.dumps(json.dumps(cases))})",
        f"_CODE = {code!r}",
        "_OUTPUT = run_inputs(_CODE, _FUNCTION, _CASES)",
        f"sys.__stdout__.write(chr(10) + {marker!r} + chr(10) + json.dumps(_OUTPUT) + chr(10))",
        "sys.__stdout__.flush()",
    ]
    program = HARNESS + "\n\n" + "\n".join(runner) + "\n"
    return program, marker


def parse_output(stdout: str, marker: str) -> dict | None:
    """JSON after the single marker line; None (= runtime error) if the marker is missing,
    appears more than once, or what follows isn't the expected shape."""
    if stdout.count(marker) != 1:
        return None
    lines = stdout.splitlines()
    if marker not in lines:
        return None
    try:
        raw = json.loads("\n".join(lines[lines.index(marker) + 1 :]))
    except ValueError:
        return None
    ok = (
        isinstance(raw, dict)
        and isinstance(raw.get("compileError"), (str, type(None)))
        and isinstance(raw.get("outputs"), list)
        and all(isinstance(o, dict) for o in raw["outputs"])
    )
    return raw if ok else None


def _text(v) -> str:
    v = v if isinstance(v, str) else ""
    return v if len(v) <= MAX_TEXT else v[:MAX_TEXT] + "... (truncated)"


def _result(
    problem: dict, which: str, executor: str, results: list, compile_error=None
) -> dict:
    passed = sum(r["passed"] for r in results)
    total = len(_tests(problem, which))
    return {
        "ok": not compile_error and total > 0 and passed == total,
        "compileError": compile_error,
        "results": results,
        "executor": executor,
        "passed": passed,
        "total": total,
    }


def failed(problem: dict, which: str, executor: str, error: str) -> dict:
    """Every test failed with one error (time limit, crash): pass rate is 0, not undefined."""
    results = [
        {
            "name": n,
            "kind": k,
            "passed": False,
            "args": None,
            "expected": None,
            "got": None,
            "error": error,
            "stdout": "",
            "timeMs": 0.0,
        }
        for n, k, _ in _tests(problem, which)
    ]
    return _result(problem, which, executor, results)


def grade(raw: dict, problem: dict, which: str, executor: str) -> dict:
    """Compare the program's outputs with the expected values HERE and build TestResults."""
    if raw.get("compileError"):
        return _result(problem, which, executor, [], _text(raw["compileError"]))
    tests = _tests(problem, which)
    outputs = raw.get("outputs", [])
    if len(outputs) != len(tests):
        return failed(problem, which, executor, "Runtime error (incomplete output)")
    mode, tol = problem.get("compare", "exact"), problem.get("tolerance", 0)
    results = []
    for (name, kind, t), o in zip(tests, outputs):
        error = _text(o.get("error"))[:500] or None
        got = o.get("got")
        try:
            passed = error is None and harness._same(got, t["expected"], mode, tol)
        except Exception:  # odd shapes from a misbehaving program just fail
            passed = False
        time_ms = o.get("timeMs")
        r = {
            "name": name,
            "kind": kind,
            "passed": bool(passed),
            "args": t["args"],
            "expected": t["expected"],
            "got": got,
            "error": error,
            "stdout": _text(o.get("stdout")),
            "timeMs": float(time_ms)
            if isinstance(time_ms, (int, float)) and not isinstance(time_ms, bool)
            else 0.0,
        }
        if kind == "hidden":  # hidden data never leaves the server
            r.update(
                args=None,
                expected=None,
                got=None,
                stdout="",
                error=error.split(":", 1)[0][:200] if error else None,
            )
        results.append(r)
    return _result(problem, which, executor, results)


def _timeout_s(problem: dict, which: str) -> float:
    n = max(1, len(_tests(problem, which)))
    return min(20.0, max(5.0, problem.get("limits", {}).get("timeMs", 2000) * n / 1000))


class DevSubprocessExecutor:
    """DEV ONLY. Runs `python -I` in a temp dir with a timeout and a minimal env.

    It is NOT a sandbox: no memory limit, no network or filesystem isolation.
    Use Judge0 (JUDGE0_URL) for anything other people can reach.
    """

    name = "dev-subprocess"

    def run(self, problem: dict, code: str, which: str) -> dict:
        program, marker = build_program(problem, code, which)
        timeout = _timeout_s(problem, which)
        log.warning(
            "DEV ONLY executor: running player code in a local subprocess (no sandbox)"
        )
        env = {"PYTHONIOENCODING": "utf-8", "PYTHONDONTWRITEBYTECODE": "1"}
        if os.environ.get("SYSTEMROOT"):  # Windows needs it for os.urandom/hash seeding
            env["SYSTEMROOT"] = os.environ["SYSTEMROOT"]
        with tempfile.TemporaryDirectory(prefix="codelife-run-") as tmp:
            src = Path(tmp) / "main.py"
            src.write_text(program, encoding="utf-8")
            proc = subprocess.Popen(
                [sys.executable, "-I", "-S", str(src)],
                cwd=tmp,
                env=env,
                stdin=subprocess.DEVNULL,
                stdout=subprocess.PIPE,
                stderr=subprocess.DEVNULL,
            )
            chunks, size, overflow = [], 0, threading.Event()

            def reader():
                nonlocal size
                while block := proc.stdout.read(65536):
                    size += len(block)
                    if size > MAX_OUTPUT:
                        overflow.set()
                        proc.kill()
                        return
                    chunks.append(block)

            t = threading.Thread(target=reader, daemon=True)
            t.start()
            try:
                proc.wait(timeout=timeout)
            except subprocess.TimeoutExpired:
                proc.kill()
                proc.wait()
                t.join(2)
                return failed(
                    problem, which, self.name, f"Time limit exceeded ({timeout:g}s)"
                )
            t.join(2)
        if overflow.is_set():
            return failed(problem, which, self.name, "Output limit exceeded")
        raw = parse_output(b"".join(chunks).decode("utf-8", "replace"), marker)
        if raw is None:
            return failed(
                problem,
                which,
                self.name,
                f"Runtime error (exit code {proc.returncode})",
            )
        return grade(raw, problem, which, self.name)


class Judge0Executor:
    """Judge0 CE (self-hosted on a separate Linux VM, or RapidAPI)."""

    name = "judge0"

    def __init__(self, url: str, key: str | None = None, language_id: int = 71):
        self.url = url.rstrip("/")
        self.key = key
        self.language_id = language_id  # 71 = Python 3.8 on stock Judge0 CE

    def run(self, problem: dict, code: str, which: str) -> dict:
        program, marker = build_program(problem, code, which)
        timeout = _timeout_s(problem, which)
        headers = {"X-Auth-Token": self.key} if self.key else {}
        body = {
            "source_code": program,
            "language_id": self.language_id,
            "cpu_time_limit": timeout,
            "wall_time_limit": timeout + 2,
            "memory_limit": int(problem.get("limits", {}).get("memoryMb", 128)) * 1024,
        }
        try:
            resp = httpx.post(
                f"{self.url}/submissions",
                params={"base64_encoded": "false", "wait": "true"},
                json=body,
                headers=headers,
                timeout=timeout + 15,
            )
            resp.raise_for_status()
            data = resp.json()
        except (httpx.HTTPError, ValueError) as e:
            log.error("judge0 request failed: %s", type(e).__name__)
            return failed(
                problem, which, self.name, "Code runner unavailable, please try again"
            )
        status = (data.get("status") or {}).get("id")
        if status == 5:
            return failed(
                problem, which, self.name, f"Time limit exceeded ({timeout:g}s)"
            )
        if status == 6:
            compile_error = (data.get("compile_output") or "Compilation error")[:2000]
            return grade(
                {"compileError": compile_error, "outputs": []},
                problem,
                which,
                self.name,
            )
        raw = parse_output(data.get("stdout") or "", marker)
        if raw is None:
            desc = (data.get("status") or {}).get("description", "Runtime error")
            return failed(problem, which, self.name, desc)
        return grade(raw, problem, which, self.name)


def from_env():
    url = os.environ.get("JUDGE0_URL")
    if url:
        return Judge0Executor(
            url,
            os.environ.get("JUDGE0_KEY"),
            int(os.environ.get("JUDGE0_LANGUAGE_ID", "71")),
        )
    return DevSubprocessExecutor()
