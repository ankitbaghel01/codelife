"""Validate the problem bank and run every reference solution against its tests.

Usage: python scripts/check_problems.py
Stdlib only. Exits 1 on any failure.
"""

import ast
import json
import sys
import threading
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent / "content" / "problems"
# server-only interview bank: same schema, never bundled into the client
BANKS = [ROOT, ROOT.parent / "interview"]
sys.path.insert(0, str(ROOT.parent))
import harness  # noqa: E402  content/harness.py, the same file the browser runs

TIMEOUT_S = (
    5.0  # guard per test; generous vs limits.timeMs since this is a correctness check
)

REQUIRED = {
    "id": str,
    "version": int,
    "title": str,
    "tier": str,
    "difficulty": str,
    "folder": str,
    "topic": str,
    "tags": list,
    "languages": list,
    "statement": str,
    "function": dict,
    "constraints": list,
    "examples": list,
    "starter": dict,
    "visibleTests": list,
    "hiddenTests": list,
    "compare": str,
    "limits": dict,
    "hintsPolicy": dict,
    "hints": list,
    "followUps": list,
    "complexity": dict,
}
COMPARES = {"exact", "unordered", "float"}
FOLDERS = {
    "basics": {"arrays", "strings", "sorting", "searching", "merging", "math"},
    "data-structures": {
        "linked-list",
        "stack",
        "queue",
        "hash-map",
        "tree",
        "graph",
        "heap",
    },
    "interview-prep": {
        "two-pointers",
        "sliding-window",
        "recursion",
        "dynamic-programming",
        "mixed",
    },
}


def validate(p, path):
    errs = []
    for key, typ in REQUIRED.items():
        if key not in p:
            errs.append(f"missing field '{key}'")
        elif not isinstance(p[key], typ) or (typ is int and isinstance(p[key], bool)):
            errs.append(f"field '{key}' should be {typ.__name__}")
    if errs:
        return errs
    if path.stem != p["id"]:
        errs.append(f"file name {path.name} does not match id {p['id']}")
    if p["folder"] not in FOLDERS:
        errs.append(f"folder must be one of {sorted(FOLDERS)}")
    elif p["topic"] not in FOLDERS[p["folder"]]:
        errs.append(f"topic '{p['topic']}' is not in folder '{p['folder']}'")
    if p["compare"] not in COMPARES:
        errs.append(f"compare must be one of {sorted(COMPARES)}")
    if p["compare"] == "float" and not isinstance(p.get("tolerance"), (int, float)):
        errs.append("compare 'float' needs a numeric 'tolerance'")
    fn = p["function"]
    if (
        not isinstance(fn.get("name"), str)
        or not isinstance(fn.get("params"), list)
        or "returns" not in fn
    ):
        errs.append("function needs name, params[], returns")
        return errs
    if not all(
        isinstance(x, dict) and {"name", "type"} <= x.keys() for x in fn["params"]
    ):
        errs.append("function.params entries need name and type")
        return errs
    if not 2 <= len(p["visibleTests"]) <= 3:
        errs.append("visibleTests should have 2-3 cases")
    if not 5 <= len(p["hiddenTests"]) <= 8:
        errs.append("hiddenTests should have 5-8 cases")
    if len(p["hints"]) != 3:
        errs.append("hints should have exactly 3 entries")
    if not 1 <= len(p["followUps"]) <= 2:
        errs.append("followUps should have 1-2 entries")
    if not {"timeMs", "memoryMb"} <= p["limits"].keys():
        errs.append("limits needs timeMs and memoryMb")
    if not {"time", "space"} <= p["complexity"].keys():
        errs.append("complexity needs time and space")
    nparams = len(fn["params"])
    for group in ("examples", "visibleTests", "hiddenTests"):
        for i, t in enumerate(p[group]):
            if (
                not isinstance(t, dict)
                or not isinstance(t.get("args"), list)
                or "expected" not in t
            ):
                errs.append(f"{group}[{i}] needs args[] and expected")
            elif len(t["args"]) != nparams:
                errs.append(
                    f"{group}[{i}] has {len(t['args'])} args, function takes {nparams}"
                )
            elif group == "examples" and not isinstance(t.get("explanation"), str):
                errs.append(f"examples[{i}] needs an explanation")
    # starter must define the function with the declared params
    starter = p["starter"].get("python")
    if not isinstance(starter, str):
        errs.append("starter.python missing")
    else:
        try:
            tree = ast.parse(starter)
            defs = {n.name: n for n in tree.body if isinstance(n, ast.FunctionDef)}
            if fn["name"] not in defs:
                errs.append(f"starter does not define {fn['name']}")
            elif [a.arg for a in defs[fn["name"]].args.args] != [
                x["name"] for x in fn["params"]
            ]:
                errs.append("starter params do not match function.params")
        except SyntaxError as e:
            errs.append(f"starter has a syntax error: {e}")
    return errs


def run_reference(p, bank):
    """Run the reference solution through content/harness.py with which='all'."""
    path = bank / "solutions" / f"{p['id']}.py"
    if not path.exists():
        return None, f"missing solution {path.relative_to(ROOT.parent.parent)}"
    box = {}
    # guard thread lives here, not in the harness (the harness must stay Pyodide-safe)
    t = threading.Thread(
        target=lambda: box.update(
            r=harness.run_tests(path.read_text(encoding="utf-8"), p, "all")
        ),
        daemon=True,
    )
    t.start()
    t.join(
        TIMEOUT_S
        * (len(p["examples"]) + len(p["visibleTests"]) + len(p["hiddenTests"]))
    )
    if t.is_alive():
        sys.stdout = sys.__stdout__  # the hung run still holds the redirect
        return None, "timeout"
    return box["r"], None


def main():
    files = [f for bank in BANKS for f in sorted(bank.glob("*.json"))]
    for bank in BANKS:
        if not any(bank.glob("*.json")):
            print(f"No problem files in {bank}")
            return 1
    failures, seen, total_tests, counts = [], {}, 0, {}
    for path in files:
        try:
            p = json.loads(path.read_text(encoding="utf-8"))
        except (OSError, json.JSONDecodeError) as e:
            failures.append(f"{path.name}: invalid JSON: {e}")
            continue
        errs = (
            validate(p, path)
            if isinstance(p, dict)
            else ["top level must be an object"]
        )
        pid = p.get("id", path.stem) if isinstance(p, dict) else path.stem
        if pid in seen:
            errs.append(f"duplicate id (also in {seen[pid]})")
        seen[pid] = path.name
        if errs:
            failures += [f"{pid}: {e}" for e in errs]
            continue
        counts.setdefault(p["folder"], {}).setdefault(p["topic"], 0)
        counts[p["folder"]][p["topic"]] += 1
        starter = harness.run_tests(p["starter"]["python"], p, "visible")
        if starter["compileError"]:
            failures.append(f"{pid}: starter does not load: {starter['compileError']}")
        res, err = run_reference(p, path.parent)
        if err or res["compileError"]:
            failures.append(f"{pid}: {err or res['compileError']}")
            continue
        passed = 0
        for r in res["results"]:
            if r["passed"]:
                passed += 1
            else:
                failures.append(f"{pid}: {r['name']} {r['error'] or 'wrong answer'}")
        total_tests += len(res["results"])
        print(
            f"{'PASS' if passed == len(res['results']) else 'FAIL'}  {path.parent.name + '/' + pid:<44} {passed}/{len(res['results'])} tests"
        )

    print("\nProblems per folder/topic:")
    for folder in FOLDERS:
        topics = counts.get(folder, {})
        print(
            f"  {folder} ({sum(topics.values())}): "
            + ", ".join(f"{t} {n}" for t, n in sorted(topics.items()))
        )
    print(
        f"\n{len(files)} problem files, {total_tests} tests run, {len(failures)} failure(s)"
    )
    for f in failures:
        print(f"  - {f}")
    harness_fails = self_test_harness()
    for f in harness_fails:
        print(f"  - harness self-test: {f}")
    print(
        f"harness self-test: {'OK' if not harness_fails else f'{len(harness_fails)} failure(s)'}"
    )
    return 1 if failures or harness_fails else 0


def self_test_harness():
    """Feed the harness bad player code and check the result shapes."""
    fails = []

    def check(cond, msg):
        if not cond:
            fails.append(msg)

    prob = {
        "function": {
            "name": "add",
            "params": [{"name": "a", "type": "int"}, {"name": "b", "type": "int"}],
            "returns": "int",
        },
        "examples": [{"args": [1, 2], "expected": 3, "explanation": ""}],
        "visibleTests": [{"args": [2, 2], "expected": 4}],
        "hiddenTests": [
            {"args": [40, 2], "expected": 42},
            {"args": [-1, 1], "expected": 0},
        ],
        "compare": "exact",
    }
    keys = {
        "name",
        "kind",
        "passed",
        "args",
        "expected",
        "got",
        "error",
        "stdout",
        "timeMs",
    }

    def shaped(r, n):
        check(
            set(r) == {"ok", "compileError", "results"}, f"top-level keys {sorted(r)}"
        )
        check(len(r["results"]) == n, f"expected {n} results, got {len(r['results'])}")
        for x in r["results"]:
            check(set(x) == keys, f"result keys {sorted(x)}")
            check(
                isinstance(x["timeMs"], float) and isinstance(x["stdout"], str),
                "timeMs/stdout types",
            )
            if x["kind"] == "hidden":
                check(
                    x["args"] is None
                    and x["expected"] is None
                    and x["got"] is None
                    and x["stdout"] == "",
                    "hidden result leaks data",
                )
        json.dumps(r)  # must be plain JSON for postMessage

    r = harness.run_tests("def add(a, b):\n    return a +\n", prob, "all")
    shaped(r, 0)
    check(
        not r["ok"]
        and r["compileError"].startswith("SyntaxError")
        and "(line 2)" in r["compileError"],
        f"syntax error: {r['compileError']!r}",
    )

    r = harness.run_tests("def plus(a, b):\n    return a + b\n", prob, "all")
    shaped(r, 0)
    check(
        r["compileError"] == "Define a function named add",
        f"missing fn: {r['compileError']!r}",
    )

    r = harness.run_tests("x = 1\ndef add(a, b):\n    return a / 0\n", prob, "all")
    shaped(r, 4)
    check(
        not r["ok"] and r["compileError"] is None,
        "raising fn should not be a compile error",
    )
    check(
        r["results"][0]["error"] == "ZeroDivisionError: division by zero (line 3)",
        f"error text {r['results'][0]['error']!r}",
    )
    check(
        r["results"][-1]["error"] == "ZeroDivisionError (line 3)",
        "hidden error should drop the message",
    )

    r = harness.run_tests("def add(a, b):\n    return a - b\n", prob, "visible")
    shaped(r, 2)
    first = r["results"][0]
    check(
        not r["ok"]
        and first["got"] == -1
        and first["expected"] == 3
        and first["error"] is None,
        "wrong answer shape",
    )

    code = "print('loaded')\ndef add(a, b):\n    for i in range(5000):\n        print('step', i)\n    return a + b\n"
    r = harness.run_tests(code, prob, "all")
    shaped(r, 4)
    check(
        r["ok"] and all(x["passed"] for x in r["results"]),
        "print-heavy correct answer should pass",
    )
    out = r["results"][0]["stdout"]
    check(
        out.startswith("step 0\n") and out.endswith("(truncated)") and len(out) < 2100,
        "stdout not captured/truncated",
    )

    # structured types round-trip; a plain list is rejected where a ListNode is required
    ll = {
        "function": {
            "name": "f",
            "params": [{"name": "h", "type": "ListNode"}],
            "returns": "ListNode",
        },
        "examples": [],
        "visibleTests": [{"args": [[1, 2, 3]], "expected": [1, 2, 3]}],
        "hiddenTests": [],
        "compare": "exact",
    }
    check(
        harness.run_tests("def f(h):\n    return h\n", ll, "all")["ok"],
        "ListNode round-trip",
    )
    check(
        not harness.run_tests("def f(h):\n    return [1, 2, 3]\n", ll, "all")["ok"],
        "plain list accepted as ListNode",
    )
    tr = {
        "function": {
            "name": "f",
            "params": [{"name": "t", "type": "TreeNode"}],
            "returns": "TreeNode",
        },
        "examples": [],
        "visibleTests": [
            {"args": [[1, None, 2, 3]], "expected": [1, None, 2, 3]},
            {"args": [[]], "expected": []},
        ],
        "hiddenTests": [],
        "compare": "exact",
    }
    check(
        harness.run_tests("def f(t):\n    return t\n", tr, "all")["ok"],
        "TreeNode round-trip",
    )
    # run_inputs (server grading): outputs only, no expected values needed
    r = harness.run_inputs(
        "def add(a, b):\n    if a < 0:\n        raise ValueError('secret')\n    return a + b\n",
        prob["function"],
        [{"args": [1, 2], "hidden": False}, {"args": [-1, 1], "hidden": True}],
    )
    check(
        r["compileError"] is None
        and [o["got"] for o in r["outputs"]] == [3, None]
        and r["outputs"][1]["error"] == "ValueError (line 3)",
        f"run_inputs shape {r!r}",
    )
    check(
        harness.run_inputs("def plus(a, b): pass\n", prob["function"], [])[
            "compileError"
        ]
        == "Define a function named add",
        "run_inputs missing function",
    )
    json.dumps(r)
    return fails


if __name__ == "__main__":
    sys.exit(main())
