from server import hiring

ROLE = {
    "id": "r",
    "title": "Dev",
    "packageLpa": 5,
    "monthlySalary": 30000,
    "workMode": "Office",
    "hiring": {
        "minCodingPassRate": 0.7,
        "minConceptScore": 0.5,
        "minOverallScore": 0.55,
    },
}


def coding(passed, total, submitted=True, mandatory=True):
    return {
        "kind": "coding",
        "mandatory": mandatory,
        "prompt": "",
        "answer": None,
        "score": None,
        "feedback": "",
        "topic": "arrays",
        "coding": {
            "problemId": "p",
            "title": "P",
            "topic": "arrays",
            "submitted": submitted,
            "passed": passed,
            "total": total,
            "code": "x",
            "referenceSolution": "y",
            "complexity": {"time": "O(n)", "space": "O(1)"},
        },
    }


def talk(score, kind="concept", answer="an answer", mandatory=True):
    return {
        "kind": kind,
        "mandatory": mandatory,
        "prompt": "",
        "answer": answer,
        "score": score,
        "feedback": "",
        "topic": "Closures",
    }


def test_scores_math():
    qs = [
        coding(7, 10),
        coding(10, 10),
        talk(0.5),
        talk(1.0, "hr"),
        coding(0, 10, mandatory=False),
    ]
    c, p, t = hiring.coding_score(qs)
    assert (round(c, 6), p, t) == (
        0.85,
        17,
        20,
    )  # mean of rates; optional coding ignored
    assert hiring.concept_score(qs) == 0.75
    assert round(hiring.overall_score(0.85, 0.75), 6) == 0.81


def test_unsubmitted_counts_as_zero():
    assert (
        hiring.coding_score([coding(10, 10), coding(9, 10, submitted=False)])[0] == 0.5
    )


def test_exact_threshold_passes_and_just_below_fails():
    ev = hiring.evaluate("c", ROLE, [coding(7, 10), talk(0.5)])  # 0.7 / 0.5 / 0.62
    assert ev["decision"] == "selected" and ev["offer"]["joinInDays"] == 2
    ev = hiring.evaluate("c", ROLE, [coding(69, 100), talk(1.0)])
    assert ev["decision"] == "rejected" and ev["offer"] is None


def test_overall_threshold_can_fail_alone():
    role = {
        **ROLE,
        "hiring": {
            "minCodingPassRate": 0.5,
            "minConceptScore": 0.0,
            "minOverallScore": 0.9,
        },
    }
    ev = hiring.evaluate("c", role, [coding(10, 10), talk(0.5)])  # overall 0.8
    assert ev["decision"] == "rejected"
    assert any(r.startswith("Overall") and "Below the bar" in r for r in ev["reasons"])


def test_unanswered_mandatory_rejects_even_with_perfect_scores():
    ev = hiring.evaluate(
        "c", ROLE, [coding(10, 10), talk(1.0), talk(None, "hr", answer=None)]
    )
    assert ev["decision"] == "rejected" and "Not finished" in ev["reasons"][0]


def test_revise_topics():
    qs = [coding(9, 10), talk(0.4), talk(0.9, "concept"), talk(0.2, "hr")]
    assert hiring.revise_topics(qs) == ["arrays", "Closures"]
