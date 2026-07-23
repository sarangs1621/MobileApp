"use client";

import Link from "next/link";
import React from "react";

import { Icon } from "./Icon";

/** Floating quick actions — back-to-top, WhatsApp, admission enquiry. */
export function QuickActions() {
  const [showTop, setShowTop] = React.useState(false);

  React.useEffect(() => {
    const onScroll = () => setShowTop((window.scrollY || 0) > 700);
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  const toTop = () => window.scrollTo({ top: 0, behavior: "smooth" });

  return (
    <div
      style={{
        position: "fixed",
        right: "clamp(14px, 2vw, 28px)",
        bottom: "clamp(16px, 3vw, 32px)",
        zIndex: 700,
        display: "flex",
        flexDirection: "column",
        gap: "0.7rem",
        alignItems: "flex-end",
      }}
    >
      <button
        type="button"
        onClick={toTop}
        aria-label="Back to top"
        title="Back to top"
        style={{
          width: 44,
          height: 44,
          borderRadius: "50%",
          border: "1px solid var(--border-strong)",
          background: "var(--surface-card)",
          color: "var(--maroon-800)",
          cursor: "pointer",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          boxShadow: "var(--shadow-md)",
          opacity: showTop ? 1 : 0,
          transform: showTop ? "translateY(0)" : "translateY(12px)",
          pointerEvents: showTop ? "auto" : "none",
          transition: "opacity var(--dur) var(--ease-out), transform var(--dur) var(--ease-out)",
        }}
      >
        <Icon name="arrow-up" size={20} />
      </button>
      <a
        href="https://wa.me/914952365215"
        target="_blank"
        rel="noopener"
        title="WhatsApp"
        aria-label="WhatsApp"
        style={{
          width: 54,
          height: 54,
          borderRadius: "50%",
          background: "#25D366",
          color: "#fff",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          boxShadow: "var(--shadow-lg)",
        }}
      >
        <Icon name="whatsapp-logo" weight="fill" size={28} />
      </a>
      <Link
        href="/admissions"
        title="Admission Enquiry"
        style={{
          padding: "0.7rem 1.1rem",
          borderRadius: "var(--radius-pill)",
          background: "var(--brand)",
          color: "var(--cream-50)",
          fontFamily: "var(--font-sans)",
          fontWeight: 600,
          fontSize: "0.85rem",
          boxShadow: "var(--shadow-brand)",
          display: "inline-flex",
          gap: "0.45rem",
          alignItems: "center",
        }}
      >
        <Icon name="paper-plane-tilt" size={16} /> Enquire
      </Link>
    </div>
  );
}
