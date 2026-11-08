import { useEffect, useRef } from "react";
import { fmtTime } from "../game/state.ts";
import type { Company } from "./companies";
import "./world.css";

type Props = {
  company: Company;
  time: number; // interview slot, game minutes
  onCheckIn: () => void;
  onLeave: () => void;
};

/** The receptionist's greeting before the interview room. */
export function Reception({ company, time, onCheckIn, onLeave }: Props) {
  const first = useRef<HTMLButtonElement>(null);
  useEffect(() => first.current?.focus(), []);
  return (
    <div
      className="reception"
      role="dialog"
      aria-modal="true"
      aria-labelledby="reception-title"
    >
      <div className="reception-card">
        <p className="eyebrow">Reception · {company.name}</p>
        <h2 id="reception-title" className="sr-only">
          Reception
        </h2>
        <p className="reception-line">
          “Welcome to {company.name}. You're here for the {fmtTime(time)}{" "}
          interview with {company.interviewer.name}? Please have a seat —
          they'll call you in a moment.”
        </p>
        <div className="reception-actions">
          <button ref={first} className="btn primary" onClick={onCheckIn}>
            Check in
          </button>
          <button className="btn" onClick={onLeave}>
            Leave
          </button>
        </div>
      </div>
    </div>
  );
}
