import Link from "next/link";
import type React from "react";

import { Icon } from "./Icon";
import { Img } from "./Img";
import { Kicker } from "./Kicker";

interface PageHeroProps {
  eyebrow?: React.ReactNode;
  title: React.ReactNode;
  lead?: React.ReactNode;
  image?: string;
  crumb?: string;
}

/** Standard inner-page hero — maroon field, faint crest watermark, breadcrumb. */
export function PageHero({ eyebrow, title, lead, image, crumb }: PageHeroProps) {
  return (
    <section style={{ position: "relative", overflow: "hidden", background: "var(--maroon-900)" }}>
      {image && (
        <Img
          src={image}
          alt=""
          style={{ position: "absolute", inset: 0, width: "100%", height: "100%", opacity: 0.28 }}
        />
      )}
      <img
        src="/assets/crest-cream.png"
        alt=""
        style={{
          position: "absolute",
          right: "-30px",
          bottom: "-40px",
          height: "150%",
          opacity: 0.06,
        }}
      />
      <div
        className="container container--wide"
        style={{
          position: "relative",
          paddingTop: "var(--space-16)",
          paddingBottom: "var(--space-12)",
        }}
      >
        <div
          style={{
            display: "flex",
            gap: "0.5rem",
            alignItems: "center",
            fontFamily: "var(--font-sans)",
            fontSize: "0.82rem",
            color: "var(--maroon-200)",
            marginBottom: "1.2rem",
          }}
        >
          <Link href="/" style={{ color: "var(--maroon-200)" }}>
            Home
          </Link>
          <Icon name="caret-right" size={12} />
          <span style={{ color: "var(--gold-300)" }}>{crumb}</span>
        </div>
        <Kicker tone="inverse">{eyebrow}</Kicker>
        <h1
          style={{
            color: "var(--cream-50)",
            fontWeight: 500,
            fontSize: "clamp(2.2rem, 1.5rem + 3vw, 3.6rem)",
            lineHeight: 1.05,
            margin: "1rem 0 0",
            maxWidth: "18ch",
            letterSpacing: "-0.02em",
          }}
        >
          {title}
        </h1>
        {lead && (
          <p
            style={{
              color: "var(--cream-100)",
              fontFamily: "var(--font-sans)",
              fontSize: "var(--text-lead)",
              marginTop: "1.2rem",
              maxWidth: "52ch",
              lineHeight: 1.6,
              opacity: 0.92,
            }}
          >
            {lead}
          </p>
        )}
      </div>
    </section>
  );
}
