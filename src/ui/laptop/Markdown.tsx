// Tiny, safe markdown for problem statements: paragraphs, fenced code, `inline code` and **bold**.
// Everything renders as React text nodes; problem text never reaches innerHTML.
import type { ReactNode } from "react";

function inline(text: string): ReactNode[] {
  // Split keeps the delimited tokens at odd indexes.
  return text.split(/(`[^`]+`|\*\*[^*]+\*\*)/g).map((part, i) => {
    if (i % 2 === 0) return part;
    if (part.startsWith("`")) return <code key={i}>{part.slice(1, -1)}</code>;
    return <strong key={i}>{part.slice(2, -2)}</strong>;
  });
}

export function Markdown({ text }: { text: string }) {
  const blocks = text.split(/```[^\n]*\n([\s\S]*?)```/g);
  return (
    <>
      {blocks.flatMap((block, i) =>
        i % 2 === 1
          ? [<pre key={i}>{block.replace(/\n$/, "")}</pre>]
          : block
              .split(/\n\s*\n/)
              .filter((p) => p.trim())
              .map((p, j) => <p key={`${i}-${j}`}>{inline(p.trim())}</p>),
      )}
    </>
  );
}

/** Python-style repr for test values, so `None`/`True` read like the language the player writes. */
export function py(v: unknown): string {
  if (v === null || v === undefined) return "None";
  if (v === true) return "True";
  if (v === false) return "False";
  if (typeof v === "string") {
    const body = JSON.stringify(v).slice(1, -1).replace(/\\"/g, '"');
    return body.includes("'") && !body.includes('"')
      ? `"${body}"`
      : `'${body.replace(/'/g, "\\'")}'`;
  }
  if (Array.isArray(v)) return `[${v.map(py).join(", ")}]`;
  if (typeof v === "object")
    return `{${Object.entries(v as object)
      .map(([k, x]) => `${py(k)}: ${py(x)}`)
      .join(", ")}}`;
  return String(v);
}
