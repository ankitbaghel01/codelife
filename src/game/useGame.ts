import { useCallback, useEffect, useState } from "react";
import { GameState, parseSave } from "./state.ts";

// shortcut: saves live in this browser's localStorage; moves to the backend save service in Phase 2.
const KEY = "codelife.save.v1";

function read(): GameState | null {
  try {
    return parseSave(localStorage.getItem(KEY));
  } catch {
    return null;
  }
}

export function useGame() {
  const [game, setGame] = useState<GameState | null>(read);

  useEffect(() => {
    if (!game) return;
    try {
      localStorage.setItem(KEY, JSON.stringify(game));
    } catch {
      /* storage blocked: the game keeps running, it just won't survive a reload */
    }
  }, [game]);

  const update = useCallback(
    (fn: (g: GameState) => GameState) => setGame((g) => (g ? fn(g) : g)),
    [],
  );

  return { game, setGame, update, hasSave: read() !== null };
}
