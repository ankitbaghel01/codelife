import { useEffect, useRef, useState } from "react";
import type { ChatMessage, InterviewView } from "../../api/types";
import { Confirm } from "./Confirm";
import { initials, kindLabel } from "./shared";

const MAX = 2000;

type Props = {
  view: InterviewView;
  companyName: string;
  finishing: boolean;
  finishError: string | null;
  onSend: (text: string) => Promise<void>;
  onOpenIde: () => void;
  onFinish: () => void;
  onLeave: () => void;
};

export function Conversation({
  view,
  companyName,
  finishing,
  finishError,
  onSend,
  onOpenIde,
  onFinish,
  onLeave,
}: Props) {
  const [text, setText] = useState("");
  const [pending, setPending] = useState<string | null>(null); // the answer in flight, shown before the server echoes it
  const [error, setError] = useState<string | null>(null);
  const [confirmLeave, setConfirmLeave] = useState(false);
  const logRef = useRef<HTMLDivElement>(null);
  const boxRef = useRef<HTMLTextAreaElement>(null);
  const sending = pending !== null;
  const coding = view.status === "coding";

  useEffect(() => {
    const el = logRef.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [view.messages.length, pending]);

  useEffect(() => {
    if (!sending && !coding) boxRef.current?.focus();
  }, [sending, coding]);

  const send = async () => {
    if (sending) return;
    const t = text.trim();
    if (!t) {
      setError(
        "Type an answer before sending. The interviewer is waiting for your reply.",
      );
      return;
    }
    setError(null);
    setPending(t);
    setText("");
    try {
      await onSend(t);
    } catch (e) {
      setText(t); // give the answer back so nothing typed is lost
      setError((e as Error).message);
    } finally {
      setPending(null);
    }
  };

  const { interviewer, round, question } = view;
  const done = question.kind === "done";
  const showFinish =
    !coding && (done || !question.mandatory || finishError !== null);

  return (
    <div className="iv-room">
      <aside className="iv-side" aria-label="Interview details">
        <div className="iv-interviewer">
          <div className="iv-avatar" aria-hidden="true">
            {initials(interviewer.name)}
          </div>
          <div>
            <p className="iv-name">{interviewer.name}</p>
            <p className="iv-muted">
              {interviewer.title} · {companyName}
            </p>
            <p
              className="iv-provider"
              title={
                view.aiProvider === "claude"
                  ? "Questions are written by an AI model. Scores for code come only from running it."
                  : "Questions come from a fixed script. Scores for code come only from running it."
              }
            >
              {view.aiProvider === "claude"
                ? "AI interviewer"
                : "Scripted interviewer"}
            </p>
          </div>
        </div>

        <section className="iv-progress" aria-label="Progress">
          <p className="iv-eyebrow">
            Round {round.index + 1} of {round.total}
          </p>
          <p className="iv-progress-line">
            {done
              ? "All questions answered"
              : `${round.name} · Question ${question.index + 1} of ${question.total}`}
          </p>
          <ol className="iv-steps" aria-hidden="true">
            {Array.from({ length: question.total }, (_, i) => (
              <li
                key={i}
                className={
                  i < question.index
                    ? "done"
                    : i === question.index
                      ? "now"
                      : ""
                }
              />
            ))}
          </ol>
          {!done && (
          <p className="iv-tags">
            <span className="iv-tag">
              {kindLabel[question.kind] ?? question.kind}
            </span>
            {question.mandatory ? (
              <span className="iv-tag gold">Mandatory</span>
            ) : (
              <span className="iv-tag">Optional</span>
            )}
          </p>
          )}
        </section>

        <div className="iv-side-foot">
          {showFinish && (
            <button className="iv-btn" onClick={onFinish} disabled={finishing}>
              {finishing ? (
                <span className="iv-spin sm" aria-hidden="true" />
              ) : null}
              {finishing ? "Wrapping up…" : "Finish interview"}
            </button>
          )}
          <button
            className="iv-btn ghost"
            onClick={() => setConfirmLeave(true)}
          >
            Leave interview
          </button>
        </div>
      </aside>

      <main className="iv-talk">
        <div
          className="iv-log"
          ref={logRef}
          role="log"
          aria-label="Conversation"
          aria-live="polite"
        >
          {view.messages.length === 0 && !pending && (
            <p className="iv-empty">The interviewer is getting ready…</p>
          )}
          {view.messages.map((m) => (
            <Message key={m.id} m={m} interviewer={interviewer.name} />
          ))}
          {pending && (
            <Message
              m={{ id: "pending", speaker: "player", text: pending, at: "" }}
              interviewer={interviewer.name}
            />
          )}
          {(sending || finishing) && (
            <p className="iv-thinking" role="status">
              <span className="iv-dots" aria-hidden="true">
                <i />
                <i />
                <i />
              </span>
              {finishing
                ? `${interviewer.name} is writing up the result…`
                : `${interviewer.name} is thinking…`}
            </p>
          )}
        </div>

        {finishError && (
          <div className="iv-alert" role="alert">
            <b>You can't finish yet.</b> {finishError}
          </div>
        )}

        {coding && (
          <div className="iv-coding-banner">
            <p>
              <b>A coding problem is open on your screen.</b> Only Submit in the
              editor closes it. You can explain your approach here meanwhile.
            </p>
            <button className="iv-btn primary" autoFocus onClick={onOpenIde}>
              Return to the editor
            </button>
          </div>
        )}
        {done ? null : (
          <form
            className="iv-compose"
            onSubmit={(e) => {
              e.preventDefault();
              void send();
            }}
          >
            <label htmlFor="iv-answer" className="sr-only">
              Your answer
            </label>
            <textarea
              id="iv-answer"
              ref={boxRef}
              value={text}
              maxLength={MAX}
              rows={3}
              disabled={sending || finishing}
              placeholder={
                coding
                  ? "Optional: explain your approach to the interviewer…"
                  : "Type your answer…"
              }
              aria-describedby="iv-answer-help"
              aria-invalid={error ? true : undefined}
              onChange={(e) => {
                setText(e.target.value);
                if (error) setError(null);
              }}
              onKeyDown={(e) => {
                if (
                  e.key === "Enter" &&
                  !e.shiftKey &&
                  !e.nativeEvent.isComposing
                ) {
                  e.preventDefault();
                  void send();
                }
              }}
            />
            <div className="iv-compose-foot">
              <span
                id="iv-answer-help"
                className={error ? "iv-error" : "iv-muted"}
                role={error ? "alert" : undefined}
              >
                {error ?? (
                  <>
                    <kbd>Enter</kbd> to send · <kbd>Shift</kbd>+<kbd>Enter</kbd>{" "}
                    for a new line
                  </>
                )}
              </span>
              <span
                className={`iv-count${text.length >= MAX ? " full" : ""}`}
                aria-live="polite"
              >
                {text.length.toLocaleString("en-IN")}/
                {MAX.toLocaleString("en-IN")}
              </span>
              <button
                className="iv-btn primary"
                type="submit"
                disabled={sending || finishing}
                aria-busy={sending}
              >
                {sending ? (
                  <span className="iv-spin sm dark" aria-hidden="true" />
                ) : null}
                {sending ? "Sending…" : "Send"}
              </button>
            </div>
          </form>
        )}
      </main>

      {confirmLeave && (
        <Confirm
          title="Leave the interview?"
          confirmLabel="Leave for now"
          cancelLabel="Stay"
          onCancel={() => setConfirmLeave(false)}
          onConfirm={onLeave}
        >
          <p>
            Your answers so far are saved. You can come back to {companyName}{" "}
            with the same invitation and pick up from this question.
          </p>
        </Confirm>
      )}
    </div>
  );
}

function Message({ m, interviewer }: { m: ChatMessage; interviewer: string }) {
  if (m.speaker === "system")
    return (
      <p className="iv-msg system">
        <span className="sr-only">System: </span>
        {m.text}
      </p>
    );
  const me = m.speaker === "player";
  return (
    <div className={`iv-msg ${me ? "me" : "them"}`}>
      <span className="iv-msg-who">{me ? "You" : interviewer}</span>
      <p className="iv-msg-text">{m.text}</p>
    </div>
  );
}
