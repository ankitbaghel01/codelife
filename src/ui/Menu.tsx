import { useState } from "react";
import { CONFIG } from "../game/config.ts";
import { validName } from "../game/state.ts";

type Props = {
  hasSave: boolean;
  onContinue: () => void;
  onNewGame: (name: string) => void;
};

export function Menu({ hasSave, onContinue, onNewGame }: Props) {
  const [step, setStep] = useState<"menu" | "name">("menu");
  const [name, setName] = useState("");
  const [error, setError] = useState<string>();

  const start = () => {
    const e = validName(name);
    if (e) return setError(e);
    onNewGame(name.trim());
  };

  return (
    <div className="menu">
      <div className="menu-card">
        <p className="eyebrow">A life simulation · fictional world</p>
        <h1 className="title">{CONFIG.title}</h1>
        {step === "menu" ? (
          <>
            <p className="lede">
              A new city. A small rented room. A basic laptop. A degree, a few
              programming skills, and very little money. Your life starts now.
            </p>
            <div className="menu-actions">
              {hasSave && (
                <button className="btn primary" onClick={onContinue}>
                  Continue
                </button>
              )}
              <button
                className={hasSave ? "btn" : "btn primary"}
                onClick={() => setStep("name")}
              >
                New game
              </button>
              <button className="btn" disabled title="Coming later">
                Settings · coming later
              </button>
            </div>
          </>
        ) : (
          <form
            className="name-form"
            onSubmit={(e) => {
              e.preventDefault();
              start();
            }}
          >
            <label htmlFor="hero-name">What is your name?</label>
            <input
              id="hero-name"
              autoFocus
              value={name}
              maxLength={24}
              onChange={(e) => {
                setName(e.target.value);
                setError(undefined);
              }}
              aria-invalid={!!error}
              aria-describedby="name-help"
            />
            <p id="name-help" className={error ? "error" : "help"}>
              {error ??
                (hasSave
                  ? "Starting a new game replaces your current save."
                  : "You can change it later in your profile.")}
            </p>
            <div className="menu-actions">
              <button type="submit" className="btn primary">
                Start playing
              </button>
              <button
                type="button"
                className="btn"
                onClick={() => setStep("menu")}
              >
                Back
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
}
