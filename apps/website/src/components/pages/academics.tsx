"use client";

/* Academics page — streams, achievement dashboard, faculty directory preview. */

import { Avatar, Badge, Stat } from "../ds";
import { IMG } from "../site/content";
import { Icon } from "../site/Icon";
import { Kicker } from "../site/Kicker";
import { PageHero } from "../site/PageHero";
import { Reveal } from "../site/Reveal";

function Streams() {
  const streams = [
    {
      icon: "atom",
      t: "Higher Secondary — Science",
      d: "Physics, Chemistry, Biology & Mathematics for aspiring doctors, engineers and researchers.",
      tags: ["Physics", "Chemistry", "Biology", "Maths"],
    },
    {
      icon: "chart-line-up",
      t: "Higher Secondary — Commerce",
      d: "Accountancy, Business Studies & Economics for future leaders in business and finance.",
      tags: ["Accountancy", "Business", "Economics"],
    },
  ];
  return (
    <section className="section">
      <div className="container container--wide">
        <Reveal style={{ marginBottom: "var(--space-12)" }}>
          <Kicker>Higher Secondary streams</Kicker>
          <h2
            style={{
              fontSize: "var(--text-section)",
              fontWeight: 500,
              marginTop: "0.8rem",
              maxWidth: "18ch",
            }}
          >
            Choose the path that fits the future
          </h2>
        </Reveal>
        <div
          className="cards-2"
          style={{ display: "grid", gridTemplateColumns: "repeat(2,1fr)", gap: "var(--space-6)" }}
        >
          {streams.map((s, i) => (
            <Reveal key={s.t} delay={i * 100} style={{ height: "100%" }}>
              <div
                style={{
                  background: "var(--surface-card)",
                  borderRadius: "var(--radius-xl)",
                  padding: "2.2rem",
                  height: "100%",
                  boxShadow: "var(--shadow-md)",
                  border: "1px solid var(--border-subtle)",
                }}
              >
                <div
                  style={{
                    width: 56,
                    height: 56,
                    borderRadius: "var(--radius-md)",
                    background: "var(--maroon-700)",
                    color: "var(--cream-50)",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    marginBottom: "1.3rem",
                  }}
                >
                  <Icon name={s.icon} size={30} />
                </div>
                <h3 style={{ fontSize: "1.5rem", fontWeight: 500, marginBottom: "0.7rem" }}>
                  {s.t}
                </h3>
                <p
                  style={{
                    fontFamily: "var(--font-sans)",
                    fontSize: "1rem",
                    lineHeight: 1.7,
                    color: "var(--text-secondary)",
                    marginBottom: "1.4rem",
                  }}
                >
                  {s.d}
                </p>
                <div style={{ display: "flex", gap: "0.5rem", flexWrap: "wrap" }}>
                  {s.tags.map((t) => (
                    <Badge key={t} tone="neutral">
                      {t}
                    </Badge>
                  ))}
                </div>
              </div>
            </Reveal>
          ))}
        </div>
      </div>
    </section>
  );
}

function Achievements() {
  const stats = [
    { value: 98, suffix: "%", label: "Higher Secondary Pass" },
    { value: 45, suffix: "+", label: "A+ Scorers / Year" },
    { value: 30, suffix: "+", label: "Clubs & Activities" },
    { value: 15, suffix: "+", label: "Sports Disciplines" },
  ];
  return (
    <section style={{ background: "var(--maroon-900)", position: "relative", overflow: "hidden" }}>
      <img
        src="/assets/crest-cream.png"
        alt=""
        style={{
          position: "absolute",
          left: "-50px",
          top: "50%",
          transform: "translateY(-50%)",
          height: "150%",
          opacity: 0.05,
        }}
      />
      <div
        className="container container--wide"
        style={{ paddingBlock: "var(--space-16)", position: "relative" }}
      >
        <Reveal style={{ textAlign: "center", marginBottom: "var(--space-12)" }}>
          <Kicker tone="inverse">
            <span style={{ display: "inline-flex", margin: "0 auto" }}>Achievement dashboard</span>
          </Kicker>
          <h2
            style={{
              color: "var(--cream-50)",
              fontWeight: 500,
              fontSize: "var(--text-section)",
              marginTop: "0.8rem",
            }}
          >
            Results that speak quietly
          </h2>
        </Reveal>
        <div
          className="glance-grid"
          style={{ display: "grid", gridTemplateColumns: "repeat(4,1fr)", gap: "var(--space-8)" }}
        >
          {stats.map((s, i) => (
            <Reveal key={s.label} delay={i * 90}>
              <Stat {...s} tone="inverse" />
            </Reveal>
          ))}
        </div>
      </div>
    </section>
  );
}

function Faculty() {
  const people: { n: string; r: string; img?: string }[] = [
    { n: "Vimala Jayaraj", r: "Principal", img: IMG.principal },
    { n: "Suresh Kumar", r: "Vice Principal" },
    { n: "Lakshmi Menon", r: "HoD — Science" },
    { n: "Anil Raghavan", r: "HoD — Commerce" },
    { n: "Fathima Beevi", r: "Senior Faculty, English" },
    { n: "Deepa Nair", r: "Primary Coordinator" },
  ];
  return (
    <section className="section">
      <div className="container container--wide">
        <Reveal
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "flex-end",
            gap: "1rem",
            flexWrap: "wrap",
            marginBottom: "var(--space-12)",
          }}
        >
          <div>
            <Kicker>Faculty directory</Kicker>
            <h2 style={{ fontSize: "var(--text-section)", fontWeight: 500, marginTop: "0.8rem" }}>
              Teachers who know every child
            </h2>
          </div>
        </Reveal>
        <div
          className="cards-6"
          style={{ display: "grid", gridTemplateColumns: "repeat(3,1fr)", gap: "var(--space-6)" }}
        >
          {people.map((p, i) => (
            <Reveal key={p.n} delay={(i % 3) * 80}>
              <div
                style={{
                  display: "flex",
                  gap: "1rem",
                  alignItems: "center",
                  background: "var(--surface-card)",
                  border: "1px solid var(--border-subtle)",
                  borderRadius: "var(--radius-lg)",
                  padding: "1.1rem 1.3rem",
                  boxShadow: "var(--shadow-sm)",
                }}
              >
                <Avatar name={p.n} {...(p.img ? { src: p.img } : {})} size="lg" />
                <div>
                  <div
                    style={{
                      fontFamily: "var(--font-display)",
                      fontWeight: 600,
                      fontSize: "1.1rem",
                    }}
                  >
                    {p.n}
                  </div>
                  <div
                    style={{
                      fontFamily: "var(--font-sans)",
                      fontSize: "0.85rem",
                      color: "var(--text-muted)",
                    }}
                  >
                    {p.r}
                  </div>
                </div>
              </div>
            </Reveal>
          ))}
        </div>
      </div>
    </section>
  );
}

export function AcademicsContent() {
  return (
    <div>
      <PageHero
        crumb="Academics"
        eyebrow="Academics"
        title="Rigour, balance and joy in learning"
        lead="From play-based early years to Higher Secondary streams, our academics develop confident, curious and grounded young people."
        image={IMG.program}
      />
      <Streams />
      <Achievements />
      <Faculty />
    </div>
  );
}
