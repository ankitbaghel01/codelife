import { useEffect, useState } from "react";
import { CONFIG } from "../game/config.ts";
import {
  fmtMoney,
  fmtTime,
  taskPay,
  tripsWaiting,
  workTasks,
  type GameState,
} from "../game/state.ts";
import { CodeApp } from "../ui/laptop/Code";
import { loadProblems, type Problem } from "../ui/laptop/problems.ts";
import type { Company } from "./companies";
import "../ui/laptop/laptop.css";
import "./world.css";

export type Leave = "home" | "city" | "trip";

type Props = {
  game: GameState;
  company: Company;
  clockIn: number;
  onSolved: (p: Problem) => void;
  onLeave: (to: Leave, unfinished: string[]) => void;
};

/** Your own desk at your company (interviews happen at reception and the interview room instead).
 * Your manager assigns DSA tasks; each one solved is paid, and every few tasks earn a bike trip. */
export function WorkDesk({ game, company, clockIn, onSolved, onLeave }: Props) {
  const [all, setAll] = useState<Problem[]>([]);
  const [open, setOpen] = useState<Problem | null>(null);
  useEffect(() => void loadProblems().then(setAll), []);

  const job = game.job!;
  const ids = workTasks(
    game,
    all.map((p) => p.id),
  );
  const tasks = ids.map((id) => all.find((p) => p.id === id)!).filter(Boolean);
  const isDone = (id: string) => job.tasksDone.some((t) => t.id === id);
  const every = CONFIG.work.tripEveryTasks;
  const towardTrip = job.tasksDone.length % every;
  const trips = tripsWaiting(game);
  const shiftEnd = Math.max(game.minute, clockIn + CONFIG.work.shiftMinutes);
  const isLate = (id: string) => job.carryOver.includes(id);
  const payFor = (p: Problem) => taskPay(p.difficulty, isLate(p.id));
  const unfinished = tasks.filter((p) => !isDone(p.id)).map((p) => p.id);
  const leave = (to: Leave) => onLeave(to, unfinished);

  if (open)
    return (
      <div className="lt workdesk-ide" role="dialog" aria-label="Work task">
        <header className="workdesk-bar">
          <button className="btn" onClick={() => setOpen(null)}>
            ← Back to your desk
          </button>
          <span>
            {isLate(open.id) ? "Late work task" : "Work task"} · pays{" "}
            {fmtMoney(payFor(open))}
          </span>
        </header>
        <CodeApp
          problem={open}
          solved={isDone(open.id)}
          onSolved={() => onSolved(open)}
          onOpenFiles={() => setOpen(null)}
          onShowFolder={() => setOpen(null)}
          onNext={() =>
            setOpen(
              tasks.find((p) => !isDone(p.id) && p.id !== open.id) ?? null,
            )
          }
        />
      </div>
    );

  return (
    <div
      className="reception workdesk"
      role="dialog"
      aria-labelledby="desk-title"
    >
      <div className="reception-card">
        <p className="eyebrow">
          Your desk · {company.name} · Day {game.day}, {fmtTime(game.minute)}
        </p>
        <h2 id="desk-title">{job.title}</h2>
        <p className="workdesk-note">
          Your manager left today's tasks. Each one you solve is paid straight
          into your wallet.
        </p>
        <ul className="workdesk-tasks">
          {tasks.map((p) => (
            <li key={p.id}>
              <button
                className={isDone(p.id) ? "done" : ""}
                onClick={() => setOpen(p)}
              >
                <span>
                  {isDone(p.id) ? "✓ " : ""}
                  {p.title}
                  {isLate(p.id) && !isDone(p.id) && (
                    <span className="workdesk-late">Late · half pay</span>
                  )}
                </span>
                <span className={`badge ${p.difficulty}`}>{p.difficulty}</span>
                <span className="workdesk-pay">
                  {isDone(p.id)
                    ? "Paid"
                    : fmtMoney(payFor(p))}
                </span>
              </button>
            </li>
          ))}
          {all.length > 0 && tasks.length === 0 && (
            <li className="workdesk-note">
              You've solved every task the team has. Great work!
            </li>
          )}
        </ul>
        <div className="workdesk-trip">
          {trips > 0 ? (
            <p>
              🏍️ <b>Your bike trip to Mistgiri Hills is ready!</b> The company
              is treating you for solving {job.tasksDone.length} tasks.
            </p>
          ) : (
            <>
              <p>
                Solve {every - towardTrip} more task
                {every - towardTrip === 1 ? "" : "s"} and the company sends you
                on a <b>bike trip to Mistgiri Hills</b>.
              </p>
              <div
                className="workdesk-meter"
                role="progressbar"
                aria-valuemin={0}
                aria-valuemax={every}
                aria-valuenow={towardTrip}
              >
                <span style={{ width: `${(towardTrip / every) * 100}%` }} />
              </div>
              <p className="workdesk-note">
                {towardTrip} of {every} tasks
              </p>
            </>
          )}
        </div>
        {job.absentDays.length > 0 && (
          <p className="workdesk-warn">
            Absent this month: {job.absentDays.length} day
            {job.absentDays.length === 1 ? "" : "s"} (Day{" "}
            {job.absentDays.join(", ")}). Absent days are unpaid.
          </p>
        )}
        {unfinished.length > 0 && (
          <p className="workdesk-warn">
            {unfinished.length === 1
              ? "1 task is unfinished. If you leave now, it moves"
              : `${unfinished.length} tasks are unfinished. If you leave now, they move`}{" "}
            to your next workday at {Math.round(CONFIG.work.latePayRate * 100)}% pay.
          </p>
        )}
        <p className="workdesk-note">
          {game.minute < shiftEnd
            ? `Your shift ends at ${fmtTime(shiftEnd)}. Leaving finishes the shift.`
            : "Your shift is over. Leave whenever you like."}
        </p>
        <div className="reception-actions">
          {trips > 0 && (
            <button className="btn primary" onClick={() => leave("trip")}>
              Finish the shift and go on the bike trip
            </button>
          )}
          <button
            className={trips > 0 ? "btn" : "btn primary"}
            onClick={() => leave("home")}
          >
            Finish the shift and go home
          </button>
          <button className="btn" onClick={() => leave("city")}>
            Finish the shift and open the city map
          </button>
        </div>
      </div>
    </div>
  );
}
