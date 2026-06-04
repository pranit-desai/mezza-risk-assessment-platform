"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";

const NAV_ITEMS = [
  { href: "/", label: "Dashboard", icon: "D" },
  { href: "/cases", label: "Cases", icon: "C" },
  { href: "/banking", label: "Banking", icon: "B" },
];

export default function Sidebar() {
  const pathname = usePathname();
  const [collapsed, setCollapsed] = useState(() => {
    if (typeof window === "undefined") return false;
    try {
      const saved = localStorage.getItem("mezza-sidebar-collapsed");
      return saved === "true";
    } catch {
      return false;
    }
  });

  function toggle() {
    const next = !collapsed;
    setCollapsed(next);
    try {
      localStorage.setItem("mezza-sidebar-collapsed", String(next));
    } catch {}
  }

  const isActive = (href) => {
    if (href === "/") return pathname === "/";
    return pathname.startsWith(href);
  };

  return (
    <aside
      style={{
        width: collapsed ? 64 : 220,
        flexShrink: 0,
        background: "var(--mz-page)",
        borderRight: "1px solid var(--mz-border-on-page)",
        display: "flex",
        flexDirection: "column",
        transition: "width 0.18s ease",
      }}
    >
      <div
        style={{
          padding: "18px 16px",
          borderBottom: "1px solid var(--mz-border-on-page)",
          display: "flex",
          alignItems: "center",
          gap: 10,
        }}
      >
        <div
          style={{
            width: 32,
            height: 32,
            borderRadius: 8,
            background: "linear-gradient(135deg, var(--mz-accent), var(--mz-accent-light))",
            color: "#fff",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            fontWeight: 900,
            fontSize: 15,
            flexShrink: 0,
          }}
        >
          M
        </div>
        {!collapsed && (
          <span
            style={{
              fontWeight: 900,
              fontSize: 16,
              letterSpacing: 2,
              color: "var(--mz-accent)",
            }}
          >
            MEZZA
          </span>
        )}
      </div>

      <nav style={{ flex: 1, padding: "12px 8px" }}>
        {NAV_ITEMS.map((item) => {
          const active = isActive(item.href);
          return (
            <Link
              key={item.href}
              href={item.href}
              className={`mz-clickable ${active ? "active" : ""}`}
              style={{
                display: "flex",
                alignItems: "center",
                gap: 12,
                padding: "10px 12px",
                marginBottom: 4,
              }}
            >
              <span
                className="mz-mono"
                style={{
                  fontSize: 12,
                  width: 20,
                  height: 20,
                  textAlign: "center",
                  lineHeight: "20px",
                  borderRadius: 5,
                  border: "1px solid currentColor",
                  flexShrink: 0,
                }}
              >
                {item.icon}
              </span>
              {!collapsed && <span>{item.label}</span>}
            </Link>
          );
        })}
      </nav>

      <button
        onClick={toggle}
        className="mz-clickable"
        style={{
          margin: "8px 12px 14px",
          padding: 8,
        }}
        title={collapsed ? "Expand sidebar" : "Collapse sidebar"}
      >
        {collapsed ? ">" : "< Collapse"}
      </button>
    </aside>
  );
}
