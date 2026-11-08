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
  respondInvitation,
  Result,
  setResume,
  validName,
  findCompany,
  findRole,
  canAttend,
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
          {tab === "profile" && (
            <>
              <Profile game={game} onChange={onChange} />
              <ResumeEditor game={game} onChange={onChange} />
            </>
          )}
          {tab === "wallet" && <Wallet game={game} />}
          {tab === "jobs" && <Jobs game={game} onChange={onChange} />}
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
        <dd>{game.job ? `${game.job.title}, ${findCompany(game.job.companyId)?.name}` : s.employment}</dd>
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
const STATUS: Record<string, string> = {
  pending: "Waiting for your reply",
  accepted: "Accepted",
  declined: "Declined",
  expired: "Missed",
  attended: "Interview done",
};

function Jobs({
  game,
  onChange,
}: {
  game: GameState;
  onChange: (g: GameState) => void;
}) {
  const [error, setError] = useState<string>();
  const list = [...game.invitations].reverse();
  const j = game.job;
  const reply = (id: string, accept: boolean) => {
    const res = respondInvitation(game, id, accept);
    setError(res.error);
    if (!res.error) onChange(res.state);
  };
  return (
    <div className="jobs">
      {j && (
        <article className="job-card current">
          <p className="help">Your job</p>
          <b>{j.title}</b>
          <span>
            {findCompany(j.companyId)?.name} · {fmtMoney(j.monthlySalary)}/month
          </span>
          <span className="help">
            {game.day < j.startDay
              ? `You start on Day ${j.startDay}. Go to work from the city map (front door), 09:00–17:00.`
              : `Go to work from the city map (front door), 09:00–17:00. Days worked this month: ${j.daysWorked}.`}
          </span>
        </article>
      )}
      {list.length === 0 && (
        <p className="empty">
          No invitations yet. Practise on your laptop to improve your skills:
          companies contact you when your profile meets their requirements.
        </p>
      )}
      <ul className="list">
        {list.map((v) => {
          const c = findCompany(v.companyId);
          const r = findRole(v.companyId, v.roleId);
          const why = canAttend(game, v);
          return (
            <li key={v.id} className="job-card">
              <b>
                {r?.title} · {c?.name}
              </b>
              <span>
                ₹{r?.packageLpa} LPA · {r?.workMode} · {c?.tier}
              </span>
              <span className="help">{c?.about}</span>
              <span>
                Interview: Day {v.day}, {fmtTime(v.time)} · {c?.location}
              </span>
              <span className="help">
                Rounds: {r?.rounds.map((x) => x.name).join(" → ")}
              </span>
              <em className={`status ${v.status}`}>{STATUS[v.status]}</em>
              {v.status === "pending" && (
                <span className="actions">
                  <button
                    className="btn small primary"
                    onClick={() => reply(v.id, true)}
                  >
                    Accept
                  </button>
                  <button
                    className="btn small"
                    onClick={() => reply(v.id, false)}
                  >
                    Decline
                  </button>
                </span>
              )}
              {v.status === "accepted" && (
                <span className="help">
                  {why ??
                    "You can go now: use the front door to open the city map."}
                </span>
              )}
            </li>
          );
        })}
      </ul>
      {error && (
        <p className="error" role="alert">
          {error}
        </p>
      )}
      <p className="help">
        Fictional companies. These are not real job offers.
      </p>
    </div>
  );
}

function ResumeEditor({
  game,
  onChange,
}: {
  game: GameState;
  onChange: (g: GameState) => void;
}) {
  const [summary, setSummary] = useState(game.resume.summary);
  const [projects, setProjects] = useState(game.resume.projects);
  const [error, setError] = useState<string>();
  const [saved, setSaved] = useState(false);
  const edit = (next: typeof projects) => {
    setProjects(next);
    setSaved(false);
  };
  const save = () => {
    const r = setResume(game, { summary, projects });
    setError(r.error);
    setSaved(!r.error);
    if (!r.error) onChange(r.state);
  };
  return (
    <section className="resume" aria-label="Resume">
      <h3>Resume</h3>
      <p className="help">
        Interviewers read this. They will ask about your projects and the skills
        you list.
      </p>
      <label htmlFor="rsummary">Summary</label>
      <textarea
        id="rsummary"
        rows={3}
        maxLength={400}
        value={summary}
        onChange={(e) => {
          setSummary(e.target.value);
          setSaved(false);
        }}
        placeholder="e.g. Computer science graduate who enjoys building web apps."
      />
      {projects.map((p, i) => (
        <fieldset key={i} className="project">
          <legend>Project {i + 1}</legend>
          <input
            aria-label={`Project ${i + 1} name`}
            placeholder="Name"
            maxLength={60}
            value={p.name}
            onChange={(e) =>
              edit(
                projects.map((x, j) =>
                  j === i ? { ...x, name: e.target.value } : x,
                ),
              )
            }
          />
          <textarea
            aria-label={`Project ${i + 1} description`}
            placeholder="What did you build, with what, and what did you learn?"
            rows={2}
            maxLength={300}
            value={p.description}
            onChange={(e) =>
              edit(
                projects.map((x, j) =>
                  j === i ? { ...x, description: e.target.value } : x,
                ),
              )
            }
          />
          <button
            className="link"
            onClick={() => edit(projects.filter((_, j) => j !== i))}
          >
            Remove project
          </button>
        </fieldset>
      ))}
      <span className="actions">
        <button
          className="btn small"
          disabled={projects.length >= 5}
          onClick={() => edit([...projects, { name: "", description: "" }])}
        >
          Add project
        </button>
        <button className="btn small primary" onClick={save}>
          Save resume
        </button>
      </span>
      {error && (
        <p className="error" role="alert">
          {error}
        </p>
      )}
      {saved && <p className="help">Resume saved.</p>}
    </section>
  );
}
