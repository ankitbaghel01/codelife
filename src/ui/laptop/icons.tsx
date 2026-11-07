// Inline SVG icons for ByteOS. Stroke icons inherit currentColor; app icons carry their own colour tiles.
import type { ReactNode } from "react";

const S = ({ children, size = 16 }: { children: ReactNode; size?: number }) => (
  <svg
    width={size}
    height={size}
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth={2}
    strokeLinecap="round"
    strokeLinejoin="round"
    aria-hidden="true"
  >
    {children}
  </svg>
);

export const Wifi = () => (
  <S>
    <path d="M2 8.5a15 15 0 0 1 20 0" />
    <path d="M5 12a10 10 0 0 1 14 0" />
    <path d="M8.5 15.5a5 5 0 0 1 7 0" />
    <circle cx="12" cy="19" r="1" fill="currentColor" />
  </S>
);
export const Battery = () => (
  <svg width="24" height="14" viewBox="0 0 26 14" aria-hidden="true">
    <rect
      x="0.75"
      y="0.75"
      width="21.5"
      height="12.5"
      rx="3.5"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.5"
      opacity="0.7"
    />
    <rect x="3" y="3" width="13" height="8" rx="1.5" fill="currentColor" />
    <path
      d="M24 5v4"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      opacity="0.7"
    />
  </svg>
);
export const Logo = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" aria-hidden="true">
    <rect x="2" y="2" width="20" height="20" rx="6" fill="#f2b544" />
    <path
      d="M8 8l-3 4 3 4M16 8l3 4-3 4"
      fill="none"
      stroke="#14110f"
      strokeWidth="2.4"
      strokeLinecap="round"
      strokeLinejoin="round"
    />
  </svg>
);
export const Close = () => (
  <S size={12}>
    <path d="M6 6l12 12M18 6L6 18" />
  </S>
);
export const Minimise = () => (
  <S size={12}>
    <path d="M5 12h14" />
  </S>
);
export const Maximise = () => (
  <S size={12}>
    <rect x="5" y="5" width="14" height="14" rx="2" />
  </S>
);
export const Chevron = ({ open }: { open?: boolean }) => (
  <svg
    width="10"
    height="10"
    viewBox="0 0 24 24"
    aria-hidden="true"
    style={{
      transform: open ? "rotate(90deg)" : undefined,
      transition: "transform 120ms ease-out",
    }}
  >
    <path
      d="M9 5l7 7-7 7"
      fill="none"
      stroke="currentColor"
      strokeWidth="3"
      strokeLinecap="round"
      strokeLinejoin="round"
    />
  </svg>
);
export const Back = () => (
  <S>
    <path d="M15 5l-7 7 7 7" />
  </S>
);
export const Up = () => (
  <S>
    <path d="M12 19V5M5 12l7-7 7 7" />
  </S>
);
export const Grid = () => (
  <S>
    <rect x="4" y="4" width="6" height="6" rx="1" />
    <rect x="14" y="4" width="6" height="6" rx="1" />
    <rect x="4" y="14" width="6" height="6" rx="1" />
    <rect x="14" y="14" width="6" height="6" rx="1" />
  </S>
);
export const Rows = () => (
  <S>
    <path d="M4 6h16M4 12h16M4 18h16" />
  </S>
);
export const Check = ({ size = 14 }: { size?: number }) => (
  <S size={size}>
    <path d="M5 12.5l4.5 4.5L19 7" />
  </S>
);
export const Cross = ({ size = 14 }: { size?: number }) => (
  <S size={size}>
    <path d="M7 7l10 10M17 7L7 17" />
  </S>
);
export const Play = () => (
  <svg width="12" height="12" viewBox="0 0 24 24" aria-hidden="true">
    <path d="M7 4.5v15l12.5-7.5z" fill="currentColor" />
  </svg>
);
export const Send = () => (
  <S size={14}>
    <path d="M12 19V6M6 11l6-6 6 6" />
  </S>
);
export const Reset = () => (
  <S size={14}>
    <path d="M4 12a8 8 0 1 0 2.5-5.8" />
    <path d="M4 4v4h4" />
  </S>
);
export const Lock = () => (
  <S size={12}>
    <rect x="5" y="11" width="14" height="9" rx="2" />
    <path d="M8 11V8a4 4 0 0 1 8 0v3" />
  </S>
);

/** Small folder glyph used in the file tree and lists. */
export const FolderGlyph = ({
  size = 18,
  open,
}: {
  size?: number;
  open?: boolean;
}) => (
  <svg width={size} height={size} viewBox="0 0 24 24" aria-hidden="true">
    <path
      d="M2.5 6.5A2 2 0 0 1 4.5 4.5h4.6l2 2.2h8.4a2 2 0 0 1 2 2v9.8a2 2 0 0 1-2 2h-15a2 2 0 0 1-2-2z"
      fill="#c98a2b"
    />
    <path
      d={
        open
          ? "M3.6 10h18.3l-1.6 8.6a2 2 0 0 1-2 1.4H4.5a2 2 0 0 1-2-2z"
          : "M2.5 9a2 2 0 0 1 2-2h15a2 2 0 0 1 2 2v9.5a2 2 0 0 1-2 2h-15a2 2 0 0 1-2-2z"
      }
      fill="#f2b544"
    />
  </svg>
);
/** Python source file glyph. */
export const PyFile = ({ size = 18 }: { size?: number }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" aria-hidden="true">
    <path
      d="M6 2.5h8.5L19.5 7.5v13a1.5 1.5 0 0 1-1.5 1.5H6a1.5 1.5 0 0 1-1.5-1.5v-16.5A1.5 1.5 0 0 1 6 2.5z"
      fill="#2a3442"
      stroke="#4b5a6e"
    />
    <path
      d="M14.5 2.5v5h5"
      fill="#3b4a5e"
      stroke="#4b5a6e"
      strokeLinejoin="round"
    />
    <rect x="7" y="12" width="5" height="5" rx="1.4" fill="#6cb4ee" />
    <rect x="10" y="14.5" width="5" height="5" rx="1.4" fill="#f2b544" />
  </svg>
);

/* App icons for the dock: rounded colour tiles with a glyph. */
const Tile = ({ bg, children }: { bg: string; children: ReactNode }) => (
  <svg width="44" height="44" viewBox="0 0 48 48" aria-hidden="true">
    <defs>
      <linearGradient id={`g-${bg.slice(1)}`} x1="0" y1="0" x2="0" y2="1">
        <stop offset="0" stopColor="#fff" stopOpacity="0.22" />
        <stop offset="1" stopColor="#000" stopOpacity="0.12" />
      </linearGradient>
    </defs>
    <rect x="2" y="2" width="44" height="44" rx="12" fill={bg} />
    <rect x="2" y="2" width="44" height="44" rx="12" fill={`url(#g-${bg.slice(1)})`} />
    {children}
  </svg>
);
export const FilesApp = () => (
  <Tile bg="#d9922e">
    <path
      d="M11 16a3 3 0 0 1 3-3h6l3 3h11a3 3 0 0 1 3 3v12a3 3 0 0 1-3 3H14a3 3 0 0 1-3-3z"
      fill="#fff4dc"
    />
    <path d="M11 20h26v11a3 3 0 0 1-3 3H14a3 3 0 0 1-3-3z" fill="#ffe1a6" />
  </Tile>
);
export const CodeApp = () => (
  <Tile bg="#2b3a4f">
    <path
      d="M19 17l-7 7 7 7M29 17l7 7-7 7"
      fill="none"
      stroke="#6cb4ee"
      strokeWidth="3.4"
      strokeLinecap="round"
      strokeLinejoin="round"
    />
    <path
      d="M26.5 14l-5 20"
      stroke="#f2b544"
      strokeWidth="3"
      strokeLinecap="round"
    />
  </Tile>
);
export const BrowserApp = () => (
  <Tile bg="#3f6f93">
    <circle
      cx="24"
      cy="24"
      r="11"
      fill="none"
      stroke="#e8f3fb"
      strokeWidth="2.6"
    />
    <path
      d="M13 24h22M24 13c4 4 4 18 0 22M24 13c-4 4-4 18 0 22"
      fill="none"
      stroke="#e8f3fb"
      strokeWidth="2.2"
    />
  </Tile>
);
export const PowerApp = () => (
  <Tile bg="#3a2c24">
    <path
      d="M24 13v10"
      stroke="#f07167"
      strokeWidth="3.4"
      strokeLinecap="round"
    />
    <path
      d="M17 17.5a10 10 0 1 0 14 0"
      fill="none"
      stroke="#f07167"
      strokeWidth="3.4"
      strokeLinecap="round"
    />
  </Tile>
);
