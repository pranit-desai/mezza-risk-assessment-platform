"use client";

import { useEffect, useState } from "react";

const API_BASE_URL = process.env.NEXT_PUBLIC_API_BASE_URL;

export default function ApiStatusPill() {
  const [status, setStatus] = useState("checking"); // "checking" | "connected" | "down"

  useEffect(() => {
    let cancelled = false;

    async function check() {
      try {
        const res = await fetch(`${API_BASE_URL}/health`, {
          cache: "no-store",
        });
        if (cancelled) return;
        setStatus(res.ok ? "connected" : "down");
      } catch {
        if (!cancelled) setStatus("down");
      }
    }

    check();
    // Re-check every 30 seconds while the page is open
    const id = setInterval(check, 30000);

    return () => {
      cancelled = true;
      clearInterval(id);
    };
  }, []);

  const dotColor =
    status === "connected"
      ? "var(--mz-accent)"
      : status === "down"
        ? "var(--mz-red-text)"
        : "var(--mz-muted)";

  const label =
    status === "connected"
      ? "API Connected"
      : status === "down"
        ? "API Down"
        : "Checking...";

  return (
    <div
      className="flex items-center gap-2 rounded-full px-3 py-1.5 text-xs"
      style={{
        backgroundColor: "rgba(255, 255, 255, 0.04)",
        border: "1px solid var(--mz-border)",
      }}
    >
      <span
        className="h-2 w-2 rounded-full"
        style={{ backgroundColor: dotColor }}
      />
      <span className="text-[color:var(--mz-muted)]">{label}</span>
    </div>
  );
}
