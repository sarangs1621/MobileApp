"use client";

import React from "react";

interface RevealProps {
  children?: React.ReactNode;
  delay?: number;
  y?: number;
  style?: React.CSSProperties;
}

/**
 * Reveal on scroll (fade + rise). The entrance is transform-only so content
 * is never hidden if the document timeline is paused/throttled — a stalled
 * tab just shows content in place.
 */
export function Reveal({ children, delay = 0, y = 24, style }: RevealProps) {
  const ref = React.useRef<HTMLDivElement>(null);
  const [shown, setShown] = React.useState(false);

  React.useEffect(() => {
    const node = ref.current;
    if (!node) return;
    let done = false;
    const reveal = () => {
      if (!done) {
        done = true;
        setShown(true);
      }
    };
    const inView = () => {
      const r = node.getBoundingClientRect();
      return r.height > 0 && r.top < (window.innerHeight || 0) - 40 && r.bottom > 0;
    };
    // Poll briefly after mount so above-the-fold content reveals even if the
    // first layout frame was transient (and never triggers a scroll event).
    let tries = 0;
    const poll = setInterval(() => {
      tries += 1;
      if (inView()) {
        reveal();
        clearInterval(poll);
      }
      if (tries > 12) clearInterval(poll);
    }, 110);
    // Observer handles below-the-fold content as it scrolls into view.
    const io = new IntersectionObserver(
      (entries) => {
        entries.forEach((e) => {
          if (e.isIntersecting) {
            reveal();
            io.disconnect();
          }
        });
      },
      { threshold: 0.12 },
    );
    io.observe(node);
    return () => {
      io.disconnect();
      clearInterval(poll);
    };
  }, []);

  return (
    <div
      ref={ref}
      style={
        shown
          ? {
              transform: "translateY(0)",
              animation: `revealUp 0.7s var(--ease-out) ${delay}ms both`,
              ...style,
            }
          : { transform: `translateY(${y}px)`, ...style }
      }
    >
      {children}
    </div>
  );
}
