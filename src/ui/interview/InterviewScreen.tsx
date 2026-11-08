// Interview flow: conversation ⇄ full-screen coding workstation → finish → result report → offer letter.
// All interview state lives on the server; this component only remembers the interview id per invitation.
import { useCallback, useEffect, useRef, useState, type ReactNode } from "react";
import {
  ApiError,
  createInterview,
  finishInterview,
  getInterview,
  answer as postAnswer,
} from "../../api/client";
import type { Evaluation, InterviewView, PlayerProfile } from "../../api/types";
import { Conversation } from "./Conversation";
import { Workstation } from "./Workstation";
import { OfferLetter, Report } from "./Report";
import { company, keys, store } from "./shared";
import "./interview.css";

// The server marks "every question answered" with question.kind "done"; status turns "completed" only after /finish.
const allAnswered = (v: InterviewView) =>
  v.status === "completed" || v.question.kind === "done";

export type InterviewInvitation = {
  id: string;
  companyId: string;
  roleId: string;
};

type Props = {
  invitation: InterviewInvitation;
  profile: PlayerProfile;
  playerId: string;
  onDone: (result: { evaluation: Evaluation; accepted: boolean }) => void;
  /** Leave without finishing; the interview stays resumable from the same invitation. */
  onExit: () => void;
};

type Phase = "loading" | "error" | "live" | "finishing" | "report" | "offer";

export function InterviewScreen({
  invitation,
  profile,
  playerId,
  onDone,
  onExit,
}: Props) {
  const [phase, setPhase] = useState<Phase>("loading");
  const [error, setError] = useState<{ err: Error; retry: () => void } | null>(
    null,
  );
  const [view, setView] = useState<InterviewView | null>(null);
  const [evaluation, setEvaluation] = useState<Evaluation | null>(null);
  const [finishError, setFinishError] = useState<string | null>(null);
  const [ideHidden, setIdeHidden] = useState(false);
  const starting = useRef(false); // blocks a second POST /interviews from a double effect run

  const co = company(invitation.companyId);
  const storeKey = keys.interview(invitation.id);

  const finish = useCallback(
    async (v: InterviewView) => {
      setPhase("finishing");
      setFinishError(null);
      try {
        const ev = await finishInterview(playerId, v.id);
        setEvaluation(ev);
        setPhase("report");
      } catch (e) {
        if (e instanceof ApiError && e.status === 409) {
          setFinishError(e.message);
          setPhase("live");
        } else {
          setError({ err: e as Error, retry: () => void finish(v) });
          setPhase("error");
        }
      }
    },
    [playerId],
  );

  const start = useCallback(async () => {
    if (starting.current) return;
    starting.current = true;
    setPhase("loading");
    setError(null);
    try {
      let v: InterviewView | null = null;
      const saved = store.get(storeKey);
      if (saved) {
        try {
          v = await getInterview(playerId, saved);
        } catch (e) {
          // A wiped server database forgets old ids: start fresh instead of getting stuck.
          if (e instanceof ApiError && e.status === 404) store.del(storeKey);
          else throw e;
        }
      }
      if (!v) {
        v = await createInterview(playerId, {
          companyId: invitation.companyId,
          roleId: invitation.roleId,
          profile,
        });
        store.set(storeKey, v.id);
      }
      setView(v);
      if (allAnswered(v)) await finish(v);
      else setPhase("live");
    } catch (e) {
      setError({ err: e as Error, retry: () => void start() });
      setPhase("error");
    } finally {
      starting.current = false;
    }
  }, [
    playerId,
    storeKey,
    invitation.companyId,
    invitation.roleId,
    profile,
    finish,
  ]);

  useEffect(() => {
    void start();
    // Start once per invitation; profile edits mid-interview must not restart it.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [invitation.id]);

  // A new coding question always opens the workstation, even if the last one was exited.
  const codingId =
    view?.status === "coding" ? view.coding?.questionId : undefined;
  useEffect(() => setIdeHidden(false), [codingId]);

  const apply = (v: InterviewView) => {
    setView(v);
    if (allAnswered(v)) void finish(v);
  };

  const send = async (text: string) => {
    if (!view) return;
    apply(await postAnswer(playerId, view.id, text));
  };

  const companyName = co?.name ?? view?.companyId ?? invitation.companyId;

  let body;
  if (phase === "loading" || (phase === "finishing" && !view)) {
    body = (
      <Centered>
        <span className="iv-spin" aria-hidden="true" />
        <p>Walking into {companyName}…</p>
      </Centered>
    );
  } else if (phase === "error" && error) {
    const offline = error.err instanceof ApiError && error.err.offline;
    body = (
      <Centered>
        <p className="iv-eyebrow">
          {offline ? "Server offline" : "Something went wrong"}
        </p>
        <h1 className="iv-display">
          {offline
            ? "Can't reach the interview server"
            : "The interview hit a snag"}
        </h1>
        <p className="iv-muted" role="alert">
          {offline ? (
            <>
              Start it with <code>npm run server</code>, then try again.
            </>
          ) : (
            error.err.message
          )}
        </p>
        <div className="iv-row">
          <button className="iv-btn" onClick={onExit}>
            Back to the city
          </button>
          <button className="iv-btn primary" autoFocus onClick={error.retry}>
            Retry
          </button>
        </div>
      </Centered>
    );
  } else if ((phase === "report" || phase === "offer") && evaluation) {
    body =
      phase === "offer" && evaluation.offer ? (
        <OfferLetter
          offer={evaluation.offer}
          companyName={companyName}
          location={co?.location}
          candidate={profile.name}
          onAccept={() => onDone({ evaluation, accepted: true })}
          onDecline={() => onDone({ evaluation, accepted: false })}
          onBack={() => setPhase("report")}
        />
      ) : (
        <Report
          evaluation={evaluation}
          companyName={companyName}
          roleTitle={co?.roles.find((r) => r.id === invitation.roleId)?.title}
          onOffer={() => setPhase("offer")}
          onDone={() => onDone({ evaluation, accepted: false })}
        />
      );
  } else if (view) {
    const ide = view.status === "coding" && view.coding && !ideHidden;
    body = ide ? (
      <Workstation
        key={view.coding!.questionId}
        view={view}
        task={view.coding!}
        companyName={companyName}
        playerId={playerId}
        onExit={() => setIdeHidden(true)}
        onSubmitted={apply}
      />
    ) : (
      <Conversation
        view={view}
        companyName={companyName}
        finishing={phase === "finishing"}
        finishError={finishError}
        onSend={send}
        onOpenIde={() => setIdeHidden(false)}
        onFinish={() => void finish(view)}
        onLeave={onExit}
      />
    );
  }

  return (
    <div
      className="iv"
      // Keystrokes typed here (answers, code) must never move the player or open game menus.
      onKeyDown={(e) => e.stopPropagation()}
      onKeyUp={(e) => e.stopPropagation()}
    >
      {body}
    </div>
  );
}

function Centered({ children }: { children: ReactNode }) {
  return (
    <div className="iv-center" aria-live="polite">
      <div className="iv-card iv-center-card">{children}</div>
    </div>
  );
}

export default InterviewScreen;
