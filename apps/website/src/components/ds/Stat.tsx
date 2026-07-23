"use client";

import React from "react";

interface StatProps {
  value: number;
  suffix?: string;
  prefix?: string;
  label: string;
  align?: "center" | "left";
  tone?: "default" | "inverse";
  animate?: boolean;
  style?: React.CSSProperties;
}

/**
 * Stat — a single "at a glance" figure (Years of Excellence, Students, Board Results %).
 * Animated count-up when `animate` and scrolled into view.
 */
export function Stat({
  value,
  suffix = "",
  prefix = "",
  label,
  align = "center",
  tone = "default",
  animate = true,
  style,
}: StatProps) {
  const ref = React.useRef<HTMLDivElement>(null);
  // Initialise to the FINAL value so the credibility-critical number is always
  // correct even if no scroll/IntersectionObserver event ever fires. The
  // count-up from 0 is purely an enhancement that plays when triggered.
  const [display, setDisplay] = React.useState(value);

  React.useEffect(() => {
    if (!animate) return;
    const node = ref.current;
    if (!node) return;
    let raf: number | undefined;
    let done = false;

    const run = () => {
      if (done) return;
      done = true;
      setDisplay(0);
      const start = performance.now();
      const dur = 1400;
      const tick = (now: number) => {
        const p = Math.min((now - start) / dur, 1);
        const eased = 1 - Math.pow(1 - p, 3);
        setDisplay(Math.round(value * eased));
        if (p < 1) raf = requestAnimationFrame(tick);
        else setDisplay(value);
      };
      raf = requestAnimationFrame(tick);
    };

    const inView = () => {
      const r = node.getBoundingClientRect();
      return r.height > 0 && r.top < (window.innerHeight || 0) - 40 && r.bottom > 0;
    };
    const onScroll = () => {
      if (inView()) {
        run();
        cleanup();
      }
    };
    const io = new IntersectionObserver(
      (entries) => {
        entries.forEach((e) => {
          if (e.isIntersecting) {
            run();
            cleanup();
          }
        });
      },
      { threshold: 0.35 },
    );
    function cleanup() {
      window.removeEventListener("scroll", onScroll, true);
      io.disconnect();
    }
    io.observe(node);
    window.addEventListener("scroll", onScroll, true);
    if (inView()) {
      run();
      cleanup();
    }

    return () => {
      cleanup();
      if (raf !== undefined) cancelAnimationFrame(raf);
    };
  }, [value, animate]);

  const onDark = tone === "inverse";
  return (
    <div ref={ref} style={{ textAlign: align, ...style }}>
      <div
        style={{
          fontFamily: "var(--font-display)",
          fontWeight: 500,
          fontSize: "clamp(2.25rem, 1.4rem + 2.6vw, 3.25rem)",
          lineHeight: 1,
          letterSpacing: "-0.02em",
          color: onDark ? "var(--gold-300)" : "var(--text-brand)",
          display: "flex",
          alignItems: "baseline",
          justifyContent: align === "center" ? "center" : "flex-start",
          gap: "0.05em",
        }}
      >
        {prefix}
        {display.toLocaleString("en-IN")}
        {suffix}
      </div>
      <div
        style={{
          marginTop: "0.5rem",
          fontFamily: "var(--font-sans)",
          fontSize: "0.9375rem",
          fontWeight: 500,
          letterSpacing: "0.02em",
          color: onDark ? "var(--cream-100)" : "var(--text-secondary)",
        }}
      >
        {label}
      </div>
    </div>
  );
}
