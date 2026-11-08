import type { ReactNode } from "react";

/** In-UI confirmation dialog (no window.confirm: it would freeze the game loop and look out of place). */
export function Confirm({
  title,
  children,
  confirmLabel,
  cancelLabel = "Cancel",
  danger,
  onConfirm,
  onCancel,
}: {
  title: string;
  children: ReactNode;
  confirmLabel: string;
  cancelLabel?: string;
  danger?: boolean;
  onConfirm: () => void;
  onCancel: () => void;
}) {
  return (
    <div className="iv-scrim" onClick={onCancel}>
      <div
        className="iv-dialog"
        role="alertdialog"
        aria-modal="true"
        aria-labelledby="iv-dialog-title"
        onClick={(e) => e.stopPropagation()}
        onKeyDown={(e) => {
          if (e.key === "Escape") {
            e.preventDefault();
            onCancel();
          }
        }}
      >
        <h2 id="iv-dialog-title">{title}</h2>
        <div className="iv-dialog-body">{children}</div>
        <div className="iv-dialog-actions">
          <button className="iv-btn" autoFocus onClick={onCancel}>
            {cancelLabel}
          </button>
          <button
            className={`iv-btn ${danger ? "danger" : "primary"}`}
            onClick={onConfirm}
          >
            {confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
}
