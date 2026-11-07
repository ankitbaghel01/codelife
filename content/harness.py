"""CodeLife test harness: runs player code against a problem's tests.

Stdlib only, and safe inside Pyodide in a Web Worker: no threads, subprocess,
signal or file IO. Timeouts are the caller's job (the browser kills the worker).

    run_tests(user_code, problem, which) -> {"ok", "compileError", "results"}
"""

import builtins
import copy
import io
import json
import math
import sys
import time
import traceback

USER_FILE = "<solution>"
MAX_TEXT = 2000
MAX_NODES = (
    100_000  # longer than any test; a longer chain means the player built a cycle
)


class ListNode:
    def __init__(self, val=0, next=None):
        self.val = val
        self.next = next

    def __repr__(self):
        return f"ListNode({self.val})"


class TreeNode:
    def __init__(self, val=0, left=None, right=None):
        self.val = val
        self.left = left
        self.right = right

    def __repr__(self):
        return f"TreeNode({self.val})"


def _clip(s):
    return s if len(s) <= MAX_TEXT else s[:MAX_TEXT] + "... (truncated)"


# ---------- structured type conversion ----------


def _to_list_node(values):
    head = None
    for v in reversed(values or []):
        head = ListNode(v, head)
    return head


def _from_list_node(node):
    out = []
    while node is not None:
        if not (hasattr(node, "val") and hasattr(node, "next")):
            raise TypeError(f"expected a ListNode, got {type(node).__name__}")
        if len(out) >= MAX_NODES:
            raise ValueError("returned list never ends (is there a cycle?)")
        out.append(node.val)
        node = node.next
    return out


def _to_tree_node(values):
    if not values or values[0] is None:
        return None
    root = TreeNode(values[0])
    queue, i = [root], 1
    for node in queue:  # queue grows while we iterate
        for side in ("left", "right"):
            if i < len(values) and values[i] is not None:
                child = TreeNode(values[i])
                setattr(node, side, child)
                queue.append(child)
            i += 1
        if i >= len(values):
            break
    return root


def _from_tree_node(root):
    out, queue = [], [root]
    for node in queue:
        if len(out) >= MAX_NODES:
            raise ValueError("returned tree is too large (is there a cycle?)")
        if node is None:
            out.append(None)
            continue
        if not all(hasattr(node, a) for a in ("val", "left", "right")):
            raise TypeError(f"expected a TreeNode, got {type(node).__name__}")
        out.append(node.val)
        queue += [node.left, node.right]
    while out and out[-1] is None:
        out.pop()
    return out


_IN = {"ListNode": _to_list_node, "TreeNode": _to_tree_node}
_OUT = {"ListNode": _from_list_node, "TreeNode": _from_tree_node}


def _jsonable(v):
    """Plain JSON value (tuples -> lists); falls back to repr for anything else."""
    try:
        return json.loads(json.dumps(v))
    except (TypeError, ValueError):
        return repr(v)


# ---------- comparison ----------


def _key(v):
    return json.dumps(v, sort_keys=True)


def _same(got, expected, mode, tol):
    if mode == "unordered":  # top level only: inner order is fixed by the statement
        return (
            isinstance(got, list)
            and isinstance(expected, list)
            and sorted(map(_key, got)) == sorted(map(_key, expected))
        )
    if mode == "float":
        if isinstance(expected, list):
            return (
                isinstance(got, list)
                and len(got) == len(expected)
                and all(_same(g, e, mode, tol) for g, e in zip(got, expected))
            )
        if isinstance(expected, (int, float)) and not isinstance(expected, bool):
            return (
                isinstance(got, (int, float))
                and not isinstance(got, bool)
                and math.isclose(got, expected, abs_tol=tol, rel_tol=0)
            )
    return _key(got) == _key(expected)  # exact: JSON round-trip, so True != 1


# ---------- errors ----------


def _user_line(tb):
    line = None
    for frame in traceback.extract_tb(tb):
        if frame.filename == USER_FILE:
            line = frame.lineno
    return line


def _describe(e, with_message=True):
    head = f"{type(e).__name__}: {e}" if with_message and str(e) else type(e).__name__
    line = _user_line(e.__traceback__)
    return _clip(f"{head} (line {line})" if line else head)


def _syntax_error(e, code):
    lines = code.splitlines()
    msg = f"{type(e).__name__}: {e.msg} (line {e.lineno})"
    if e.lineno and 1 <= e.lineno <= len(lines):
        src = lines[e.lineno - 1]
        msg += "\n    " + src.strip()
        if e.offset:
            pad = max(0, e.offset - 1 - (len(src) - len(src.lstrip())))
            msg += "\n    " + " " * pad + "^"
    return _clip(msg)


# ---------- main entry ----------


def run_tests(user_code, problem, which):
    fn = problem["function"]
    fname = fn["name"]
    in_types = [p.get("type") for p in fn["params"]]
    out_type = fn.get("returns")

    def fail(msg):
        return {"ok": False, "compileError": msg, "results": []}

    try:
        code_obj = compile(user_code, USER_FILE, "exec")
    except (SyntaxError, ValueError) as e:  # ValueError: null bytes in source
        return fail(
            _syntax_error(e, user_code) if isinstance(e, SyntaxError) else _clip(str(e))
        )

    ns = {
        "__name__": "__solution__",
        "__builtins__": builtins,
        "ListNode": ListNode,
        "TreeNode": TreeNode,
    }
    real_stdout = sys.stdout
    sys.stdout = io.StringIO()  # module-level prints are discarded
    try:
        exec(code_obj, ns)
    except (Exception, SystemExit) as e:
        return fail(_describe(e))
    finally:
        sys.stdout = real_stdout
    func = ns.get(fname)
    if not callable(func):
        return fail(f"Define a function named {fname}")

    groups = [
        ("example", "Example", problem.get("examples", [])),
        ("visible", "Test", problem.get("visibleTests", [])),
    ]
    if which == "all":
        groups.append(("hidden", "Hidden test", problem.get("hiddenTests", [])))
    mode, tol = problem.get("compare", "exact"), problem.get("tolerance", 0)

    results = []
    for kind, label, tests in groups:
        for i, t in enumerate(tests, 1):
            hidden = kind == "hidden"
            buf = io.StringIO()
            got, error, passed = None, None, False
            args = [
                _IN[ty](copy.deepcopy(a)) if ty in _IN else copy.deepcopy(a)
                for a, ty in zip(t["args"], in_types)
            ]
            sys.stdout = buf
            start = time.perf_counter()
            try:
                raw = func(*args)
            except (Exception, SystemExit) as e:
                raw, error = None, _describe(e, with_message=not hidden)
            finally:
                elapsed = (time.perf_counter() - start) * 1000
                sys.stdout = real_stdout
            if error is None:
                try:
                    got = _OUT[out_type](raw) if out_type in _OUT else _jsonable(raw)
                    passed = _same(got, t["expected"], mode, tol)
                except (TypeError, ValueError) as e:
                    error = _clip(f"{type(e).__name__}: {e}")
            results.append(
                {
                    "name": f"{label} {i}",
                    "kind": kind,
                    "passed": passed,
                    # hidden data never leaves the harness: no args/expected/got/stdout,
                    # and exception messages are reduced to type + line
                    "args": None if hidden else copy.deepcopy(t["args"]),
                    "expected": None if hidden else t["expected"],
                    "got": None if hidden else _jsonable(got),
                    "error": error,
                    "stdout": "" if hidden else _clip(buf.getvalue()),
                    "timeMs": round(elapsed, 3),
                }
            )
    return {
        "ok": all(r["passed"] for r in results),
        "compileError": None,
        "results": results,
    }
