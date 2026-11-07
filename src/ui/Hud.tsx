import { INTERACTABLES } from "../game/layout";
import { balance, fmtMoney, fmtTime, GameState } from "../game/state.ts";

type Props = {
  game: GameState;
  near: string | null;
  subtitle: string | null;
  thirdPerson: boolean;
};

function Meter({
  label,
  value,
  warnHigh,
}: {
  label: string;
  value: number;
  warnHigh?: boolean;
}) {
  const warn = warnHigh ? value >= 75 : value <= 25;
  return (
    <div className={`meter ${warn ? "warn" : ""}`}>
      <span>{label}</span>
      <div
        className="track"
        role="meter"
        aria-label={label}
        aria-valuenow={Math.round(value)}
        aria-valuemin={0}
        aria-valuemax={100}
      >
        <div style={{ width: `${value}%` }} />
      </div>
      <b>{Math.round(value)}</b>
    </div>
  );
}

export function Hud({ game, near, subtitle, thirdPerson }: Props) {
  const item = INTERACTABLES.find((i) => i.id === near);
  const unread = game.messages.filter((m) => !m.read).length;
  return (
    <div className="hud" aria-live="polite">
      <div className="hud-top">
        <p className="pill mono">
          DAY {game.day} · {fmtTime(game.minute)}
        </p>
        <p className="pill">{fmtMoney(balance(game))}</p>
      </div>
      {!thirdPerson && <div className="dot" />}
      {item && (
        <p className="prompt">
          <kbd>E</kbd> {item.label}
        </p>
      )}
      {subtitle && <p className="subtitle">{subtitle}</p>}
      <div className="hud-bottom">
        <div className="meters">
          <Meter label="Energy" value={game.energy} />
          <Meter label="Hunger" value={game.hunger} warnHigh />
        </div>
        <p className="keys">
          <kbd>WASD</kbd> move · <kbd>E</kbd> interact · <kbd>P</kbd> phone
          {unread ? ` (${unread} new)` : ""} · <kbd>V</kbd> camera ·{" "}
          <kbd>Esc</kbd> pause
        </p>
      </div>
    </div>
  );
}
