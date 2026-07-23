"use client";

/* Home page — heritage timeline, principal, testimonials, news & events, admissions CTA. */

import React from "react";

import { Avatar, Badge, Button } from "../ds";
import { IMG } from "../site/content";
import { Icon } from "../site/Icon";
import { Img } from "../site/Img";
import { Kicker } from "../site/Kicker";
import { Reveal } from "../site/Reveal";

export function Timeline() {
  const milestones = [
    {
      year: "1869",
      t: "The school is founded",
      d: "Established by the Gujarati community to bring quality education to Kozhikode.",
    },
    {
      year: "1950s",
      t: "Recognition & growth",
      d: "Becomes a recognised institution, expanding from primary to secondary.",
    },
    {
      year: "1990s",
      t: "A serene new campus",
      d: "The school grows into its eco-friendly campus near Mananchira.",
    },
    {
      year: "Today",
      t: "Higher Secondary excellence",
      d: "Science & Commerce streams, modern labs and a 150-year living legacy.",
    },
  ];
  const [active, setActive] = React.useState(0);
  const current = milestones[active] ?? milestones[0]!;
  return (
    <section className="section">
      <div className="container container--wide">
        <Reveal style={{ textAlign: "center", marginBottom: "var(--space-12)" }}>
          <Kicker>
            <span style={{ display: "inline-flex", margin: "0 auto" }}>Since 1869</span>
          </Kicker>
          <h2 style={{ fontSize: "var(--text-section)", fontWeight: 500, marginTop: "0.8rem" }}>
            One hundred and fifty years, one purpose
          </h2>
        </Reveal>
        <Reveal>
          <div
            style={{
              position: "relative",
              display: "flex",
              justifyContent: "space-between",
              margin: "0 auto 2.6rem",
              maxWidth: 880,
            }}
          >
            <div
              style={{
                position: "absolute",
                top: 13,
                left: "6%",
                right: "6%",
                height: 2,
                background: "var(--sand-300)",
              }}
            />
            <div
              style={{
                position: "absolute",
                top: 13,
                left: "6%",
                width: `${(active / (milestones.length - 1)) * 88}%`,
                height: 2,
                background: "var(--gold-500)",
                transition: "width var(--dur-slow) var(--ease-out)",
              }}
            />
            {milestones.map((m, i) => (
              <button
                key={m.year}
                type="button"
                onClick={() => setActive(i)}
                style={{
                  position: "relative",
                  zIndex: 1,
                  background: "transparent",
                  border: "none",
                  cursor: "pointer",
                  display: "flex",
                  flexDirection: "column",
                  alignItems: "center",
                  gap: "0.6rem",
                  flex: 1,
                }}
              >
                <span
                  style={{
                    width: 26,
                    height: 26,
                    borderRadius: "50%",
                    background: i <= active ? "var(--gold-500)" : "var(--surface-card)",
                    border: `2px solid ${i <= active ? "var(--gold-500)" : "var(--sand-400)"}`,
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    transition: "all var(--dur)",
                  }}
                >
                  {i === active && (
                    <span
                      style={{
                        width: 9,
                        height: 9,
                        borderRadius: "50%",
                        background: "var(--maroon-900)",
                      }}
                    />
                  )}
                </span>
                <span
                  style={{
                    fontFamily: "var(--font-display)",
                    fontWeight: 600,
                    fontSize: "1.05rem",
                    color: i === active ? "var(--maroon-800)" : "var(--text-muted)",
                  }}
                >
                  {m.year}
                </span>
              </button>
            ))}
          </div>
        </Reveal>
        <Reveal>
          <div style={{ maxWidth: 680, margin: "0 auto", textAlign: "center" }}>
            <h3
              style={{
                fontFamily: "var(--font-display)",
                fontSize: "1.7rem",
                fontWeight: 500,
                marginBottom: "0.7rem",
              }}
            >
              {current.t}
            </h3>
            <p
              style={{
                fontFamily: "var(--font-sans)",
                fontSize: "1.05rem",
                lineHeight: 1.7,
                color: "var(--text-secondary)",
              }}
            >
              {current.d}
            </p>
          </div>
        </Reveal>
      </div>
    </section>
  );
}

export function Principal() {
  return (
    <section
      className="section"
      style={{ background: "var(--maroon-950)", color: "var(--cream-50)" }}
    >
      <div
        className="container container--wide principal-grid"
        style={{
          display: "grid",
          gridTemplateColumns: "0.8fr 1.2fr",
          gap: "var(--space-16)",
          alignItems: "center",
        }}
      >
        <Reveal>
          <div style={{ position: "relative", maxWidth: 360 }}>
            <Img
              src={IMG.principal}
              alt="Vimala Jayaraj, Principal"
              style={{
                borderRadius: "var(--radius-xl)",
                aspectRatio: "4/5",
                boxShadow: "var(--shadow-xl)",
              }}
            />
            <div
              style={{
                position: "absolute",
                bottom: "-18px",
                left: "-18px",
                background: "var(--gold-500)",
                color: "var(--ink-900)",
                borderRadius: "var(--radius-md)",
                padding: "0.7rem 1rem",
                fontFamily: "var(--font-display)",
                boxShadow: "var(--shadow-lg)",
              }}
            >
              <div style={{ fontSize: "1.05rem", fontWeight: 600, lineHeight: 1.1 }}>
                Vimala Jayaraj
              </div>
              <div
                style={{
                  fontFamily: "var(--font-sans)",
                  fontSize: "0.72rem",
                  letterSpacing: "0.1em",
                  textTransform: "uppercase",
                }}
              >
                Principal
              </div>
            </div>
          </div>
        </Reveal>
        <Reveal delay={120}>
          <Kicker tone="inverse">Principal&apos;s Desk</Kicker>
          <Icon
            name="quotes"
            weight="fill"
            size={44}
            style={{ color: "var(--gold-400)", margin: "1.2rem 0 0.5rem", display: "block" }}
          />
          <p
            style={{
              fontFamily: "var(--font-serif)",
              fontSize: "clamp(1.3rem, 1rem + 1.2vw, 1.85rem)",
              lineHeight: 1.5,
              fontWeight: 400,
              fontStyle: "italic",
              color: "var(--cream-50)",
              marginBottom: "1.6rem",
              maxWidth: "34ch",
            }}
          >
            I am honoured to lead an institution that has been a beacon of education for over 153
            years — nurturing the total development of each child in a serene, eco-friendly home of
            learning.
          </p>
          <Button
            variant="inverse"
            href="/heritage"
            iconRight={<Icon name="arrow-right" size={16} />}
          >
            Read the full message
          </Button>
        </Reveal>
      </div>
    </section>
  );
}

export function Testimonials() {
  const quotes = [
    {
      q: "The teachers know my daughter as an individual. She has grown in confidence and kindness in equal measure.",
      n: "Meera Nair",
      r: "Parent, Class VI",
    },
    {
      q: "Gujarati gave me roots and wings — discipline, friendships and the curiosity that carried me to medical college.",
      n: "Arjun Menon",
      r: "Alumnus, 2016",
    },
    {
      q: "A green, calm campus where my son actually looks forward to going to school every morning.",
      n: "Priya Shah",
      r: "Parent, Class III",
    },
  ];
  const [i, setI] = React.useState(0);
  React.useEffect(() => {
    const t = setInterval(() => setI((p) => (p + 1) % quotes.length), 6000);
    return () => clearInterval(t);
  }, [quotes.length]);
  const q = quotes[i] ?? quotes[0]!;
  return (
    <section className="section">
      <div className="container container--narrow" style={{ textAlign: "center" }}>
        <Reveal>
          <Kicker>
            <span style={{ display: "inline-flex", margin: "0 auto" }}>In their words</span>
          </Kicker>
          <div style={{ position: "relative", marginTop: "2rem", minHeight: 200 }}>
            <p
              style={{
                fontFamily: "var(--font-serif)",
                fontSize: "clamp(1.4rem, 1.1rem + 1.4vw, 2.1rem)",
                lineHeight: 1.45,
                color: "var(--text-primary)",
                fontStyle: "italic",
                marginBottom: "1.8rem",
              }}
            >
              &ldquo;{q.q}&rdquo;
            </p>
            <div
              style={{
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                gap: "0.8rem",
              }}
            >
              <Avatar name={q.n} size="md" ring />
              <div style={{ textAlign: "left" }}>
                <div
                  style={{ fontFamily: "var(--font-sans)", fontWeight: 700, fontSize: "0.95rem" }}
                >
                  {q.n}
                </div>
                <div
                  style={{
                    fontFamily: "var(--font-sans)",
                    fontSize: "0.82rem",
                    color: "var(--text-muted)",
                  }}
                >
                  {q.r}
                </div>
              </div>
            </div>
          </div>
          <div
            style={{ display: "flex", gap: "0.5rem", justifyContent: "center", marginTop: "2rem" }}
          >
            {quotes.map((_, k) => (
              <button
                key={k}
                type="button"
                onClick={() => setI(k)}
                aria-label={`Quote ${k + 1}`}
                style={{
                  width: k === i ? 28 : 10,
                  height: 10,
                  borderRadius: "var(--radius-pill)",
                  border: "none",
                  cursor: "pointer",
                  background: k === i ? "var(--maroon-700)" : "var(--sand-400)",
                  transition: "all var(--dur)",
                }}
              />
            ))}
          </div>
        </Reveal>
      </div>
    </section>
  );
}

export function News() {
  const items = [
    { img: IMG.news_plusone, d: "27", m: "Jun", t: "Plus One Admission 2024-25", c: "Admissions" },
    { img: IMG.news_mla, d: "03", m: "Jul", t: "MLA's Excellence Award 2023", c: "Achievement" },
    { img: IMG.news_yoga, d: "21", m: "Jun", t: "International Yoga Day", c: "Event" },
    { img: IMG.news_ocean, d: "08", m: "Jun", t: "World Ocean Day", c: "Event" },
  ];
  return (
    <section className="section" style={{ background: "var(--surface-raised)" }}>
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
            <Kicker>Latest happenings</Kicker>
            <h2 style={{ fontSize: "var(--text-section)", fontWeight: 500, marginTop: "0.8rem" }}>
              News &amp; Events
            </h2>
          </div>
          <Button variant="ghost" href="/gallery" iconRight={<Icon name="arrow-right" size={16} />}>
            View all news
          </Button>
        </Reveal>
        <div
          className="cards-4"
          style={{ display: "grid", gridTemplateColumns: "repeat(4,1fr)", gap: "var(--space-6)" }}
        >
          {items.map((n, i) => (
            <Reveal key={n.t} delay={i * 80} style={{ height: "100%" }}>
              <article
                className="news-card"
                style={{
                  background: "var(--surface-card)",
                  borderRadius: "var(--radius-lg)",
                  overflow: "hidden",
                  boxShadow: "var(--shadow-md)",
                  height: "100%",
                  display: "flex",
                  flexDirection: "column",
                }}
              >
                <div style={{ position: "relative", overflow: "hidden" }}>
                  <Img src={n.img} alt={n.t} style={{ height: 170 }} />
                  <div
                    style={{
                      position: "absolute",
                      top: 12,
                      left: 12,
                      background: "var(--surface-card)",
                      borderRadius: "var(--radius-sm)",
                      padding: "0.35rem 0.6rem",
                      textAlign: "center",
                      boxShadow: "var(--shadow-sm)",
                    }}
                  >
                    <div
                      style={{
                        fontFamily: "var(--font-display)",
                        fontWeight: 600,
                        fontSize: "1.15rem",
                        lineHeight: 1,
                        color: "var(--maroon-800)",
                      }}
                    >
                      {n.d}
                    </div>
                    <div
                      style={{
                        fontFamily: "var(--font-sans)",
                        fontSize: "0.62rem",
                        letterSpacing: "0.1em",
                        textTransform: "uppercase",
                        color: "var(--text-muted)",
                      }}
                    >
                      {n.m}
                    </div>
                  </div>
                </div>
                <div
                  style={{
                    padding: "1.1rem 1.2rem 1.3rem",
                    display: "flex",
                    flexDirection: "column",
                    gap: "0.6rem",
                    flex: 1,
                  }}
                >
                  <Badge tone="neutral" style={{ alignSelf: "flex-start" }}>
                    {n.c}
                  </Badge>
                  <h3 style={{ fontSize: "1.05rem", fontWeight: 600, lineHeight: 1.3 }}>{n.t}</h3>
                  <span
                    style={{
                      marginTop: "auto",
                      fontFamily: "var(--font-sans)",
                      fontWeight: 600,
                      fontSize: "0.85rem",
                      color: "var(--maroon-700)",
                      display: "inline-flex",
                      gap: "0.3rem",
                      alignItems: "center",
                    }}
                  >
                    Read more <Icon name="arrow-right" size={14} />
                  </span>
                </div>
              </article>
            </Reveal>
          ))}
        </div>
      </div>
    </section>
  );
}

export function AdmissionsCTA() {
  return (
    <section style={{ padding: "var(--section-y) 0" }}>
      <div className="container container--wide">
        <Reveal>
          <div
            className="cta-band"
            style={{
              position: "relative",
              overflow: "hidden",
              borderRadius: "var(--radius-2xl)",
              background: "linear-gradient(120deg, var(--maroon-800), var(--maroon-950))",
              padding: "clamp(2.5rem, 5vw, 4.5rem)",
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              gap: "var(--space-12)",
              flexWrap: "wrap",
            }}
          >
            <img
              src="/assets/crest-cream.png"
              alt=""
              style={{
                position: "absolute",
                right: "-40px",
                bottom: "-60px",
                height: "150%",
                opacity: 0.06,
              }}
            />
            <div style={{ position: "relative", maxWidth: "32ch" }}>
              <Badge
                tone="gold"
                dot
                style={{
                  background: "rgba(248,240,220,0.16)",
                  color: "var(--gold-300)",
                  marginBottom: "1.2rem",
                }}
              >
                Admissions Open 2026-27
              </Badge>
              <h2
                style={{
                  color: "var(--cream-50)",
                  fontWeight: 500,
                  fontSize: "clamp(1.9rem, 1.3rem + 2.4vw, 3rem)",
                  lineHeight: 1.08,
                }}
              >
                Begin your child&apos;s journey with us
              </h2>
              <p
                style={{
                  fontFamily: "var(--font-sans)",
                  color: "var(--maroon-100)",
                  fontSize: "1.05rem",
                  marginTop: "1rem",
                  lineHeight: 1.6,
                }}
              >
                A warm, guided admissions experience — enquire today and book a visit to our campus.
              </p>
            </div>
            <div
              style={{
                position: "relative",
                display: "flex",
                flexDirection: "column",
                gap: "0.85rem",
                minWidth: 240,
              }}
            >
              <Button
                size="lg"
                variant="accent"
                fullWidth
                href="/admissions"
                iconRight={<Icon name="arrow-right" size={18} />}
              >
                Apply Now
              </Button>
              <Button
                size="lg"
                variant="inverse"
                fullWidth
                href="/contact"
                iconLeft={<Icon name="calendar-check" size={18} />}
              >
                Book a Campus Visit
              </Button>
            </div>
          </div>
        </Reveal>
      </div>
    </section>
  );
}
