"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";

const NAV_ITEMS = [
  { label: "Dashboard", href: "/" },
  { label: "Cases", href: "/cases" },
  { label: "Portfolio", href: "/portfolio" },
  { label: "Library", href: "/library" },
];

const ICONS = {
  Dashboard: "▦",
  Cases: "▤",
  Portfolio: "◐",
  Library: "❏",
};

export default function Sidebar() {
  const pathname = usePathname();
  const [collapsed, setCollapsed] = useState(false);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    const saved = localStorage.getItem("mz-sidebar-collapsed");
    if (saved === "1") setCollapsed(true);
    setMounted(true);
  }, []);

  function toggle() {
    const next = !collapsed;
    setCollapsed(next);
    localStorage.setItem("mz-sidebar-collapsed", next ? "1" : "0");
  }

  function isActive(href) {
    if (href === "/") return pathname === "/";
    return pathname === href || pathname.startsWith(href + "/");
  }

  return (
    <aside
      className={`flex flex-col border-r border-[color:var(--mz-border)] bg-[color:var(--mz-sidebar)] transition-all duration-200 ${
        collapsed ? "w-16" : "w-64"
      }`}
    >
      <div className="flex items-center gap-3 px-4 py-5">
        <div
          className="flex h-9 w-9 items-center justify-center rounded-lg font-bold text-[#04342c]"
          style={{ backgroundColor: "var(--mz-accent)" }}
        >
          M
        </div>
        {!collapsed && (
          <div className="overflow-hidden">
            <div className="text-base font-semibold leading-tight text-[color:var(--mz-text)]">
              Mezza
            </div>
            <div className="text-xs text-[color:var(--mz-muted)]">
              Risk Assessment
            </div>
          </div>
        )}
      </div>

      <nav className="flex-1 px-2 py-2 space-y-1">
        {NAV_ITEMS.map((item) => {
          const active = isActive(item.href);
          return (
            <Link
              key={item.href}
              href={item.href}
              className={`flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm transition ${
                active
                  ? "text-[color:var(--mz-accent)]"
                  : "text-[color:var(--mz-muted)] hover:text-[color:var(--mz-text)]"
              }`}
              style={{
                backgroundColor: active
                  ? "rgba(0, 196, 159, 0.08)"
                  : "transparent",
              }}
              title={collapsed ? item.label : undefined}
            >
              <span className="text-base">{ICONS[item.label]}</span>
              {!collapsed && <span>{item.label}</span>}
            </Link>
          );
        })}
      </nav>

      <button
        onClick={toggle}
        className="flex items-center justify-center border-t border-[color:var(--mz-border)] py-3 text-xs text-[color:var(--mz-muted)] hover:text-[color:var(--mz-text)] transition"
        title={collapsed ? "Expand sidebar" : "Collapse sidebar"}
      >
        <span suppressHydrationWarning>
          {mounted && collapsed ? "›" : "‹"}
        </span>
      </button>
    </aside>
  );
}