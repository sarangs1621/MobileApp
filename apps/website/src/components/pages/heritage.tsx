"use client";

/* Heritage / About page — story, vision-mission-philosophy, vertical timeline, affiliation. */

import { Badge } from "../ds";
import { IMG } from "../site/content";
import { Icon } from "../site/Icon";
import { Img } from "../site/Img";
import { Kicker } from "../site/Kicker";
import { PageHero } from "../site/PageHero";
import { Reveal } from "../site/Reveal";

function Story() {
  return (
    <section className="section">
      <div
        className="container container--wide about-grid"
        style={{
          display: "grid",
          gridTemplateColumns: "1.1fr 0.9fr",
          gap: "var(--space-16)",
          alignItems: "center",
        }}
      >
        <Reveal>
          <Kicker>About the school</Kicker>
          <h2
            style={{
              fontSize: "var(--text-section)",
              fontWeight: 500,
              margin: "1rem 0 1.2rem",
              maxWidth: "20ch",
            }}
          >
            Quality and learning, brought together since 1869
          </h2>
          <p
            style={{
              fontFamily: "var(--font-sans)",
              fontSize: "1.05rem",
              lineHeight: 1.75,
              color: "var(--text-secondary)",
              marginBottom: "1rem",
            }}
          >
            Sri Gujarati Vidyalaya was established in 1869 to impart quality education to the
            children of the Gujarati community. Managed by the Sri Gujarati Vidyalaya Association —
            a charitable welfare society registered under the Societies Act, 1860 — it remains a
            Kerala Government recognised, unaided English-medium co-educational school.
          </p>
          <p
            style={{
              fontFamily: "var(--font-sans)",
              fontSize: "1.05rem",
              lineHeight: 1.75,
              color: "var(--text-secondary)",
            }}
          >
            Today it stands among the institutions that bring quality and learning together — with
            excellent faculty and facilities set in a serene, eco-friendly and sustainable campus
            near Mananchira.
          </p>
        </Reveal>
        <Reveal delay={120}>
          <Img
            src={IMG.campus}
            alt="Heritage campus"
            style={{
              borderRadius: "var(--radius-xl)",
              aspectRatio: "4/5",
              boxShadow: "var(--shadow-lg)",
            }}
          />
        </Reveal>
      </div>
    </section>
  );
}

function VMP() {
  const cards = [
    {
      icon: "compass",
      t: "Vision",
      d: "To provide quality leadership along with all-round development and academic growth — grooming students to face tomorrow with confidence, as leaders from a very young age.",
    },
    {
      icon: "target",
      t: "Mission",
      d: "To provide a disciplined, overall growing environment that encourages every child to bring out the best in oneself.",
    },
    {
      icon: "heart",
      t: "Philosophy",
      d: "Every child is born with infinite potential. We follow a child-centred approach in an eco-friendly, serene environment, attending to each child as a unique individual.",
    },
  ];
  return (
    <section className="section" style={{ background: "var(--surface-raised)" }}>
      <div className="container container--wide">
        <div
          className="cards-3"
          style={{ display: "grid", gridTemplateColumns: "repeat(3,1fr)", gap: "var(--space-6)" }}
        >
          {cards.map((c, i) => (
            <Reveal key={c.t} delay={i * 90} style={{ height: "100%" }}>
              <div
                style={{
                  background: "var(--surface-card)",
                  borderRadius: "var(--radius-lg)",
                  padding: "2rem 1.8rem",
                  height: "100%",
                  boxShadow: "var(--shadow-sm)",
                  borderTop: "3px solid var(--gold-500)",
                }}
              >
                <Icon
                  name={c.icon}
                  size={32}
                  style={{ color: "var(--maroon-700)", marginBottom: "1rem", display: "block" }}
                />
                <h3 style={{ fontSize: "1.5rem", fontWeight: 500, marginBottom: "0.7rem" }}>
                  {c.t}
                </h3>
                <p
                  style={{
                    fontFamily: "var(--font-sans)",
                    fontSize: "0.96rem",
                    lineHeight: 1.7,
                    color: "var(--text-secondary)",
                  }}
                >
                  {c.d}
                </p>
              </div>
            </Reveal>
          ))}
        </div>
      </div>
    </section>
  );
}

function VTimeline() {
  const ms = [
    {
      year: "1869",
      t: "Founded",
      d: "The Gujarati community establishes the school to educate its children in Kozhikode.",
    },
    {
      year: "1860s–1900s",
      t: "Roots take hold",
      d: "Registered under the Societies Act, 1860, the SGVA builds a lasting institution.",
    },
    {
      year: "Mid-1900s",
      t: "Recognition",
      d: "Becomes a Kerala Government recognised English-medium school.",
    },
    {
      year: "1990s",
      t: "A serene campus",
      d: "Grows into its eco-friendly campus, balancing heritage with modern facilities.",
    },
    {
      year: "Today",
      t: "Higher Secondary",
      d: "Science & Commerce streams, modern labs, swimming pools and a 150-year legacy.",
    },
  ];
  return (
    <section className="section">
      <div className="container container--narrow">
        <Reveal style={{ textAlign: "center", marginBottom: "var(--space-12)" }}>
          <Kicker>
            <span style={{ display: "inline-flex", margin: "0 auto" }}>Our journey</span>
          </Kicker>
          <h2 style={{ fontSize: "var(--text-section)", fontWeight: 500, marginTop: "0.8rem" }}>
            A living timeline
          </h2>
        </Reveal>
        <div style={{ position: "relative", paddingLeft: "2.4rem" }}>
          <div
            style={{
              position: "absolute",
              left: 9,
              top: 6,
              bottom: 6,
              width: 2,
              background: "var(--sand-300)",
            }}
          />
          {ms.map((m, i) => (
            <Reveal
              key={m.year}
              delay={i * 60}
              style={{ position: "relative", paddingBottom: i === ms.length - 1 ? 0 : "2.2rem" }}
            >
              <span
                style={{
                  position: "absolute",
                  left: "-2.4rem",
                  top: 4,
                  width: 20,
                  height: 20,
                  borderRadius: "50%",
                  background: "var(--maroon-700)",
                  border: "3px solid var(--surface-page)",
                  boxShadow: "0 0 0 2px var(--maroon-200)",
                }}
              />
              <span
                style={{
                  fontFamily: "var(--font-display)",
                  fontWeight: 600,
                  fontSize: "0.95rem",
                  color: "var(--gold-700)",
                  letterSpacing: "0.04em",
                }}
              >
                {m.year}
              </span>
              <h3 style={{ fontSize: "1.3rem", fontWeight: 500, margin: "0.3rem 0 0.4rem" }}>
                {m.t}
              </h3>
              <p
                style={{
                  fontFamily: "var(--font-sans)",
                  fontSize: "0.96rem",
                  lineHeight: 1.65,
                  color: "var(--text-secondary)",
                }}
              >
                {m.d}
              </p>
            </Reveal>
          ))}
        </div>
      </div>
    </section>
  );
}

function Affiliation() {
  return (
    <section
      className="section"
      style={{ background: "var(--maroon-950)", color: "var(--cream-50)" }}
    >
      <div
        className="container container--wide"
        style={{
          display: "flex",
          gap: "var(--space-12)",
          alignItems: "center",
          justifyContent: "space-between",
          flexWrap: "wrap",
        }}
      >
        <Reveal style={{ maxWidth: "40ch" }}>
          <Kicker tone="inverse">Recognition &amp; affiliation</Kicker>
          <h2
            style={{
              color: "var(--cream-50)",
              fontWeight: 500,
              fontSize: "var(--text-section)",
              margin: "0.9rem 0 1rem",
            }}
          >
            Recognised, trusted, accountable
          </h2>
          <p
            style={{
              fontFamily: "var(--font-sans)",
              color: "var(--maroon-100)",
              fontSize: "1.02rem",
              lineHeight: 1.7,
            }}
          >
            A Kerala Government recognised institution managed by a registered charitable society —
            combining the assurance of heritage governance with modern educational standards.
          </p>
        </Reveal>
        <Reveal delay={120} style={{ display: "flex", gap: "0.8rem", flexWrap: "wrap" }}>
          {[
            "Kerala Govt. Recognised",
            "English Medium",
            "Co-Educational",
            "Higher Secondary",
            "Est. 1869",
          ].map((b) => (
            <Badge
              key={b}
              tone="gold"
              style={{
                background: "rgba(248,240,220,0.14)",
                color: "var(--gold-300)",
                fontSize: "0.82rem",
                padding: "0.5rem 0.9rem",
              }}
            >
              {b}
            </Badge>
          ))}
        </Reveal>
      </div>
    </section>
  );
}

export function HeritageContent() {
  return (
    <div>
      <PageHero
        crumb="Heritage"
        eyebrow="Since 1869"
        title="A prestigious heritage, a modern education"
        lead="For over 150 years, Sri Gujarati Vidyalaya has shaped generations of learners in Kozhikode — rooted in humility, reaching for excellence."
        image={IMG.a1}
      />
      <Story />
      <VMP />
      <VTimeline />
      <Affiliation />
    </div>
  );
}
