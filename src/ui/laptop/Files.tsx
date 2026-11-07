import { useEffect, useRef, useState, type KeyboardEvent } from "react";
import * as I from "./icons";
import {
  FOLDERS,
  fileName,
  folderOf,
  loadProblems,
  topicName,
  topicsIn,
  type Problem,
} from "./problems.ts";

type Path = string[]; // [] = Practice, [folder], [folder, topic]
type Item = {
  key: string;
  kind: "folder" | "file";
  name: string;
  title?: string;
  problem?: Problem;
  meta: string;
  solved?: boolean;
};

const ROOT = "Practice";
const folderName = (id: string) => FOLDERS.find((f) => f.id === id)?.name ?? id;

export function FilesApp({
  solved,
  onOpen,
  reveal,
}: {
  solved: string[];
  onOpen: (p: Problem) => void;
  /** Jump to a problem's folder (from Code's "Back to folder"); a new object each time. */
  reveal?: { problem: Problem };
}) {
  const [problems, setProblems] = useState<Problem[] | null>(null);
  const [failed, setFailed] = useState(false);
  const [path, setPath] = useState<Path>([]);
  const [back, setBack] = useState<Path[]>([]);
  const [sel, setSel] = useState(0);
  const [view, setView] = useState<"grid" | "details">("details");
  const [expanded, setExpanded] = useState<string[]>(["basics"]);
  const listRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    loadProblems()
      .then(setProblems)
      .catch(() => setFailed(true));
  }, []);

  const inTopic = (f: string, t: string) =>
    (problems ?? []).filter((p) => folderOf(p) === f && p.topic === t);
  const inFolder = (f: string) =>
    (problems ?? []).filter((p) => folderOf(p) === f);
  const solvedCount = (ps: Problem[]) =>
    ps.filter((p) => solved.includes(p.id)).length;
  const countLabel = (ps: Problem[]) =>
    ps.length
      ? `${ps.length} problem${ps.length > 1 ? "s" : ""} · ${solvedCount(ps)} solved`
      : "Empty";

  const items: Item[] = !problems
    ? []
    : path.length === 0
      ? FOLDERS.map((f) => ({
          key: f.id,
          kind: "folder" as const,
          name: f.name,
          meta: countLabel(inFolder(f.id)),
        }))
      : path.length === 1
        ? topicsIn(path[0], problems).map((t) => ({
            key: t,
            kind: "folder" as const,
            name: topicName(t),
            meta: countLabel(inTopic(path[0], t)),
          }))
        : inTopic(path[0], path[1]).map((p) => ({
            key: p.id,
            kind: "file" as const,
            name: fileName(p),
            title: p.title,
            problem: p,
            meta: p.difficulty,
            solved: solved.includes(p.id),
          }));

  const go = (next: Path) => {
    if (next[0]) setExpanded((x) => (x.includes(next[0]) ? x : [...x, next[0]]));
    setBack((b) => [...b, path]);
    setPath(next);
    setSel(0);
  };
  const up = () => path.length && go(path.slice(0, -1));
  const goBack = () => {
    if (!back.length) return;
    setPath(back[back.length - 1]);
    setBack((b) => b.slice(0, -1));
    setSel(0);
  };
  const open = (it: Item) =>
    it.problem ? onOpen(it.problem) : go([...path, it.key]);

  useEffect(() => {
    if (!reveal || !problems) return;
    const p = reveal.problem;
    go([folderOf(p), p.topic]);
    setSel(Math.max(0, inTopic(folderOf(p), p.topic).indexOf(p)));
    window.setTimeout(() => listRef.current?.focus());
  }, [reveal, problems]);

  useEffect(() => {
    listRef.current
      ?.querySelector(`[data-i="${sel}"]`)
      ?.scrollIntoView({ block: "nearest" });
  }, [sel, path]);

  const onKey = (e: KeyboardEvent) => {
    const cols =
      view === "grid" && listRef.current
        ? getComputedStyle(listRef.current).gridTemplateColumns.split(" ")
            .length
        : 1;
    const last = items.length - 1;
    const move: Record<string, number> = {
      ArrowDown: cols,
      ArrowUp: -cols,
      ...(view === "grid" ? { ArrowRight: 1, ArrowLeft: -1 } : {}),
    };
    if (e.altKey && e.key === "ArrowUp") up();
    else if (e.altKey && e.key === "ArrowLeft") goBack();
    else if (e.key in move)
      setSel((s) => Math.max(0, Math.min(last, s + move[e.key])));
    else if (e.key === "Home") setSel(0);
    else if (e.key === "End") setSel(last);
    else if (e.key === "Enter" && items[sel]) open(items[sel]);
    else if (e.key === "Backspace") up();
    else return;
    e.preventDefault();
  };

  const crumbs = [
    ROOT,
    ...path.map((p, i) => (i === 0 ? folderName(p) : topicName(p))),
  ];
  const here = crumbs[crumbs.length - 1];
  const totalSolved = items.filter((i) => i.solved).length;

  return (
    <div className="fx">
      <div className="fx-toolbar">
        <button
          className="fx-tool"
          aria-label="Back"
          title="Back (Alt+Left)"
          disabled={!back.length}
          onClick={goBack}
        >
          <I.Back />
        </button>
        <button
          className="fx-tool"
          aria-label="Up one folder"
          title="Up (Alt+Up)"
          disabled={!path.length}
          onClick={up}
        >
          <I.Up />
        </button>
        <nav className="fx-crumbs" aria-label="Path">
          {crumbs.map((c, i) => (
            <span key={i} className="fx-crumb">
              {i > 0 && (
                <span className="fx-sep" aria-hidden="true">
                  <I.Chevron />
                </span>
              )}
              {i === crumbs.length - 1 ? (
                <span aria-current="location">{c}</span>
              ) : (
                <button onClick={() => go(path.slice(0, i))}>{c}</button>
              )}
            </span>
          ))}
        </nav>
        <div className="fx-views" role="group" aria-label="View">
          <button
            className="fx-tool"
            aria-label="Icon view"
            aria-pressed={view === "grid"}
            onClick={() => setView("grid")}
          >
            <I.Grid />
          </button>
          <button
            className="fx-tool"
            aria-label="Details view"
            aria-pressed={view === "details"}
            onClick={() => setView("details")}
          >
            <I.Rows />
          </button>
        </div>
      </div>

      <div className="fx-split">
        <nav className="fx-side" aria-label="Folders">
          <p className="fx-side-head">Locations</p>
          <button
            className={`fx-node root${path.length === 0 ? " on" : ""}`}
            onClick={() => go([])}
          >
            <I.FolderGlyph size={16} open />
            <span>{ROOT}</span>
          </button>
          {FOLDERS.map((f) => {
            const isOpen = expanded.includes(f.id);
            return (
              <div key={f.id}>
                <div className="fx-node-row">
                  <button
                    className="fx-twisty"
                    aria-label={`${isOpen ? "Collapse" : "Expand"} ${f.name}`}
                    aria-expanded={isOpen}
                    onClick={() =>
                      setExpanded((x) =>
                        isOpen ? x.filter((y) => y !== f.id) : [...x, f.id],
                      )
                    }
                  >
                    <I.Chevron open={isOpen} />
                  </button>
                  <button
                    className={`fx-node${path.length === 1 && path[0] === f.id ? " on" : ""}`}
                    onClick={() => go([f.id])}
                  >
                    <I.FolderGlyph size={16} open={isOpen} />
                    <span>{f.name}</span>
                  </button>
                </div>
                {isOpen && problems && (
                  <div className="fx-children">
                    {topicsIn(f.id, problems).map((t) => (
                      <button
                        key={t}
                        className={`fx-node leaf${path[0] === f.id && path[1] === t ? " on" : ""}`}
                        onClick={() => go([f.id, t])}
                      >
                        <I.FolderGlyph size={14} />
                        <span>{topicName(t)}</span>
                        <em>{inTopic(f.id, t).length || ""}</em>
                      </button>
                    ))}
                  </div>
                )}
              </div>
            );
          })}
        </nav>

        <div className="fx-main">
          {failed ? (
            <div className="fx-empty">
              <p>Couldn’t read the problem files.</p>
              <p className="fx-muted">
                Close Files and open it again to retry.
              </p>
            </div>
          ) : !problems ? (
            <div className="fx-empty">
              <span className="spin" aria-hidden="true" /> Reading files…
            </div>
          ) : !items.length ? (
            <div className="fx-empty">
              <I.FolderGlyph size={56} open />
              <p>This folder is empty</p>
              <p className="fx-muted">
                No {here} problems are on this laptop yet.
              </p>
            </div>
          ) : (
            <>
              {view === "details" && (
                <div className="fx-head" aria-hidden="true">
                  <span>Name</span>
                  <span>{path.length === 2 ? "Title" : ""}</span>
                  <span>{path.length === 2 ? "Difficulty" : "Contents"}</span>
                  <span>{path.length === 2 ? "Status" : "Kind"}</span>
                </div>
              )}
              <div
                ref={listRef}
                className={`fx-list ${view}`}
                role="listbox"
                tabIndex={0}
                aria-label={`${here} contents`}
                aria-activedescendant={
                  items[sel] ? `fx-${items[sel].key}` : undefined
                }
                onKeyDown={onKey}
              >
                {items.map((it, i) => (
                  <div
                    key={it.key}
                    id={`fx-${it.key}`}
                    data-i={i}
                    role="option"
                    title={it.title ? `${it.name} — ${it.title}` : it.name}
                    aria-selected={i === sel}
                    aria-label={
                      it.kind === "file"
                        ? `${it.name}, ${it.title}, ${it.meta}${it.solved ? ", solved" : ""}`
                        : `${it.name} folder, ${it.meta}`
                    }
                    className={`fx-item${i === sel ? " sel" : ""}`}
                    onClick={() => setSel(i)}
                    onDoubleClick={() => open(it)}
                  >
                    <span className="fx-name">
                      {it.kind === "folder" ? (
                        <I.FolderGlyph size={view === "grid" ? 48 : 18} />
                      ) : (
                        <I.PyFile size={view === "grid" ? 48 : 18} />
                      )}
                      <span className="fx-label">{it.name}</span>
                      {it.solved && (
                        <span className="fx-solved" title="Solved">
                          <I.Check size={12} />
                        </span>
                      )}
                    </span>
                    {it.kind === "file" ? (
                      <>
                        <span className="fx-title">{it.title}</span>
                        <span>
                          <span className={`badge ${it.meta}`}>{it.meta}</span>
                        </span>
                        <span className={`fx-status${it.solved ? " ok" : ""}`}>
                          {it.solved ? "Solved" : "Not solved"}
                        </span>
                      </>
                    ) : (
                      <>
                        <span className="fx-title" />
                        <span className="fx-muted">{it.meta}</span>
                        <span className="fx-muted">Folder</span>
                      </>
                    )}
                  </div>
                ))}
              </div>
            </>
          )}
        </div>
      </div>

      <footer className="fx-status-bar">
        <span>
          {items.length} item{items.length === 1 ? "" : "s"}
          {path.length === 2 && ` · ${totalSolved} solved`}
        </span>
        <span className="fx-muted">
          {path.length === 2
            ? "Double-click or press Enter to open in Code"
            : "Double-click or press Enter to open"}
        </span>
      </footer>
    </div>
  );
}
