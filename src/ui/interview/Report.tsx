// Result report (PRD 12.8) and the offer letter (PRD 13).
import { useState } from "react";
import type { Evaluation, Offer, QuestionReport } from "../../api/types";
import { Confirm } from "./Confirm";
import { kindLabel, pct, rupees } from "./shared";

export function Report({
  evaluation: ev,
  companyName,
  roleTitle,
  onOffer,
  onDone,
}: {
  evaluation: Evaluation;
  companyName: string;
  roleTitle?: string;
  onOffer: () => void;
  onDone: () => void;
}) {
  const selected = ev.decision === "selected";
  const rows = [
    {
      label: "Coding",
      score: ev.scores.coding,
      need: ev.thresholds.minCodingPassRate,
      hint: "Share of tests your submitted code passed",
    },
    {
      label: "Concepts",
      score: ev.scores.concept,
      need: ev.thresholds.minConceptScore,
      hint: "Rubric score for your spoken answers",
    },
    {
      label: "Overall",
      score: ev.scores.overall,
      need: ev.thresholds.minOverallScore,
      hint: "Weighted across every question",
    },
  ];
  return (
    <div className="iv-page">
      <article className="iv-report" aria-labelledby="iv-report-title">
        <header className={`iv-report-head ${selected ? "ok" : "bad"}`}>
          <p className="iv-eyebrow">
            Interview result · {companyName}
            {roleTitle ? ` · ${roleTitle}` : ""}
          </p>
          <h1 id="iv-report-title" className="iv-display">
            {selected ? "Selected" : "Not selected this time"}
          </h1>
          <p className="iv-muted">
            {selected
              ? "You met every hiring bar for this role."
              : "Thank you for your time. Here is exactly where it fell short, so the next one goes better."}
          </p>
        </header>

        <section aria-labelledby="iv-scores">
          <h2 id="iv-scores">Scores against the hiring bar</h2>
          <ul className="iv-scores">
            {rows.map((r) => {
              const pass = r.score >= r.need;
              return (
                <li key={r.label}>
                  <div className="iv-score-top">
                    <b>{r.label}</b>
                    <span className={pass ? "iv-ok" : "iv-bad"}>
                      {pct(r.score)}{" "}
                      <span className="iv-muted">· needs {pct(r.need)}</span>{" "}
                      {pass ? "✓" : "✕"}
                    </span>
                  </div>
                  <div
                    className="iv-bar"
                    role="meter"
                    aria-label={`${r.label} score`}
                    aria-valuemin={0}
                    aria-valuemax={100}
                    aria-valuenow={Math.round(r.score * 100)}
                    aria-valuetext={`${pct(r.score)}, needs ${pct(r.need)}`}
                  >
                    <div
                      className={`iv-bar-fill ${pass ? "ok" : "bad"}`}
                      style={{ width: pct(Math.min(1, Math.max(0, r.score))) }}
                    />
                    <div
                      className="iv-bar-need"
                      style={{ left: pct(r.need) }}
                      title={`Needed: ${pct(r.need)}`}
                    />
                  </div>
                  <p className="iv-muted iv-small">{r.hint}</p>
                </li>
              );
            })}
          </ul>
          {ev.reasons.length > 0 && (
            <ul className="iv-reasons">
              {ev.reasons.map((r, i) => (
                <li key={i}>{r}</li>
              ))}
            </ul>
          )}
        </section>

        <section aria-labelledby="iv-questions">
          <h2 id="iv-questions">Question by question</h2>
          {ev.questions.length === 0 ? (
            <p className="iv-muted">No questions were recorded.</p>
          ) : (
            <ol className="iv-qlist">
              {ev.questions.map((q, i) => (
                <QuestionItem key={i} q={q} n={i + 1} />
              ))}
            </ol>
          )}
        </section>

        {ev.revise.length > 0 && (
          <section aria-labelledby="iv-revise">
            <h2 id="iv-revise">Topics to revise</h2>
            <ul className="iv-chips">
              {ev.revise.map((t) => (
                <li key={t}>{t}</li>
              ))}
            </ul>
          </section>
        )}

        <footer className="iv-report-foot">
          {selected && ev.offer ? (
            <>
              <p>{companyName} has sent you an offer letter.</p>
              <button className="iv-btn primary" autoFocus onClick={onOffer}>
                Open the offer letter
              </button>
            </>
          ) : (
            <>
              <p className="iv-muted">
                A rejection here is one data point, not a verdict on you.
                Practise the topics above on your laptop, and new invitations
                will keep arriving.
              </p>
              <button className="iv-btn primary" autoFocus onClick={onDone}>
                Back to the city
              </button>
            </>
          )}
        </footer>
      </article>
    </div>
  );
}

function QuestionItem({ q, n }: { q: QuestionReport; n: number }) {
  const c = q.coding;
  return (
    <li className="iv-q">
      <details>
        <summary>
          <span className="iv-q-n mono">{String(n).padStart(2, "0")}</span>
          <span className="iv-tag">{kindLabel[q.kind] ?? q.kind}</span>
          {q.mandatory && <span className="iv-tag gold">Mandatory</span>}
          <span className="iv-q-prompt">{c ? c.title : q.prompt}</span>
          <span
            className={`iv-q-score ${q.score === null ? "" : q.score >= 0.5 ? "iv-ok" : "iv-bad"}`}
          >
            {q.score === null ? "not scored" : pct(q.score)}
          </span>
        </summary>
        <div className="iv-q-body">
          {c && <p className="iv-q-asked">{q.prompt}</p>}
          {!c && (
            <>
              <h4>Your answer</h4>
              <p className={q.answer ? "iv-quote" : "iv-muted"}>
                {q.answer ?? "No answer given."}
              </p>
            </>
          )}
          {c && (
            <>
              <p>
                {c.submitted ? (
                  <>
                    Submitted ·{" "}
                    <b>
                      {c.passed}/{c.total}
                    </b>{" "}
                    tests passed
                  </>
                ) : (
                  "Not submitted"
                )}{" "}
                · Expected complexity: time <code>{c.complexity.time}</code>,
                space <code>{c.complexity.space}</code>
              </p>
              <div className="iv-code-pair">
                <div>
                  <h4>Your code</h4>
                  <pre className="iv-code">
                    {c.code ?? "# nothing submitted"}
                  </pre>
                </div>
                <div>
                  <h4>Reference solution</h4>
                  <pre className="iv-code">
                    {c.referenceSolution ?? "# not available"}
                  </pre>
                </div>
              </div>
            </>
          )}
          {q.feedback && (
            <>
              <h4>Feedback</h4>
              <p>{q.feedback}</p>
            </>
          )}
        </div>
      </details>
    </li>
  );
}

export function OfferLetter({
  offer,
  companyName,
  location,
  candidate,
  onAccept,
  onDecline,
  onBack,
}: {
  offer: Offer;
  companyName: string;
  location?: string;
  candidate: string;
  onAccept: () => void;
  onDecline: () => void;
  onBack: () => void;
}) {
  const [confirmDecline, setConfirmDecline] = useState(false);
  return (
    <div className="iv-page">
      <article className="iv-letter" aria-labelledby="iv-letter-title">
        <header className="iv-letterhead">
          <p className="iv-letter-co">{companyName}</p>
          {location && <p className="iv-muted">{location}</p>}
        </header>
        <h1 id="iv-letter-title" className="iv-letter-title">
          Offer of employment
        </h1>
        <p>Dear {candidate || "Candidate"},</p>
        <p>
          Following your interview, we are pleased to offer you the position of{" "}
          <b>{offer.title}</b> at {companyName}, on the terms below.
        </p>
        <dl className="iv-terms">
          <dt>Role</dt>
          <dd>{offer.title}</dd>
          <dt>Annual package</dt>
          <dd>₹{offer.packageLpa.toLocaleString("en-IN")} LPA</dd>
          <dt>Monthly salary</dt>
          <dd>{rupees(offer.monthlySalary)}</dd>
          <dt>Work mode</dt>
          <dd>{offer.workMode}</dd>
          <dt>Joining</dt>
          <dd>
            In {offer.joinInDays} {offer.joinInDays === 1 ? "day" : "days"}
          </dd>
        </dl>
        <p>We look forward to having you on the team.</p>
        <p className="iv-sign">
          Warm regards,
          <br />
          Hiring team, {companyName}
        </p>
        <p className="iv-fiction">Fictional company — not a real job offer.</p>
        <div className="iv-letter-actions">
          <button className="iv-btn ghost" onClick={onBack}>
            Back to the report
          </button>
          <span className="iv-spacer" />
          <button className="iv-btn" onClick={() => setConfirmDecline(true)}>
            Decline
          </button>
          <button className="iv-btn primary" autoFocus onClick={onAccept}>
            Accept offer
          </button>
        </div>
      </article>
      {confirmDecline && (
        <Confirm
          title="Decline this offer?"
          confirmLabel="Decline offer"
          danger
          onCancel={() => setConfirmDecline(false)}
          onConfirm={onDecline}
        >
          <p>
            You won't be able to accept it later. Other companies can still
            invite you.
          </p>
        </Confirm>
      )}
    </div>
  );
}
