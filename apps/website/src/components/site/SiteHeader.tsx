"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import React from "react";

import { Button } from "../ds";

import { NAV } from "./content";
import { Icon } from "./Icon";

/** Sticky top utility bar + main navigation. Shrinks and frosts on scroll. */
export function SiteHeader() {
  const pathname = usePathname();
  const [scrolled, setScrolled] = React.useState(false);
  const [open, setOpen] = React.useState(false);
  const [progress, setProgress] = React.useState(0);

  React.useEffect(() => {
    const onScroll = () => {
      const top = window.scrollY || document.documentElement.scrollTop || 0;
      setScrolled(top > 20);
      const max =
        (document.documentElement.scrollHeight || document.body.scrollHeight) - window.innerHeight;
      setProgress(max > 0 ? Math.min(top / max, 1) : 0);
    };
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  const isActive = (href: string) => (href === "/" ? pathname === "/" : pathname.startsWith(href));

  return (
    <header style={{ position: "sticky", top: 0, zIndex: 200 }}>
      {/* utility bar */}
      <div style={{ background: "var(--maroon-900)", color: "var(--cream-100)" }}>
        <div
          className="container container--wide"
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            height: 38,
            fontFamily: "var(--font-sans)",
            fontSize: "0.78rem",
          }}
        >
          <span
            style={{
              display: "inline-flex",
              alignItems: "center",
              gap: "0.5rem",
              color: "var(--gold-300)",
              fontStyle: "italic",
              fontFamily: "var(--font-serif)",
            }}
          >
            विद्या विनयेन शोभते
          </span>
          <div style={{ display: "flex", gap: "1.4rem", alignItems: "center" }}>
            <a
              href="tel:04952365215"
              style={{
                color: "var(--cream-100)",
                display: "inline-flex",
                gap: "0.4rem",
                alignItems: "center",
              }}
            >
              <Icon name="phone" size={14} /> 0495 236 5215
            </a>
            <span
              style={{ display: "inline-flex", gap: "0.4rem", alignItems: "center", opacity: 0.85 }}
            >
              <Icon name="map-pin" size={14} /> Mananchira, Kozhikode
            </span>
          </div>
        </div>
      </div>
      {/* main nav */}
      <div
        style={{
          background: scrolled ? "rgba(252,249,243,0.92)" : "var(--surface-card)",
          backdropFilter: scrolled ? "saturate(160%) blur(10px)" : "none",
          borderBottom: "1px solid var(--border-subtle)",
          boxShadow: scrolled ? "var(--shadow-sm)" : "none",
          transition: "box-shadow var(--dur), background var(--dur)",
        }}
      >
        <div
          className="container container--wide"
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            height: scrolled ? 64 : 76,
            transition: "height var(--dur)",
          }}
        >
          <Link href="/" style={{ display: "flex", alignItems: "center" }}>
            <img
              src="/assets/logo-lockup.png"
              alt="Sri Gujarati Vidyalaya"
              style={{ height: scrolled ? 34 : 40, transition: "height var(--dur)" }}
            />
          </Link>
          <nav
            className="desk-nav"
            style={{ display: "flex", alignItems: "center", gap: "0.2rem" }}
          >
            {NAV.map((n) => {
              const active = isActive(n.href);
              return (
                <Link
                  key={n.href}
                  href={n.href}
                  style={{
                    position: "relative",
                    padding: "0.5rem 0.9rem",
                    fontFamily: "var(--font-sans)",
                    fontSize: "0.9rem",
                    fontWeight: 600,
                    color: active ? "var(--maroon-800)" : "var(--ink-700)",
                  }}
                  onMouseEnter={(e) => {
                    if (!active) e.currentTarget.style.color = "var(--maroon-700)";
                  }}
                  onMouseLeave={(e) => {
                    if (!active) e.currentTarget.style.color = "var(--ink-700)";
                  }}
                >
                  {n.label}
                  <span
                    style={{
                      position: "absolute",
                      left: "0.9rem",
                      right: "0.9rem",
                      bottom: "0.15rem",
                      height: 2,
                      borderRadius: 2,
                      background: "var(--gold-500)",
                      transform: active ? "scaleX(1)" : "scaleX(0)",
                      transformOrigin: "left",
                    }}
                  />
                </Link>
              );
            })}
          </nav>
          <div
            className="desk-nav"
            style={{ display: "flex", gap: "0.6rem", alignItems: "center" }}
          >
            <Button size="sm" href="/admissions">
              Apply Now
            </Button>
          </div>
          <button
            className="burger"
            type="button"
            onClick={() => setOpen((o) => !o)}
            aria-label="Menu"
            aria-expanded={open}
            style={{
              display: "none",
              border: "none",
              background: "transparent",
              cursor: "pointer",
              color: "var(--maroon-800)",
            }}
          >
            <Icon name={open ? "x" : "list"} size={28} />
          </button>
        </div>
        {open && (
          <div
            className="mobile-nav"
            style={{
              borderTop: "1px solid var(--border-subtle)",
              padding: "0.5rem var(--gutter) 1rem",
              background: "var(--surface-card)",
            }}
          >
            {NAV.map((n) => (
              <Link
                key={n.href}
                href={n.href}
                onClick={() => setOpen(false)}
                style={{
                  display: "block",
                  padding: "0.85rem 0.5rem",
                  borderBottom: "1px solid var(--border-subtle)",
                  fontFamily: "var(--font-sans)",
                  fontWeight: 600,
                  color: isActive(n.href) ? "var(--maroon-700)" : "var(--ink-800)",
                }}
              >
                {n.label}
              </Link>
            ))}
            <div style={{ marginTop: "1rem" }}>
              <Button fullWidth href="/admissions" onClick={() => setOpen(false)}>
                Apply Now
              </Button>
            </div>
          </div>
        )}
        {/* scroll progress */}
        <div style={{ height: 2, background: "transparent", position: "relative" }}>
          <div
            style={{
              position: "absolute",
              left: 0,
              top: 0,
              height: "100%",
              width: `${progress * 100}%`,
              background: "linear-gradient(90deg, var(--maroon-600), var(--gold-500))",
              transition: "width 80ms linear",
            }}
          />
        </div>
      </div>
    </header>
  );
}
