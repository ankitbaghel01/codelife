// Dev-only harness: mount behind `?interview=1` to try the interview flow without the game around it.
import { useState } from "react";
import type { Evaluation, PlayerProfile } from "../../api/types";
import { InterviewScreen } from "./InterviewScreen";
import { keys, store } from "./shared";

const INVITE = { id: "dev-invite", companyId: "sutradhar", roleId: "jr-web" };

const PROFILE: PlayerProfile = {
  name: "Ankit Sharma",
  skills: [
    { name: "HTML", proficiency: 45, source: "start" },
    { name: "CSS", proficiency: 40, source: "start" },
    { name: "JavaScript", proficiency: 35, source: "start" },
    { name: "Python", proficiency: 30, source: "claimed" },
  ],
  resume: {
    summary:
      "Fresh B.Tech graduate who builds small web apps and practises DSA in Python.",
    projects: [
      {
        name: "Clinic queue board",
        description:
          "A vanilla JS page that shows the live token number at a local clinic.",
      },
      {
        name: "Expense splitter",
        description:
          "A Python CLI that splits shared flat expenses between roommates.",
      },
    ],
  },
};

export function InterviewDev() {
  const [run, setRun] = useState(0);
  const [out, setOut] = useState<
    | null
    | { kind: "exit" }
    | { kind: "done"; evaluation: Evaluation; accepted: boolean }
  >(null);

  if (out)
    return (
      <div className="iv">
        <div className="iv-center">
          <div className="iv-card iv-center-card">
            <p className="iv-eyebrow">Dev harness</p>
            <h1 className="iv-display">
              {out.kind === "exit"
                ? "Left the interview"
                : out.accepted
                  ? "Offer accepted"
                  : "Done"}
            </h1>
            {out.kind === "done" && (
              <p className="iv-muted">
                Decision: {out.evaluation.decision} · onDone(accepted:{" "}
                {String(out.accepted)})
              </p>
            )}
            <div className="iv-row">
              <button
                className="iv-btn primary"
                autoFocus
                onClick={() => setOut(null)}
              >
                {out.kind === "exit" ? "Resume interview" : "Open again"}
              </button>
              <button
                className="iv-btn"
                onClick={() => {
                  store.del(keys.interview(INVITE.id));
                  setRun((r) => r + 1);
                  setOut(null);
                }}
              >
                Start a fresh interview
              </button>
            </div>
          </div>
        </div>
      </div>
    );

  return (
    <InterviewScreen
      key={run}
      invitation={INVITE}
      profile={PROFILE}
      playerId="dev-player"
      onDone={(r) => setOut({ kind: "done", ...r })}
      onExit={() => setOut({ kind: "exit" })}
    />
  );
}

export default InterviewDev;
