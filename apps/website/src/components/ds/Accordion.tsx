"use client";

import React from "react";

export interface AccordionItem {
  q: React.ReactNode;
  a: React.ReactNode;
}

interface AccordionProps {
  items?: AccordionItem[];
  /** Index opened initially; null for all closed. */
  defaultOpen?: number | null;
  allowMultiple?: boolean;
  style?: React.CSSProperties;
}

/**
 * Accordion — collapsible items for fees, FAQs, affiliation details and long content.
 */
export function Accordion({
  items = [],
  defaultOpen = 0,
  allowMultiple = false,
  style,
}: AccordionProps) {
  const [open, setOpen] = React.useState<Set<number>>(
    () => new Set(defaultOpen === null ? [] : [defaultOpen]),
  );

  const toggle = (i: number) =>
    setOpen((prev) => {
      const next = new Set(allowMultiple ? prev : []);
      if (prev.has(i)) next.delete(i);
      else next.add(i);
      return next;
    });

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "0.75rem", ...style }}>
      {items.map((it, i) => {
        const isOpen = open.has(i);
        return (
          <div
            key={i}
            style={{
              background: "var(--surface-card)",
              border: "1px solid var(--border-subtle)",
              borderRadius: "var(--radius-md)",
              overflow: "hidden",
              boxShadow: isOpen ? "var(--shadow-sm)" : "none",
              transition: "box-shadow var(--dur-fast)",
            }}
          >
            <button
              type="button"
              onClick={() => toggle(i)}
              aria-expanded={isOpen}
              style={{
                width: "100%",
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
                gap: "1rem",
                padding: "1.1rem 1.25rem",
                background: "transparent",
                border: "none",
                cursor: "pointer",
                textAlign: "left",
                fontFamily: "var(--font-display)",
                fontSize: "var(--text-lg)",
                fontWeight: 500,
                color: "var(--text-primary)",
              }}
            >
              {it.q}
              <span
                aria-hidden
                style={{
                  flex: "none",
                  width: 28,
                  height: 28,
                  borderRadius: "50%",
                  background: isOpen ? "var(--brand)" : "var(--cream-200)",
                  color: isOpen ? "var(--cream-50)" : "var(--maroon-700)",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  fontSize: "1.1rem",
                  lineHeight: 1,
                  transition: "all var(--dur-fast) var(--ease-out)",
                  transform: isOpen ? "rotate(45deg)" : "rotate(0)",
                }}
              >
                +
              </span>
            </button>
            <div
              style={{
                display: "grid",
                gridTemplateRows: isOpen ? "1fr" : "0fr",
                transition: "grid-template-rows var(--dur) var(--ease-out)",
              }}
            >
              <div style={{ overflow: "hidden" }}>
                <div
                  style={{
                    padding: "0 1.25rem 1.25rem",
                    fontFamily: "var(--font-sans)",
                    fontSize: "0.9375rem",
                    lineHeight: 1.65,
                    color: "var(--text-secondary)",
                  }}
                >
                  {it.a}
                </div>
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
}
