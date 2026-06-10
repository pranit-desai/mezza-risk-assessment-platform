"use client";

import { useEffect } from "react";

export default function DashboardModal({ title, url, onClose }) {
  useEffect(() => {
    if (!url) return undefined;
    function handleKeyDown(event) {
      if (event.key === "Escape") onClose();
    }
    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [onClose, url]);

  if (!url) return null;

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label={title || "Risk dashboard"}
      style={{
        position: "fixed",
        inset: 0,
        zIndex: 1000,
        background: "rgba(0,0,0,0.82)",
        display: "flex",
        flexDirection: "column",
      }}
    >
      <div
        style={{
          minHeight: 54,
          padding: "10px 14px",
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          gap: 12,
          background: "var(--mz-bg)",
          borderBottom: "1px solid var(--mz-border-soft)",
        }}
      >
        <div
          style={{
            color: "var(--mz-text-on-page)",
            fontWeight: 900,
            fontSize: "var(--mz-fs-sm)",
            overflow: "hidden",
            textOverflow: "ellipsis",
            whiteSpace: "nowrap",
          }}
        >
          {title || "Risk dashboard"}
        </div>
        <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
          <a
            className="mz-clickable"
            href={url}
            target="_blank"
            rel="noreferrer"
            style={{ padding: "7px 11px", textDecoration: "none", whiteSpace: "nowrap" }}
          >
            Open in new tab
          </a>
          <button
            type="button"
            className="mz-clickable"
            onClick={onClose}
            style={{ padding: "7px 11px", cursor: "pointer" }}
          >
            Close
          </button>
        </div>
      </div>
      <iframe
        title={title || "Risk dashboard"}
        src={url}
        style={{
          border: 0,
          width: "100%",
          flex: 1,
          background: "#e8e4df",
        }}
      />
    </div>
  );
}
