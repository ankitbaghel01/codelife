import json

import pytest
from fastapi.testclient import TestClient

from server import ai, db, executor, interview, main

PLAYER = "player-1"
H = {"X-Player-Id": PLAYER}
PROFILE = {
    "name": "Ankit",
    "skills": [
        {"name": "Python", "proficiency": 40, "source": "start"},
        {"name": "JavaScript", "proficiency": 30, "source": "start"},
        {"name": "React", "proficiency": 0, "source": "claimed"},
    ],
    "resume": {
        "summary": "CS student",
        "projects": [{"name": "Todo app", "description": "A small todo app"}],
    },
}


@pytest.fixture
def client(tmp_path, monkeypatch):
    monkeypatch.setattr(db, "PATH", tmp_path / "test.db")
    monkeypatch.setattr(main.Services, "ai", ai.ScriptedInterviewer())
    monkeypatch.setattr(main.Services, "executor", executor.DevSubprocessExecutor())
    with TestClient(main.app) as c:
        yield c


def all_concept_keywords() -> str:
    return " ".join(
        k
        for bank in interview.concepts().values()
        for c in bank
        for kp in c["keyPoints"]
        for k in kp["keywords"]
    )


def good_answer(view: dict, problem_id: str | None) -> str:
    kind = view["question"]["kind"]
    if kind == "intro":
        return "I studied computer engineering at college, I know Python and JavaScript, I built a todo project, and my goal is to grow as a developer."
    if kind == "resume":
        return "I used React in a small project where I built a todo page; the hard part was a state bug that I fixed. Honestly I'm still a beginner and learning."
    if kind == "concept":
        return all_concept_keywords()
    if kind == "complexity":
        cx = interview.problems()[problem_id]["complexity"]
        return f"The time complexity is {cx['time']} and the space complexity is {cx['space']} because each element is handled a constant number of times."
    return "I want to join because your product helps clinics and users; my strength is problem solving, for example when I fixed a bug in my project."


def start(client, company="sutradhar", role="jr-web"):
    r = client.post(
        "/api/interviews",
        json={
            "playerId": PLAYER,
            "companyId": company,
            "roleId": role,
            "profile": PROFILE,
        },
    )
    assert r.status_code == 200, r.text
    return r.json()


def play(client, view, code_for=lambda task: interview.solution(task["problemId"]), log=None):
    """Answer every question well and submit code_for(problem) for coding. Returns the last view."""
    iid, pid = view["id"], None
    while view["question"]["kind"] != "done":
        if view["status"] == "coding":
            pid = view["coding"]["problemId"]
            r = client.post(
                f"/api/interviews/{iid}/submit",
                headers=H,
                json={
                    "questionId": view["coding"]["questionId"],
                    "code": code_for(view["coding"]),
                },
            )
            assert r.status_code == 200, r.text
            if log is not None:
                log.append(r.text)
            view = r.json()["interview"]
        else:
            r = client.post(
                f"/api/interviews/{iid}/answer",
                headers=H,
                json={"text": good_answer(view, pid)},
            )
            assert r.status_code == 200, r.text
            if log is not None:
                log.append(r.text)
            view = r.json()
    return view


def dumps(x) -> str:
    return json.dumps(x)
