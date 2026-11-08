"""Interview orchestration: a deterministic state machine over the role's
rounds[].questions[] from content/companies.json. One question at a time.

All choices (resume target, concept, coding problem) are made once at creation
with a RNG seeded by the interview id, and stored, so a refresh restores state.
"""

import json
import random
import uuid
from datetime import datetime, timezone
from functools import lru_cache
from pathlib import Path

from fastapi import HTTPException

from . import hiring

ROOT = Path(__file__).resolve().parent.parent
CONTENT = ROOT / "content"
BANK = (
    CONTENT / "interview"
)  # server-only problems; the client only globs content/problems/


@lru_cache
def companies() -> dict:
    data = json.loads((CONTENT / "companies.json").read_text(encoding="utf-8"))
    return {c["id"]: c for c in data["companies"]}


@lru_cache
def problems() -> dict:
    return {
        p["id"]: p
        for p in (
            json.loads(f.read_text(encoding="utf-8"))
            for f in sorted(BANK.glob("*.json"))
        )
    }


@lru_cache
def concepts() -> dict:
    return json.loads(
        (Path(__file__).parent / "data" / "concepts.json").read_text(encoding="utf-8")
    )


def solution(problem_id: str) -> str:
    return (BANK / "solutions" / f"{problem_id}.py").read_text(encoding="utf-8")


def now() -> str:
    return datetime.now(timezone.utc).isoformat(timespec="seconds")


def find_role(company_id: str, role_id: str) -> tuple[dict, dict]:
    company = companies().get(company_id)
    role = next(
        (r for r in (company or {}).get("roles", []) if r["id"] == role_id), None
    )
    if not role:
        raise HTTPException(404, "Unknown company or role")
    return company, role


# ---------- creation ----------


def _resume_target(profile: dict) -> dict:
    """Prefer a claimed skill with 0 proficiency (probe honesty), then any claimed skill, then a project."""
    claimed = [s for s in profile["skills"] if s["source"] == "claimed"]
    for pool in ([s for s in claimed if s["proficiency"] <= 0], claimed):
        if pool:
            return {"type": "skill", "name": pool[0]["name"]}
    projects = profile["resume"]["projects"]
    if projects:
        return {"type": "project", "name": projects[0]["name"]}
    if profile["skills"]:
        return {"type": "skill", "name": profile["skills"][0]["name"]}
    return {"type": "none", "name": ""}


def create(
    con, ai, player_id: str, company_id: str, role_id: str, profile: dict
) -> str:
    company, role = find_role(company_id, role_id)
    iid = uuid.uuid4().hex
    rng = random.Random(iid)
    used_problems, used_concepts, last_problem = set(), set(), None
    rows = []
    flat = [(ri, q) for ri, rnd in enumerate(role["rounds"]) for q in rnd["questions"]]
    for idx, (ri, q) in enumerate(flat):
        kind, ref, topic = q["kind"], None, None
        if kind == "coding":
            pool = sorted(
                p["id"]
                for p in problems().values()
                if p["tier"] == q.get("tier") and p["id"] not in used_problems
            )
            if not pool:
                raise HTTPException(
                    500, f"No interview problems left for tier {q.get('tier')}"
                )
            ref = last_problem = rng.choice(pool)
            used_problems.add(ref)
            topic = problems()[ref]["topic"]
        elif kind == "concept":
            bank = concepts().get(q.get("topic", "dsa"), concepts()["dsa"])
            pool = [c for c in bank if c["id"] not in used_concepts] or bank
            c = rng.choice(pool)
            used_concepts.add(c["id"])
            ref, topic = c["id"], c["label"]
        elif kind == "complexity":
            ref, topic = last_problem, "Time and space complexity (Big-O)"
        elif kind == "resume":
            ref = json.dumps(_resume_target(profile))
        rows.append((iid, idx, ri, kind, int(bool(q.get("mandatory"))), topic, ref))
    con.execute(
        "INSERT INTO interviews (id, player_id, company_id, role_id, profile, cursor, status, created_at) VALUES (?,?,?,?,?,0,'in_progress',?)",
        (iid, player_id, company_id, role_id, json.dumps(profile), now()),
    )
    con.executemany(
        "INSERT INTO questions (interview_id, idx, round_idx, kind, mandatory, topic, ref) VALUES (?,?,?,?,?,?,?)",
        rows,
    )
    iv = load(con, iid)
    qs = questions(con, iid)
    greeting = (
        f"Hi {profile['name']}, I'm {company['interviewer']['name']}, {company['interviewer']['title']} at {company['name']}. "
        f"This interview for {role['title']} has {len(role['rounds'])} round(s) and {len(qs)} questions; I'll ask one at a time. "
        f"We start with the {role['rounds'][0]['name']}."
    )
    _ask(con, ai, iv, qs, greeting, opener=False)
    return iid


# ---------- reading ----------


def load(con, iid: str):
    iv = con.execute("SELECT * FROM interviews WHERE id = ?", (iid,)).fetchone()
    if not iv:
        raise HTTPException(404, "Interview not found")
    return iv


def questions(con, iid: str) -> list:
    return con.execute(
        "SELECT * FROM questions WHERE interview_id = ? ORDER BY idx", (iid,)
    ).fetchall()


def coding_task(q) -> dict:
    p = problems()[q["ref"]]
    return {
        "questionId": f"q{q['idx']}",
        "problemId": p["id"],
        "title": p["title"],
        "difficulty": p["difficulty"],
        "statement": p["statement"],
        "function": p["function"],
        "constraints": p["constraints"],
        "examples": p["examples"],
        "starter": {"python": p["starter"]["python"]},
        "visibleTests": p["visibleTests"],
        "limits": p["limits"],
    }  # built field by field: hiddenTests, hints and solutions can't slip in


def view(con, iid: str, ai_name: str) -> dict:
    iv = load(con, iid)
    company, role = find_role(iv["company_id"], iv["role_id"])
    qs = questions(con, iid)
    cur = qs[iv["cursor"]] if iv["cursor"] < len(qs) else None
    ri = cur["round_idx"] if cur else qs[-1]["round_idx"]
    msgs = con.execute(
        "SELECT id, speaker, text, at FROM messages WHERE interview_id = ? ORDER BY seq",
        (iid,),
    ).fetchall()
    return {
        "id": iid,
        "companyId": iv["company_id"],
        "roleId": iv["role_id"],
        "interviewer": {
            k: company["interviewer"][k] for k in ("name", "title", "gender")
        },
        "status": iv["status"],
        "round": {
            "index": ri,
            "total": len(role["rounds"]),
            "name": role["rounds"][ri]["name"],
        },
        "question": {
            "index": iv["cursor"],
            "total": len(qs),
            "kind": cur["kind"] if cur else "done",
            "mandatory": bool(cur["mandatory"]) if cur else False,
        },
        "messages": [dict(m) for m in msgs],
        "coding": coding_task(cur)
        if cur and cur["kind"] == "coding" and iv["status"] == "coding"
        else None,
        "aiProvider": ai_name,
    }


# ---------- questions ----------


def _question_text(q, iv, company) -> str:
    kind = q["kind"]
    if kind == "intro":
        return "Tell me about yourself: your background, what you've built, and what you're looking for."
    if kind == "resume":
        t = json.loads(q["ref"])
        if t["type"] == "skill":
            return f"Your resume lists {t['name']}. Tell me about a time you used {t['name']}: what you built, what was hard, and how comfortable you are with it."
        if t["type"] == "project":
            return f'Tell me about your project "{t["name"]}". What did you build, what was your part, and what would you improve?'
        return "Walk me through something you've built or learned recently, and what was hard about it."
    if kind == "concept":
        return _concept(q["ref"])["question"]
    if kind == "coding":
        p = problems()[q["ref"]]
        return f"Here's a coding problem: \"{p['title']}\". The statement is in the editor. Run the sample tests as often as you like, then Submit once when you're ready."
    if kind == "complexity":
        if q["ref"]:
            return f'About your solution to "{problems()[q["ref"]]["title"]}": what are its time and space complexity, and why?'
        return "What are the time and space complexity of binary search, and why?"
    return f"Why do you want to join {company['name']}, and what is one strength you'd bring to the team?"


def _concept(cid: str) -> dict:
    return next(c for bank in concepts().values() for c in bank if c["id"] == cid)


def key_points(q, iv, company) -> list[dict]:
    kind = q["kind"]
    profile = json.loads(iv["profile"])
    if kind == "concept":
        return _concept(q["ref"])["keyPoints"]
    if kind == "complexity":
        cx = (
            problems()[q["ref"]]["complexity"]
            if q["ref"]
            else {"time": "O(log n)", "space": "O(1)"}
        )
        return [
            {"point": f"Time complexity is {cx['time']}", "keywords": [cx["time"]]},
            {"point": f"Space complexity is {cx['space']}", "keywords": [cx["space"]]},
        ]
    if kind == "intro":
        skills = [s["name"] for s in profile["skills"]]
        return [
            {
                "point": "Mentions background or education",
                "keywords": [
                    "studied",
                    "college",
                    "degree",
                    "university",
                    "school",
                    "background",
                    "graduat",
                    "b.tech",
                    "btech",
                    "engineering",
                    "course",
                ],
            },
            {
                "point": "Mentions skills or technologies",
                "keywords": skills
                + [
                    "python",
                    "javascript",
                    "html",
                    "css",
                    "java",
                    "react",
                    "sql",
                    "programming",
                    "coding",
                ],
            },
            {
                "point": "Mentions a project or experience",
                "keywords": [
                    "project",
                    "built",
                    "made",
                    "created",
                    "developed",
                    "internship",
                    "worked",
                ],
            },
            {
                "point": "States a goal",
                "keywords": [
                    "goal",
                    "want",
                    "looking",
                    "hope",
                    "aim",
                    "career",
                    "learn",
                    "grow",
                ],
            },
        ]
    if kind == "resume":
        t = json.loads(q["ref"])
        name = t["name"].lower()
        if t["type"] == "skill":
            return [
                {
                    "point": f"Gives a concrete example of using {t['name']}",
                    "keywords": [
                        name,
                        "built",
                        "used",
                        "wrote",
                        "implemented",
                        "project",
                    ],
                },
                {
                    "point": "Explains a challenge or what they learned",
                    "keywords": [
                        "challenge",
                        "hard",
                        "difficult",
                        "problem",
                        "learned",
                        "bug",
                        "fixed",
                        "stuck",
                    ],
                },
                {
                    "point": "Is honest about their level",
                    "keywords": [
                        "beginner",
                        "learning",
                        "basic",
                        "honest",
                        "not much",
                        "haven't",
                        "have not",
                        "little",
                        "still",
                        "comfortable",
                        "confident",
                        "experience",
                    ],
                },
            ]
        return [
            {
                "point": "Explains what the project does",
                "keywords": [
                    "built",
                    "app",
                    "website",
                    "tool",
                    "it lets",
                    "it helps",
                    "users",
                    "made",
                ],
            },
            {
                "point": "Describes their own part in it",
                "keywords": [
                    "i ",
                    "my part",
                    "my role",
                    "responsible",
                    "i wrote",
                    "i built",
                    "i designed",
                ],
            },
            {
                "point": "Says what they would improve",
                "keywords": [
                    "improve",
                    "would change",
                    "next time",
                    "better",
                    "refactor",
                    "add",
                    "fix",
                ],
            },
        ]
    # hr
    return [
        {
            "point": f"Gives a reason to join {company['name']}",
            "keywords": [
                company["name"].split()[0].lower(),
                "your product",
                "your company",
                "mission",
                "customers",
                "users",
                "team",
                "work on",
                "impact",
            ],
        },
        {
            "point": "Names a clear strength",
            "keywords": [
                "strength",
                "good at",
                "quick learner",
                "communicat",
                "problem solving",
                "problem-solving",
                "hardworking",
                "consistent",
                "reliable",
                "curious",
            ],
        },
        {
            "point": "Backs it with an example",
            "keywords": [
                "for example",
                "for instance",
                "once",
                "when i",
                "project",
                "because",
            ],
        },
    ]


def add_message(con, iid: str, speaker: str, text: str) -> None:
    seq = con.execute(
        "SELECT COALESCE(MAX(seq), 0) + 1 FROM messages WHERE interview_id = ?", (iid,)
    ).fetchone()[0]
    con.execute(
        "INSERT INTO messages (id, interview_id, seq, speaker, text, at) VALUES (?,?,?,?,?,?)",
        (uuid.uuid4().hex, iid, seq, speaker, text, now()),
    )


def _ask(con, ai, iv, qs, lead: str, opener: bool = True) -> None:
    """Say `lead` + the current question (or the closing line) in one interviewer message."""
    company, role = find_role(iv["company_id"], iv["role_id"])
    cur = iv["cursor"]
    if cur >= len(qs):
        draft = (
            f"{lead} That's all my questions. Press Finish to get your result.".strip()
        )
        status = "in_progress"
    else:
        q = qs[cur]
        if cur > 0 and qs[cur - 1]["round_idx"] != q["round_idx"]:
            lead = f"{lead} That's the end of the {role['rounds'][qs[cur - 1]['round_idx']]['name']}. Next is the {role['rounds'][q['round_idx']]['name']}."
        text = _question_text(q, iv, company)
        con.execute(
            "UPDATE questions SET prompt = ? WHERE interview_id = ? AND idx = ?",
            (text, iv["id"], cur),
        )
        draft = f"{lead} {text}".strip()
        status = "coding" if q["kind"] == "coding" else "in_progress"
    con.execute("UPDATE interviews SET status = ? WHERE id = ?", (status, iv["id"]))
    add_message(
        con, iv["id"], "interviewer", ai.speak(company["interviewer"], draft, opener)
    )


def _advance(con, ai, iid: str, lead: str) -> None:
    con.execute("UPDATE interviews SET cursor = cursor + 1 WHERE id = ?", (iid,))
    _ask(con, ai, load(con, iid), questions(con, iid), lead)


def _open(con, iid: str):
    iv = load(con, iid)
    if iv["status"] == "completed":
        raise HTTPException(409, "This interview is already finished")
    return iv


# ---------- actions ----------


def answer(con, ai, iid: str, text: str) -> None:
    iv = _open(con, iid)
    qs = questions(con, iid)
    if iv["cursor"] >= len(qs):
        raise HTTPException(409, "No question is open; press Finish")
    q = qs[iv["cursor"]]
    text = text.strip()
    if not text:
        if q["mandatory"]:
            raise HTTPException(
                422, "This question is mandatory; please give an answer"
            )
        add_message(con, iid, "system", "Question skipped.")
        _advance(con, ai, iid, "No problem, let's move on.")
        return
    add_message(con, iid, "player", text)
    company, _ = find_role(iv["company_id"], iv["role_id"])
    if (
        q["kind"] == "coding"
    ):  # explaining the approach: noted, but only Submit closes the question
        add_message(
            con,
            iid,
            "interviewer",
            ai.speak(
                company["interviewer"],
                "Noted. Keep going, and press Submit when your code is ready.",
            ),
        )
        return
    score, feedback = ai.score(
        q["kind"], q["prompt"] or "", text, key_points(q, iv, company)
    )
    score = min(1.0, max(0.0, float(score)))
    con.execute(
        "UPDATE questions SET answer = ?, score = ?, feedback = ?, answered_at = ? WHERE interview_id = ? AND idx = ?",
        (text, score, str(feedback)[:300], now(), iid, q["idx"]),
    )
    _advance(con, ai, iid, "")


def _coding_question(con, iid: str, question_id: str):
    iv = _open(con, iid)
    qs = questions(con, iid)
    q = qs[iv["cursor"]] if iv["cursor"] < len(qs) else None
    if not q or q["kind"] != "coding" or question_id != f"q{q['idx']}":
        raise HTTPException(409, "That coding question isn't open")
    return iv, q


def _record(con, iid: str, q, mode: str, code: str, result: dict) -> None:
    con.execute(
        "INSERT INTO submissions (id, interview_id, question_idx, problem_id, mode, language, code, result, passed, total, at) VALUES (?,?,?,?,?,?,?,?,?,?,?)",
        (
            uuid.uuid4().hex,
            iid,
            q["idx"],
            q["ref"],
            mode,
            "python",
            code,
            json.dumps(result),
            result["passed"],
            result["total"],
            now(),
        ),
    )


def run(con, executor, iid: str, question_id: str, code: str) -> dict:
    _, q = _coding_question(con, iid, question_id)
    result = executor.run(problems()[q["ref"]], code, "visible")
    _record(con, iid, q, "run", code, result)
    return result


def submit(con, ai, executor, iid: str, question_id: str, code: str) -> dict:
    _, q = _coding_question(con, iid, question_id)
    result = executor.run(problems()[q["ref"]], code, "all")
    _record(con, iid, q, "submit", code, result)
    hidden = [r for r in result["results"] if r["kind"] == "hidden"]
    hp = sum(r["passed"] for r in hidden)
    add_message(
        con,
        iid,
        "system",
        f"Submission recorded: {result['passed']}/{result['total']} tests passed ({hp}/{len(hidden)} hidden).",
    )
    if result["compileError"]:
        lead = "Your code didn't run because of an error before any test started. We'll note that and move on."
    elif result["passed"] == result["total"]:
        lead = f"All {result['total']} tests pass. Nicely done."
    elif result["passed"]:
        lead = f"{result['total'] - result['passed']} of {result['total']} tests failed, so there are some cases your code doesn't handle yet."
    else:
        lead = "None of the tests passed this time."
    _advance(con, ai, iid, lead)
    return result


def _final_submission(con, iid: str, idx: int):
    return con.execute(
        "SELECT * FROM submissions WHERE interview_id = ? AND question_idx = ? AND mode = 'submit' ORDER BY at DESC, rowid DESC LIMIT 1",
        (iid, idx),
    ).fetchone()


def finish(con, iid: str) -> dict:
    iv = load(con, iid)
    if iv["status"] == "completed":
        return json.loads(iv["evaluation"])
    company, role = find_role(iv["company_id"], iv["role_id"])
    qlist = []
    for q in questions(con, iid):
        item = {
            "kind": q["kind"],
            "mandatory": bool(q["mandatory"]),
            "prompt": q["prompt"] or "",
            "answer": q["answer"],
            "score": q["score"],
            "feedback": q["feedback"] or "",
            "topic": q["topic"],
        }
        if q["kind"] == "coding":
            p, sub = problems()[q["ref"]], _final_submission(con, iid, q["idx"])
            item["answer"] = None
            item["coding"] = {
                "problemId": p["id"],
                "title": p["title"],
                "topic": p["topic"],
                "submitted": sub is not None,
                "passed": sub["passed"] if sub else 0,
                "total": sub["total"]
                if sub
                else len(p["examples"])
                + len(p["visibleTests"])
                + len(p["hiddenTests"]),
                "code": sub["code"] if sub else None,
                "referenceSolution": solution(
                    p["id"]
                ),  # only ever returned after completion
                "complexity": p["complexity"],
            }
            item["feedback"] = (
                f"{item['coding']['passed']}/{item['coding']['total']} tests passed."
                if sub
                else "Not submitted."
            )
        qlist.append(item)
    missing = [q for q in qlist if q["mandatory"] and not hiring.is_done(q)]
    if missing:
        raise HTTPException(
            409,
            f"{len(missing)} mandatory question(s) still need an answer or a submission",
        )
    evaluation = hiring.evaluate(company["id"], role, qlist)
    con.execute(
        "UPDATE interviews SET status = 'completed', evaluation = ? WHERE id = ?",
        (json.dumps(evaluation), iid),
    )
    add_message(con, iid, "system", f"Interview complete: {evaluation['decision']}.")
    return evaluation


def report(con, iid: str) -> dict:
    iv = load(con, iid)
    if iv["status"] != "completed":
        raise HTTPException(
            409, "The report is available after the interview is finished"
        )
    return json.loads(iv["evaluation"])

