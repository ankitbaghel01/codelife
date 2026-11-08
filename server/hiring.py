"""Hiring decision: pure functions over recorded results. The AI can't override this.

A question dict (built by interview.py) looks like:
  {kind, mandatory, prompt, answer, score, feedback, topic,
   coding?: {problemId, title, topic, submitted, passed, total, code, referenceSolution, complexity}}
"""


def is_done(q: dict) -> bool:
    if q["kind"] == "coding":
        return bool(q.get("coding") and q["coding"]["submitted"])
    return bool(q.get("answer") and q["answer"].strip())


def coding_score(questions: list[dict]) -> tuple[float, int, int]:
    """Mean pass rate over mandatory coding questions (unsubmitted = 0). Returns (rate, passed, total)."""
    rates, passed, total = [], 0, 0
    for q in questions:
        if q["kind"] == "coding" and q["mandatory"]:
            c = q.get("coding") or {}
            p, t = (
                (c.get("passed", 0), c.get("total", 0))
                if c.get("submitted")
                else (0, c.get("total", 0))
            )
            rates.append(p / t if t else 0.0)
            passed, total = passed + p, total + t
    if not rates:
        return 1.0, 0, 0  # role has no mandatory coding: nothing to fail
    return sum(rates) / len(rates), passed, total


def concept_score(questions: list[dict]) -> float:
    scores = [
        q["score"]
        for q in questions
        if q["kind"] != "coding" and q.get("score") is not None
    ]
    return sum(scores) / len(scores) if scores else 0.0


def overall_score(coding: float, concept: float) -> float:
    return 0.6 * coding + 0.4 * concept


def revise_topics(questions: list[dict]) -> list[str]:
    out = []
    for q in questions:
        c = q.get("coding")
        if (
            q["kind"] == "coding"
            and c
            and (not c["submitted"] or not c["total"] or c["passed"] < c["total"])
        ):
            out.append(c["topic"])
        elif q["kind"] in ("concept", "complexity") and (
            q.get("score") is None or q["score"] < 0.6
        ):
            out.append(q["topic"])
    return list(dict.fromkeys(t for t in out if t))


def _pct(x: float) -> str:
    return f"{round(x * 100)}%"


def evaluate(company_id: str, role: dict, questions: list[dict]) -> dict:
    th = role["hiring"]
    coding, passed, total = coding_score(questions)
    concept = concept_score(questions)
    overall = overall_score(coding, concept)
    missing = [q for q in questions if q["mandatory"] and not is_done(q)]

    reasons = []
    if missing:
        reasons.append(
            f"Not finished: {len(missing)} mandatory question(s) were not answered or submitted."
        )
    checks = [
        (
            coding,
            th["minCodingPassRate"],
            f"Coding: {passed}/{total} tests passed ({_pct(coding)} average), needed {_pct(th['minCodingPassRate'])}",
        ),
        (
            concept,
            th["minConceptScore"],
            f"Concepts and communication: scored {_pct(concept)}, needed {_pct(th['minConceptScore'])}",
        ),
        (
            overall,
            th["minOverallScore"],
            f"Overall: {_pct(overall)} (60% coding + 40% concepts), needed {_pct(th['minOverallScore'])}",
        ),
    ]
    # small epsilon so 0.7 computed as 0.69999... still meets a 0.7 bar
    ok = [score + 1e-9 >= need for score, need, _ in checks]
    reasons += [
        f"{text}. {'Met.' if good else 'Below the bar.'}"
        for (_, _, text), good in zip(checks, ok)
    ]
    selected = not missing and all(ok)
    return {
        "decision": "selected" if selected else "rejected",
        "scores": {
            "coding": round(coding, 4),
            "concept": round(concept, 4),
            "overall": round(overall, 4),
        },
        "thresholds": {
            k: th[k]
            for k in ("minCodingPassRate", "minConceptScore", "minOverallScore")
        },
        "reasons": reasons,
        "questions": [
            {
                k: v
                for k, v in q.items()
                if k
                in (
                    "kind",
                    "mandatory",
                    "prompt",
                    "answer",
                    "score",
                    "feedback",
                    "coding",
                )
            }
            | (
                {"coding": {k: v for k, v in q["coding"].items() if k != "topic"}}
                if q.get("coding")
                else {}
            )
            for q in questions
        ],
        "revise": revise_topics(questions),
        "offer": {
            "companyId": company_id,
            "roleId": role["id"],
            "title": role["title"],
            "packageLpa": role["packageLpa"],
            "monthlySalary": role["monthlySalary"],
            "workMode": role["workMode"],
            "joinInDays": 2,
        }
        if selected
        else None,
    }
