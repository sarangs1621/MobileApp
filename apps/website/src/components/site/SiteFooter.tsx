import Link from "next/link";
import type React from "react";

import { Icon } from "./Icon";

interface FooterLink {
  label: string;
  href?: string;
}

function FooterCol({ title, links }: { title: string; links: FooterLink[] }) {
  return (
    <div>
      <h4
        style={{
          fontFamily: "var(--font-sans)",
          fontSize: "0.78rem",
          letterSpacing: "0.14em",
          textTransform: "uppercase",
          color: "var(--gold-400)",
          fontWeight: 700,
          marginBottom: "1rem",
        }}
      >
        {title}
      </h4>
      <ul
        style={{
          listStyle: "none",
          margin: 0,
          padding: 0,
          display: "flex",
          flexDirection: "column",
          gap: "0.6rem",
        }}
      >
        {links.map((l) => {
          const style: React.CSSProperties = {
            color: "var(--maroon-100)",
            fontFamily: "var(--font-sans)",
            fontSize: "0.9rem",
            opacity: 0.85,
          };
          return (
            <li key={l.label}>
              {l.href ? (
                <Link href={l.href} style={style}>
                  {l.label}
                </Link>
              ) : (
                <span style={style}>{l.label}</span>
              )}
            </li>
          );
        })}
      </ul>
    </div>
  );
}

/** Site footer — deep maroon field with logo, mission line and link columns. */
export function SiteFooter() {
  return (
    <footer
      style={{
        background: "var(--maroon-950)",
        color: "var(--cream-100)",
        paddingTop: "var(--space-20)",
      }}
    >
      <div
        className="container container--wide ft-grid"
        style={{
          display: "grid",
          gridTemplateColumns: "1.6fr 1fr 1fr 1fr",
          gap: "var(--space-12)",
          paddingBottom: "var(--space-16)",
        }}
      >
        <div>
          <img
            src="/assets/logo-lockup-cream.png"
            alt="Sri Gujarati Vidyalaya"
            style={{ height: 46, marginBottom: "1.2rem" }}
          />
          <p
            style={{
              fontFamily: "var(--font-sans)",
              fontSize: "0.92rem",
              lineHeight: 1.7,
              color: "var(--maroon-100)",
              maxWidth: "34ch",
              opacity: 0.85,
            }}
          >
            A Kerala Government recognised, English-medium co-educational school nurturing the total
            development of every child since 1869.
          </p>
          <div style={{ display: "flex", gap: "0.6rem", marginTop: "1.4rem" }}>
            {[
              { icon: "facebook-logo", label: "Facebook" },
              { icon: "instagram-logo", label: "Instagram" },
              { icon: "youtube-logo", label: "YouTube" },
            ].map((s) => (
              <a
                key={s.icon}
                href="#"
                aria-label={s.label}
                style={{
                  width: 38,
                  height: 38,
                  borderRadius: "50%",
                  border: "1px solid var(--border-on-dark)",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  color: "var(--cream-100)",
                }}
              >
                <Icon name={s.icon} size={18} />
              </a>
            ))}
          </div>
        </div>
        <FooterCol
          title="Explore"
          links={[
            { label: "Heritage", href: "/heritage" },
            { label: "Academics", href: "/academics" },
            { label: "Facilities", href: "/academics" },
            { label: "Campus & Gallery", href: "/gallery" },
          ]}
        />
        <FooterCol
          title="Admissions"
          links={[
            { label: "Apply Now", href: "/admissions" },
            { label: "Fees", href: "/admissions" },
            { label: "Affiliation", href: "/heritage" },
            { label: "Careers", href: "/contact" },
          ]}
        />
        <FooterCol
          title="Contact"
          links={[
            { label: "0495 236 5215" },
            { label: "Beach Rd, Mananchira" },
            { label: "Kozhikode, Kerala 673032" },
          ]}
        />
      </div>
      <div style={{ borderTop: "1px solid var(--border-on-dark)" }}>
        <div
          className="container container--wide"
          style={{
            display: "flex",
            justifyContent: "space-between",
            flexWrap: "wrap",
            gap: "0.5rem",
            padding: "1.4rem 0",
            fontFamily: "var(--font-sans)",
            fontSize: "0.8rem",
            color: "var(--maroon-200)",
          }}
        >
          <span>© 2026 Sri Gujarati Vidyalaya Higher Secondary School</span>
          <span
            style={{
              fontStyle: "italic",
              fontFamily: "var(--font-serif)",
              color: "var(--gold-300)",
            }}
          >
            विद्या विनयेन शोभते
          </span>
        </div>
      </div>
    </footer>
  );
}
