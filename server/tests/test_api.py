import json
import math

from fastapi.testclient import TestClient

from server import ai, executor, interview, main

from .conftest import H, PLAYER, PROFILE, play, start


def test_health(client):
    assert client.get("/api/health").json() == {
        "ok": True,
        "aiProvider": "scripted",
        "executor": "dev-subprocess",
    }


def test_happy_path_selected(client):
    view = start(client)
    assert view["status"] == "in_progress" and view["question"] == {
        "index": 0,
        "total": 6,
        "kind": "intro",
        "mandatory": True,
    }
    assert (
        view["messages"][0]["speaker"] == "interviewer"
        and "Arjun Mehta" in view["messages"][0]["text"]
    )
    end = play(client, view)
    assert end["status"] == "in_progress" and end["question"]["kind"] == "done"
    ev = client.post(f"/api/interviews/{view['id']}/finish", headers=H).json()
    assert ev["decision"] == "selected", ev["reasons"]
    assert ev["scores"]["coding"] == 1.0 and ev["scores"]["concept"] >= 0.5
    assert ev["offer"]["joinInDays"] == 2 and ev["offer"]["monthlySalary"] == 26000
    coding = next(q for q in ev["questions"] if q["kind"] == "coding")["coding"]
    assert (
        coding["referenceSolution"] and coding["code"] and coding["complexity"]["time"]
    )
    assert ev["revise"] == []
    # idempotent, and the report matches
    assert client.post(f"/api/interviews/{view['id']}/finish", headers=H).json() == ev
    assert client.get(f"/api/interviews/{view['id']}/report", headers=H).json() == ev
    assert (
        client.get(f"/api/interviews/{view['id']}", headers=H).json()["status"]
        == "completed"
    )
    assert (
        client.post(
            f"/api/interviews/{view['id']}/answer", headers=H, json={"text": "hi"}
        ).status_code
        == 409
    )


class PerfectAI(ai.ScriptedInterviewer):
    def score(self, *a, **k):
        return 1.0, "Perfect."


def test_wrong_code_rejected_even_if_ai_scores_everything_perfect(client, monkeypatch):
    monkeypatch.setattr(main.Services, "ai", PerfectAI())
    view = start(client)
    play(
        client,
        view,
        code_for=lambda task: task["starter"]["python"],
    )
    ev = client.post(f"/api/interviews/{view['id']}/finish", headers=H).json()
    assert ev["scores"]["concept"] == 1.0 and ev["scores"]["coding"] == 0.0
    assert ev["decision"] == "rejected" and ev["offer"] is None
    assert any("Coding" in r and "Below the bar" in r for r in ev["reasons"])
    assert ev["revise"]  # the problem's topic


def test_mandatory_questions_cannot_be_skipped(client):
    view = start(client)
    iid = view["id"]
    assert (
        client.post(
            f"/api/interviews/{iid}/answer", headers=H, json={"text": "   "}
        ).status_code
        == 422
    )
    assert client.post(f"/api/interviews/{iid}/finish", headers=H).status_code == 409
    assert client.get(f"/api/interviews/{iid}/report", headers=H).status_code == 409
    # walk to the coding question; a mandatory coding question can't be skipped either
    for _ in range(3):
        view = client.post(
            f"/api/interviews/{iid}/answer",
            headers=H,
            json={"text": "Some honest answer with enough words in it."},
        ).json()
    assert view["status"] == "coding" and view["coding"]
    assert (
        client.post(
            f"/api/interviews/{iid}/answer", headers=H, json={"text": ""}
        ).status_code
        == 422
    )
    # explaining the approach is fine but doesn't close the question
    view = client.post(
        f"/api/interviews/{iid}/answer", headers=H, json={"text": "I'll use a loop."}
    ).json()
    assert view["status"] == "coding"
    assert client.post(f"/api/interviews/{iid}/finish", headers=H).status_code == 409
    q = view["coding"]
    client.post(
        f"/api/interviews/{iid}/submit",
        headers=H,
        json={
            "questionId": q["questionId"],
            "code": interview.solution(q["problemId"]),
        },
    )
    # second submit for the same question is refused
    assert (
        client.post(
            f"/api/interviews/{iid}/submit",
            headers=H,
            json={"questionId": q["questionId"], "code": "x"},
        ).status_code
        == 409
    )
    # the complexity question here is optional: an empty answer skips it
    view = client.post(
        f"/api/interviews/{iid}/answer", headers=H, json={"text": ""}
    ).json()
    assert view["question"]["kind"] == "hr"
    assert (
        client.post(f"/api/interviews/{iid}/finish", headers=H).status_code == 409
    )  # hr still mandatory


def test_hidden_test_data_never_in_responses(client):
    view = start(client, "rupiya", "sde1")  # two coding questions
    log = [json.dumps(view)]
    used = []
    # player code that tries to print its inputs and leak them via errors
    spy = "def {name}(*args):\n    print('ARGS', args)\n    raise ValueError(repr(args))\n"

    def code_for(task):
        used.append(task["problemId"])
        code = spy.format(name=task["function"]["name"])
        r = client.post(
            f"/api/interviews/{view['id']}/run",
            headers=H,
            json={"questionId": task["questionId"], "code": code},
        )
        assert r.status_code == 200 and all(
            t["kind"] != "hidden" for t in r.json()["results"]
        )
        log.append(r.text)
        return code

    play(client, view, code_for=code_for, log=log)
    log.append(client.get(f"/api/interviews/{view['id']}", headers=H).text)
    before_finish = "\n".join(log)
    log.append(client.post(f"/api/interviews/{view['id']}/finish", headers=H).text)
    text = "\n".join(log)
    assert len(used) == 2
    assert '"hiddenTests"' not in text and '"hints"' not in text
    for pid in used:
        p = interview.problems()[pid]
        public = json.dumps(p["examples"]) + json.dumps(p["visibleTests"])
        assert (
            interview.solution(pid).strip() not in before_finish
        )  # reference only after completion
        for t in p["hiddenTests"]:
            for value in (
                json.dumps(t["args"]),
                repr(tuple(t["args"])),
                json.dumps(t["expected"]),
            ):
                if len(value) >= 8 and value not in public:
                    assert value not in text, (pid, value)


class FakeResp:
    def __init__(self, parsed, stop_reason="end_turn"):
        self.parsed_output, self.stop_reason = parsed, stop_reason


class FakeClient:
    def __init__(self, behaviour):
        self.behaviour = behaviour
        self.messages = self

    def parse(self, **kw):
        b = self.behaviour(kw["output_format"])
        if isinstance(b, Exception):
            raise b
        return b


def test_malformed_ai_output_falls_back():
    scripted = ai.ScriptedInterviewer()
    kp = [{"point": "Mentions a stack", "keywords": ["stack"]}]
    answer = "I would use a stack to keep the open brackets in order here."
    cases = [
        lambda schema: RuntimeError("network down"),
        lambda schema: FakeResp(None),
        lambda schema: FakeResp("not a model"),
        lambda schema: FakeResp(
            schema.model_construct(score=math.nan, feedback="x", text="")
        ),
        lambda schema: FakeResp(
            schema.model_construct(score=0.9, feedback="ok", text="hi"),
            stop_reason="refusal",
        ),
    ]
    for behaviour in cases:
        c = ai.ClaudeInterviewer(client=FakeClient(behaviour), model="test")
        assert c.score("concept", "q", answer, kp) == scripted.score(
            "concept", "q", answer, kp
        )
        assert c.speak({"persona": "Calm"}, "Next question?") == scripted.speak(
            {"persona": "Calm"}, "Next question?"
        )
    # valid output is used, and out-of-range scores are clamped
    good = ai.ClaudeInterviewer(
        client=FakeClient(
            lambda s: FakeResp(
                s(score=7, feedback="Great.")
                if s is ai.RubricScore
                else s(text="Hello there.")
            )
        ),
        model="test",
    )
    assert good.score("concept", "q", answer, kp) == (1.0, "Great.")
    assert good.speak({}, "draft") == "Hello there."


def test_api_survives_broken_ai(client, monkeypatch):
    monkeypatch.setattr(
        main.Services,
        "ai",
        ai.ClaudeInterviewer(
            client=FakeClient(lambda s: ValueError("garbage")), model="test"
        ),
    )
    view = start(client)
    assert view["aiProvider"] == "claude" and view["messages"]
    view = client.post(
        f"/api/interviews/{view['id']}/answer",
        headers=H,
        json={"text": "I studied engineering and built a project with Python."},
    ).json()
    assert view["question"]["kind"] == "resume"


def test_infinite_loop_reports_time_limit():
    p = dict(
        interview.problems()["iv-t1-running-balance"],
        limits={"timeMs": 10, "memoryMb": 128},
    )
    res = executor.DevSubprocessExecutor().run(
        p,
        "def running_balance(start, changes):\n    while True:\n        pass\n",
        "all",
    )
    assert res["ok"] is False and res["passed"] == 0 and res["total"] == 10
    assert all(r["error"].startswith("Time limit exceeded") for r in res["results"])
    assert res["executor"] == "dev-subprocess"


FORGER = """
import os, re, sys
_src = open(sys.argv[0], encoding="utf-8").read()
_marker = re.findall(r"<<CODELIFE:[0-9a-f]{32}>>", _src)[0]
# old-style fake result, then a fake marker + 'outputs' claiming success
print('{"ok": true, "compileError": null, "results": []}')
sys.__stdout__.write(_marker + chr(10) + '{"compileError": null, "outputs": ' + str([{"got": [], "error": None, "stdout": "", "timeMs": 1}] * 10).replace("None", "null").replace("'", '"') + '}' + chr(10))
sys.__stdout__.flush()
EXIT_NOW = %s
if EXIT_NOW:
    os._exit(0)  # so the real runner never prints

def running_balance(start, changes):
    return []
"""


def test_forged_results_still_fail():
    p = interview.problems()["iv-t1-running-balance"]
    ex = executor.DevSubprocessExecutor()
    # marker forged and the real runner killed: the server still compares got vs expected
    res = ex.run(p, FORGER % "True", "all")
    assert not res["ok"] and res["passed"] < res["total"] == 10
    # forged marker plus the real one: marker appears twice -> runtime error, nothing passes
    res = ex.run(p, FORGER % "False", "all")
    assert res["passed"] == 0 and res["results"][0]["error"].startswith("Runtime error")
    # printing an old-style "all passed" blob without the nonce is simply ignored
    res = ex.run(
        p,
        'print(\'{"ok": true, "results": []}\')\ndef running_balance(s, c):\n    return []\n',
        "all",
    )
    assert not res["ok"] and res["passed"] < res["total"]


def test_program_contains_no_expected_values():
    for pid, p in interview.problems().items():
        for which in ("visible", "all"):
            program, marker = executor.build_program(p, "def f(): pass\n", which)
            assert program.startswith(executor.HARNESS)
            runner = program[len(executor.HARNESS) :]
            assert (
                "expected" not in runner
                and "compare" not in runner
                and "tolerance" not in runner
            )
            cases = json.loads(
                json.loads(
                    runner.split("_CASES = json.loads(", 1)[1].split(")\n", 1)[0]
                )
            )
            assert all(set(c) == {"args", "hidden"} for c in cases)
            assert sum(c["hidden"] for c in cases) == (
                len(p["hiddenTests"]) if which == "all" else 0
            )
            args_text = json.dumps([c["args"] for c in cases])
            for t in p["hiddenTests"]:
                value = json.dumps(t["expected"])
                if len(value) >= 6 and value not in args_text:
                    assert value not in program, (pid, value)


def test_state_restored_after_refresh(client):
    view = start(client)
    iid = view["id"]
    for _ in range(3):
        view = client.post(
            f"/api/interviews/{iid}/answer",
            headers=H,
            json={"text": "A reasonable answer with enough words to count."},
        ).json()
    with TestClient(main.app) as fresh:  # "refresh": new client, state only from sqlite
        restored = fresh.get(f"/api/interviews/{iid}", headers=H).json()
    assert restored == view
    assert restored["status"] == "coding" and restored["coding"]["questionId"] == "q3"
    assert "hiddenTests" not in restored["coding"]


def test_wrong_player_forbidden(client):
    view = start(client)
    iid = view["id"]
    assert (
        client.get(
            f"/api/interviews/{iid}", headers={"X-Player-Id": "someone-else"}
        ).status_code
        == 403
    )
    assert (
        client.post(
            f"/api/interviews/{iid}/answer",
            headers={"X-Player-Id": "x"},
            json={"text": "hi"},
        ).status_code
        == 403
    )
    assert (
        client.post(
            f"/api/interviews/{iid}/finish", headers={"X-Player-Id": "x"}
        ).status_code
        == 403
    )
    assert client.get(f"/api/interviews/{iid}").status_code == 422  # header missing
    assert client.get("/api/interviews/nope", headers=H).status_code == 404


def test_input_validation(client):
    body = {
        "playerId": PLAYER,
        "companyId": "sutradhar",
        "roleId": "jr-web",
        "profile": PROFILE,
    }
    assert (
        client.post("/api/interviews", json={**body, "roleId": "ceo"}).status_code
        == 404
    )
    big = {**PROFILE, "name": "x" * 500}
    r = client.post("/api/interviews", json={**body, "profile": big})
    assert r.status_code == 422 and isinstance(r.json()["detail"], str)
    iid = start(client)["id"]
    assert (
        client.post(
            f"/api/interviews/{iid}/answer", headers=H, json={"text": "a" * 2001}
        ).status_code
        == 422
    )
    assert (
        client.post(
            f"/api/interviews/{iid}/run",
            headers=H,
            json={"questionId": "q3", "code": "a" * 20_001},
        ).status_code
        == 422
    )
    assert (
        client.post(
            f"/api/interviews/{iid}/run",
            headers=H,
            json={"questionId": "q3", "code": "x=1"},
        ).status_code
        == 409
    )  # not open yet
