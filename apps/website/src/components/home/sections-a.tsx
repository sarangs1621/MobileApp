"use client";

/* Home page — heritage hero, trust bar, about, at-a-glance, academics, facilities. */

import { Badge, Button, Stat } from "../ds";
import { IMG } from "../site/content";
import { Icon } from "../site/Icon";
import { Img } from "../site/Img";
import { Kicker } from "../site/Kicker";
import { Reveal } from "../site/Reveal";

export function Hero() {
  return (
    <section
      style={{
        position: "relative",
        minHeight: "min(92vh, 820px)",
        display: "flex",
        alignItems: "flex-end",
        overflow: "hidden",
      }}
    >
      <div className="hero-bg" style={{ position: "absolute", inset: 0 }}>
        <Img
          src={IMG.campus}
          alt="Sri Gujarati Vidyalaya campus"
          style={{ position: "absolute", inset: 0, width: "100%", height: "100%" }}
        />
      </div>
      <div
        style={{
          position: "absolute",
          inset: 0,
          background:
            "linear-gradient(180deg, rgba(58,22,7,0.58) 0%, rgba(58,22,7,0.18) 32%, rgba(58,22,7,0.86) 100%)",
        }}
      />
      <div
        className="container container--wide"
        style={{
          position: "relative",
          paddingBottom: "var(--space-12)",
          paddingTop: "var(--space-16)",
          width: "100%",
        }}
      >
        <Reveal>
          <Badge
            tone="gold"
            dot
            style={{
              marginBottom: "1.4rem",
              background: "rgba(248,240,220,0.16)",
              color: "var(--gold-300)",
              backdropFilter: "blur(6px)",
            }}
          >
            Established 1869 · Kozhikode
          </Badge>
        </Reveal>
        <Reveal delay={80}>
          <h1
            style={{
              color: "var(--cream-50)",
              fontWeight: 500,
              fontSize: "var(--text-hero)",
              lineHeight: 1.02,
              maxWidth: "16ch",
              letterSpacing: "-0.02em",
            }}
          >
            A heritage of learning,{" "}
            <span style={{ fontStyle: "italic", color: "var(--gold-300)", fontWeight: 400 }}>
              for every child.
            </span>
          </h1>
        </Reveal>
        <Reveal delay={160}>
          <p
            style={{
              color: "var(--cream-100)",
              fontFamily: "var(--font-sans)",
              fontSize: "var(--text-lead)",
              maxWidth: "46ch",
              marginTop: "1.4rem",
              lineHeight: 1.6,
              opacity: 0.95,
            }}
          >
            For over 150 years, Sri Gujarati Vidyalaya has nurtured the total development of the
            child — where wisdom, humility and joy grow together.
          </p>
        </Reveal>
        <Reveal delay={240}>
          <div style={{ display: "flex", gap: "0.85rem", marginTop: "2.2rem", flexWrap: "wrap" }}>
            <Button size="lg" href="/admissions" iconRight={<Icon name="arrow-right" size={18} />}>
              Apply for Admission
            </Button>
            <Button
              size="lg"
              variant="inverse"
              href="/gallery"
              iconLeft={<Icon name="play-circle" weight="fill" size={20} />}
            >
              Take a Campus Tour
            </Button>
          </div>
        </Reveal>
        {/* frosted glass stat strip */}
        <Reveal delay={340}>
          <div
            className="hero-strip"
            style={{
              marginTop: "var(--space-12)",
              display: "grid",
              gridTemplateColumns: "repeat(3, max-content)",
              gap: "clamp(1.5rem, 4vw, 3.5rem)",
              padding: "1.3rem 1.7rem",
              borderRadius: "var(--radius-lg)",
              background: "rgba(36,26,17,0.34)",
              backdropFilter: "blur(14px) saturate(150%)",
              border: "1px solid rgba(248,240,220,0.18)",
              width: "max-content",
              maxWidth: "100%",
            }}
          >
            {[
              { v: "156+", l: "Years of Legacy" },
              { v: "2,400+", l: "Students" },
              { v: "98%", l: "Board Results" },
            ].map((s) => (
              <div key={s.l}>
                <div
                  style={{
                    fontFamily: "var(--font-display)",
                    fontWeight: 500,
                    fontSize: "clamp(1.6rem, 1.2rem + 1vw, 2.1rem)",
                    lineHeight: 1,
                    color: "var(--gold-300)",
                  }}
                >
                  {s.v}
                </div>
                <div
                  style={{
                    fontFamily: "var(--font-sans)",
                    fontSize: "0.78rem",
                    letterSpacing: "0.04em",
                    color: "var(--cream-100)",
                    marginTop: "0.35rem",
                  }}
                >
                  {s.l}
                </div>
              </div>
            ))}
          </div>
        </Reveal>
      </div>
      {/* scroll cue */}
      <div
        style={{
          position: "absolute",
          bottom: "1.4rem",
          left: "50%",
          transform: "translateX(-50%)",
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          gap: "0.4rem",
          color: "var(--cream-100)",
          pointerEvents: "none",
        }}
      >
        <span
          style={{
            fontFamily: "var(--font-sans)",
            fontSize: "0.66rem",
            letterSpacing: "0.18em",
            textTransform: "uppercase",
            opacity: 0.7,
          }}
        >
          Scroll
        </span>
        <Icon name="caret-down" size={18} className="scroll-cue" />
      </div>
    </section>
  );
}

export function TrustBar() {
  const items = [
    { icon: "seal-check", label: "Kerala Govt. Recognised" },
    { icon: "translate", label: "English Medium" },
    { icon: "users-three", label: "Co-Educational" },
    { icon: "tree", label: "Eco-Friendly Campus" },
  ];
  return (
    <div
      style={{ background: "var(--surface-card)", borderBottom: "1px solid var(--border-subtle)" }}
    >
      <div
        className="container container--wide trust-grid"
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(4,1fr)",
          gap: "1rem",
          padding: "1.6rem 0",
        }}
      >
        {items.map((it) => (
          <div
            key={it.label}
            style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              gap: "0.7rem",
              color: "var(--maroon-700)",
            }}
          >
            <Icon name={it.icon} size={26} weight="regular" />
            <span
              style={{
                fontFamily: "var(--font-sans)",
                fontWeight: 600,
                fontSize: "0.92rem",
                color: "var(--ink-800)",
              }}
            >
              {it.label}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}

export function About() {
  return (
    <section className="section">
      <div
        className="container container--wide about-grid"
        style={{
          display: "grid",
          gridTemplateColumns: "1fr 1fr",
          gap: "var(--space-16)",
          alignItems: "center",
        }}
      >
        <Reveal>
          <Kicker>Welcome to Gujarati Vidyalaya</Kicker>
          <h2
            style={{
              fontSize: "var(--text-section)",
              fontWeight: 500,
              margin: "1rem 0 1.2rem",
              maxWidth: "18ch",
            }}
          >
            Education that develops the <em style={{ color: "var(--maroon-700)" }}>whole</em> child
          </h2>
          <p
            style={{
              fontFamily: "var(--font-sans)",
              fontSize: "1.05rem",
              lineHeight: 1.7,
              color: "var(--text-secondary)",
              marginBottom: "1rem",
            }}
          >
            Sri Gujarati Vidyalaya Higher Secondary School aims at the total development of the
            child through education — where the child acquires the wisdom of humility and radiates
            happiness and contentment around.
          </p>
          <p
            style={{
              fontFamily: "var(--font-sans)",
              fontSize: "1.05rem",
              lineHeight: 1.7,
              color: "var(--text-secondary)",
              marginBottom: "1.8rem",
            }}
          >
            A Kerala Government recognised unaided English-medium co-educational school, managed by
            the Sri Gujarati Vidyalaya Association — a charitable welfare society established to
            bring quality and learning together.
          </p>
          <Button
            variant="secondary"
            href="/heritage"
            iconRight={<Icon name="arrow-right" size={16} />}
          >
            Our story since 1869
          </Button>
        </Reveal>
        <Reveal delay={120}>
          <div style={{ position: "relative" }}>
            <Img
              src={IMG.a1}
              alt="Students at Gujarati Vidyalaya"
              style={{
                borderRadius: "var(--radius-xl)",
                aspectRatio: "4/5",
                boxShadow: "var(--shadow-lg)",
              }}
            />
            <Img
              src={IMG.a2}
              alt="Campus life"
              style={{
                position: "absolute",
                width: "52%",
                aspectRatio: "1",
                right: "-6%",
                bottom: "-10%",
                borderRadius: "var(--radius-lg)",
                border: "6px solid var(--surface-page)",
                boxShadow: "var(--shadow-lg)",
              }}
            />
            <div
              style={{
                position: "absolute",
                top: "-22px",
                left: "-22px",
                background: "var(--maroon-900)",
                color: "var(--cream-50)",
                borderRadius: "var(--radius-lg)",
                padding: "1rem 1.2rem",
                boxShadow: "var(--shadow-brand)",
                display: "flex",
                alignItems: "center",
                gap: "0.8rem",
              }}
            >
              <img src="/assets/crest-cream.png" alt="" style={{ height: 44 }} />
              <div>
                <div
                  style={{
                    fontFamily: "var(--font-display)",
                    fontSize: "1.6rem",
                    lineHeight: 1,
                    color: "var(--gold-300)",
                  }}
                >
                  156
                </div>
                <div
                  style={{
                    fontFamily: "var(--font-sans)",
                    fontSize: "0.72rem",
                    letterSpacing: "0.1em",
                    textTransform: "uppercase",
                  }}
                >
                  Years
                </div>
              </div>
            </div>
          </div>
        </Reveal>
      </div>
    </section>
  );
}

export function Glance() {
  const stats = [
    { value: 156, suffix: "+", label: "Years of Legacy" },
    { value: 2400, suffix: "+", label: "Students" },
    { value: 120, suffix: "+", label: "Faculty Members" },
    { value: 98, suffix: "%", label: "Board Results" },
  ];
  return (
    <section style={{ background: "var(--maroon-900)", position: "relative", overflow: "hidden" }}>
      <img
        src="/assets/crest-cream.png"
        alt=""
        style={{
          position: "absolute",
          right: "-60px",
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
            <span style={{ display: "inline-flex", margin: "0 auto" }}>School at a glance</span>
          </Kicker>
          <h2
            style={{
              color: "var(--cream-50)",
              fontWeight: 500,
              fontSize: "var(--text-section)",
              marginTop: "0.8rem",
            }}
          >
            A legacy you can measure
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

export function Academics() {
  const stages = [
    {
      icon: "baby",
      t: "Pre-Primary",
      d: "Play-based early years where curiosity is the first lesson.",
    },
    {
      icon: "pencil-simple-line",
      t: "Primary",
      d: "Strong foundations in language, numeracy and values.",
    },
    {
      icon: "books",
      t: "Secondary",
      d: "Rigorous academics balanced with sport, arts and service.",
    },
    {
      icon: "graduation-cap",
      t: "Higher Secondary",
      d: "Science & Commerce streams that open every future.",
    },
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
            <Kicker>Academics</Kicker>
            <h2
              style={{
                fontSize: "var(--text-section)",
                fontWeight: 500,
                marginTop: "0.8rem",
                maxWidth: "16ch",
              }}
            >
              A continuous journey, Pre-KG to Plus Two
            </h2>
          </div>
          <Button
            variant="ghost"
            href="/academics"
            iconRight={<Icon name="arrow-right" size={16} />}
          >
            Explore academics
          </Button>
        </Reveal>
        <div
          className="cards-4"
          style={{ display: "grid", gridTemplateColumns: "repeat(4,1fr)", gap: "var(--space-6)" }}
        >
          {stages.map((s, i) => (
            <Reveal key={s.t} delay={i * 80} style={{ height: "100%" }}>
              <div
                className="stage-card"
                style={{
                  background: "var(--surface-card)",
                  border: "1px solid var(--border-subtle)",
                  borderRadius: "var(--radius-lg)",
                  padding: "1.6rem",
                  height: "100%",
                  boxShadow: "var(--shadow-sm)",
                }}
              >
                <div
                  style={{
                    width: 52,
                    height: 52,
                    borderRadius: "var(--radius-md)",
                    background: "var(--maroon-50)",
                    color: "var(--maroon-700)",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    marginBottom: "1.1rem",
                  }}
                >
                  <Icon name={s.icon} size={28} />
                </div>
                <h3 style={{ fontSize: "1.25rem", fontWeight: 600, marginBottom: "0.5rem" }}>
                  {s.t}
                </h3>
                <p
                  style={{
                    fontFamily: "var(--font-sans)",
                    fontSize: "0.92rem",
                    lineHeight: 1.6,
                    color: "var(--text-secondary)",
                  }}
                >
                  {s.d}
                </p>
              </div>
            </Reveal>
          ))}
        </div>
      </div>
    </section>
  );
}

export function Facilities() {
  const fac = [
    { icon: "desktop", t: "Computer Lab" },
    { icon: "flask", t: "Science Labs" },
    { icon: "books", t: "Library" },
    { icon: "bus", t: "Transportation" },
    { icon: "fork-knife", t: "Canteen" },
    { icon: "first-aid-kit", t: "Medical Care" },
    { icon: "swimming-pool", t: "Swimming Pools" },
    { icon: "basketball", t: "Play Courts" },
    { icon: "microphone-stage", t: "Open-Air Auditorium" },
    { icon: "tree", t: "Green Campus" },
  ];
  return (
    <section className="section" style={{ background: "var(--surface-raised)" }}>
      <div className="container container--wide">
        <div
          className="fac-layout"
          style={{
            display: "grid",
            gridTemplateColumns: "1fr 1.1fr",
            gap: "var(--space-16)",
            alignItems: "center",
          }}
        >
          <Reveal>
            <Img
              src={IMG.faculty}
              alt="Campus facilities"
              style={{
                borderRadius: "var(--radius-xl)",
                aspectRatio: "5/4",
                boxShadow: "var(--shadow-lg)",
              }}
            />
          </Reveal>
          <Reveal delay={100}>
            <Kicker>Campus &amp; Facilities</Kicker>
            <h2
              style={{
                fontSize: "var(--text-section)",
                fontWeight: 500,
                margin: "0.8rem 0 1.6rem",
                maxWidth: "18ch",
              }}
            >
              Everything a young mind needs to flourish
            </h2>
            <div
              className="fac-grid"
              style={{ display: "grid", gridTemplateColumns: "repeat(2,1fr)", gap: "0.8rem" }}
            >
              {fac.map((f) => (
                <div
                  key={f.t}
                  className="fac-item"
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: "0.8rem",
                    background: "var(--surface-card)",
                    border: "1px solid var(--border-subtle)",
                    borderRadius: "var(--radius-md)",
                    padding: "0.85rem 1rem",
                    cursor: "default",
                  }}
                >
                  <Icon
                    name={f.icon}
                    size={22}
                    className="fac-i"
                    style={{ color: "var(--gold-700)" }}
                  />
                  <span
                    className="fac-t"
                    style={{
                      fontFamily: "var(--font-sans)",
                      fontWeight: 500,
                      fontSize: "0.92rem",
                      color: "var(--text-primary)",
                    }}
                  >
                    {f.t}
                  </span>
                </div>
              ))}
            </div>
          </Reveal>
        </div>
      </div>
    </section>
  );
}
