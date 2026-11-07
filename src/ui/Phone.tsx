import { useState } from "react";
import { CONFIG } from "../game/config.ts";
import {
  addSkill,
  balance,
  fmtMoney,
  fmtTime,
  GameState,
  markRead,
  removeSkill,
  renameSkill,
  Result,
  validName,
} from "../game/state.ts";

type Props = {
  game: GameState;
  onChange: (g: GameState) => void;
  onClose: () => void;
};
type Tab = "messages" | "profile" | "wallet" | "jobs";

export function Phone({ game, onChange, onClose }: Props) {
  const [tab, setTab] = useState<Tab>("messages");
  return (
    <div
      className="phone-backdrop"
      onMouseDown={(e) => e.target === e.currentTarget && onClose()}
    >
      <section className="phone" role="dialog" aria-label="Phone">
        <header className="phone-head">
          <span className="mono">{fmtTime(game.minute)}</span>
          <button
            className="icon-btn"
            onClick={onClose}
            aria-label="Close phone"
          >
            ✕
          </button>
        </header>
        <nav className="tabs" role="tablist">
          {(["messages", "profile", "wallet", "jobs"] as Tab[]).map((t) => (
            <button
              key={t}
              role="tab"
              aria-selected={tab === t}
              className={tab === t ? "on" : ""}
              onClick={() => setTab(t)}
            >
              {t[0].toUpperCase() + t.slice(1)}
            </button>
          ))}
        </nav>
        <div className="phone-body">
          {tab === "messages" && <Messages game={game} onChange={onChange} />}
          {tab === "profile" && <Profile game={game} onChange={onChange} />}
          {tab === "wallet" && <Wallet game={game} />}
          {tab === "jobs" && (
            <p className="empty">
              Job invitations aren’t available yet. Companies start contacting
              you in the next build (Phase 2).
            </p>
          )}
        </div>
      </section>
    </div>
  );
}

function Messages({
  game,
  onChange,
}: {
  game: GameState;
  onChange: (g: GameState) => void;
}) {
  return (
    <ul className="list">
      {[...game.messages].reverse().map((m) => (
        <li key={m.id} className={m.read ? "" : "unread"}>
          <button
            className="row"
            onClick={() => !m.read && onChange(markRead(game, m.id))}
          >
            <b>{m.from}</b>
            <span>{m.text}</span>
            {!m.read && <em>New · tap to mark read</em>}
          </button>
        </li>
      ))}
    </ul>
  );
}

function Profile({
  game,
  onChange,
}: {
  game: GameState;
  onChange: (g: GameState) => void;
}) {
  const [draft, setDraft] = useState("");
  const [editing, setEditing] = useState<number | null>(null);
  const [editText, setEditText] = useState("");
  const [name, setName] = useState(game.name);
  const [error, setError] = useState<string>();

  const apply = (r: Result, after?: () => void) => {
    setError(r.error);
    if (!r.error) {
      onChange(r.state);
      after?.();
    }
  };

  const s = CONFIG.start;
  return (
    <div className="profile">
      <form
        className="inline"
        onSubmit={(e) => {
          e.preventDefault();
          const err = validName(name);
          setError(err);
          if (!err) onChange({ ...game, name: name.trim() });
        }}
      >
        <label htmlFor="pname">Name</label>
        <input
          id="pname"
          value={name}
          maxLength={24}
          onChange={(e) => setName(e.target.value)}
        />
        <button className="btn small" disabled={name.trim() === game.name}>
          Save
        </button>
      </form>
      <dl className="facts">
        <dt>Education</dt>
        <dd>{s.education}</dd>
        <dt>Experience</dt>
        <dd>{s.experience}</dd>
        <dt>Work</dt>
        <dd>{s.employment}</dd>
        <dt>Home</dt>
        <dd>{s.home}</dd>
        <dt>Equipment</dt>
        <dd>{s.equipment}</dd>
      </dl>

      <h3>Skills</h3>
      <p className="help">
        Listing a skill on your resume doesn’t make you good at it. Proficiency
        only grows through practice.
      </p>
      <ul className="skills">
        {game.skills.map((k, i) => (
          <li key={k.name}>
            {editing === i ? (
              <form
                className="inline"
                onSubmit={(e) => {
                  e.preventDefault();
                  apply(renameSkill(game, i, editText), () => setEditing(null));
                }}
              >
                <input
                  aria-label={`Rename ${k.name}`}
                  autoFocus
                  value={editText}
                  onChange={(e) => setEditText(e.target.value)}
                />
                <button className="btn small">Save</button>
                <button
                  type="button"
                  className="btn small"
                  onClick={() => setEditing(null)}
                >
                  Cancel
                </button>
              </form>
            ) : (
              <>
                <span className="skill-name">
                  {k.name}
                  {k.source === "claimed" && (
                    <em> · on resume, not yet practised</em>
                  )}
                </span>
                <div
                  className="track"
                  role="meter"
                  aria-label={`${k.name} proficiency`}
                  aria-valuenow={k.proficiency}
                  aria-valuemin={0}
                  aria-valuemax={100}
                >
                  <div style={{ width: `${k.proficiency}%` }} />
                </div>
                <b className="mono">{k.proficiency}</b>
                {k.source === "claimed" && (
                  <span className="skill-actions">
                    <button
                      className="link"
                      onClick={() => {
                        setEditing(i);
                        setEditText(k.name);
                      }}
                    >
                      Rename
                    </button>
                    <button
                      className="link"
                      onClick={() => apply(removeSkill(game, i))}
                    >
                      Remove
                    </button>
                  </span>
                )}
              </>
            )}
          </li>
        ))}
      </ul>
      <form
        className="inline"
        onSubmit={(e) => {
          e.preventDefault();
          apply(addSkill(game, draft), () => setDraft(""));
        }}
      >
        <label htmlFor="newskill" className="sr-only">
          Add a skill
        </label>
        <input
          id="newskill"
          placeholder="Add a skill, e.g. Python"
          value={draft}
          maxLength={30}
          onChange={(e) => setDraft(e.target.value)}
        />
        <button className="btn small primary">Add</button>
      </form>
      {error && (
        <p className="error" role="alert">
          {error}
        </p>
      )}
    </div>
  );
}

function Wallet({ game }: { game: GameState }) {
  return (
    <div className="wallet">
      <p className="help">Balance</p>
      <p className="big">{fmtMoney(balance(game))}</p>
      <p className="help">
        Fictional game money. It can never be bought or cashed out.
      </p>
      <ul className="ledger">
        {[...game.ledger].reverse().map((t) => (
          <li key={t.id}>
            <span>{t.label}</span>
            <span className="mono">
              Day {t.day} · {fmtTime(t.minute)}
            </span>
            <b className={t.amount < 0 ? "neg" : "pos"}>{fmtMoney(t.amount)}</b>
          </li>
        ))}
      </ul>
    </div>
  );
}
