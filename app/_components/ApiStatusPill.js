"use client";

import { useEffect, useState } from "react";

const API_BASE_URL = process.env.NEXT_PUBLIC_API_BASE_URL;

export default function ApiStatusPill() {
  const [status, setStatus] = useState("checking");

  useEffect(() => {
    let active = true;

    async function check() {
      try {
        const res = await fetch(`${API_BASE_URL}/health`, { cache: "no-store" });
        if (!active) return;
        setStatus(res.ok ? "ok" : "down");
      } catch (e) {
        if (!active) return;
        setStatus("down");
      }
    }

    check();
    const interval = setInterval(check, 30_000);
    return () => {
      active = false;
      clearInterval(interval);
    };
  }, []);

  const dotColor =
    status === "ok"
      ? "var(--mz-tier-excellent-plus)"
      : status === "down"
      ? "var(--mz-tier-critical)"
      : "var(--mz-muted)";
  const label =
    status === "ok"
      ? "API healthy"
      : status === "down"
      ? "API down"
      : "Checking API...";

  return (
    <div
      style={{
        display: "flex",
        alignItems: "center",
        gap: 8,
        padding: "5px 12px",
        borderRadius: 999,
        background: "var(--mz-card)",
        border: "1px solid var(--mz-border)",
        fontSize: "var(--mz-fs-xs)",
        fontWeight: 500,
        color: "var(--mz-muted)",
      }}
    >
      <span
        style={{
          width: 7,
          height: 7,
          borderRadius: "50%",
          background: dotColor,
          flexShrink: 0,
        }}
      />
      {label}
    </div>
  );
}