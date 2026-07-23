"use client";

/* Gallery page — category filters, masonry, lightbox. */

import React from "react";

import { Badge } from "../ds";
import { IMG } from "../site/content";
import { Icon } from "../site/Icon";
import { Img } from "../site/Img";
import { PageHero } from "../site/PageHero";
import { Reveal } from "../site/Reveal";

interface Photo {
  src: string;
  cat: string;
  t: string;
}

const PHOTOS: Photo[] = [
  { src: IMG.campus, cat: "Campus", t: "The main campus" },
  { src: IMG.news_yoga, cat: "Celebrations", t: "International Yoga Day" },
  { src: IMG.a1, cat: "Academics", t: "In the classroom" },
  { src: IMG.news_ocean, cat: "Arts", t: "World Ocean Day" },
  { src: IMG.faculty, cat: "Campus", t: "Facilities" },
  { src: IMG.news_env, cat: "Celebrations", t: "World Environment Day" },
  { src: IMG.a2, cat: "Academics", t: "Learning together" },
  { src: IMG.news_mla, cat: "Sports", t: "Excellence Award" },
  { src: IMG.program, cat: "Arts", t: "Activities & programs" },
  { src: IMG.n1, cat: "Sports", t: "On the field" },
  { src: IMG.news_plusone, cat: "Academics", t: "Plus One" },
  { src: IMG.n2, cat: "Celebrations", t: "School event" },
];
const CATS = ["All", "Campus", "Academics", "Sports", "Celebrations", "Arts"];

export function GalleryContent() {
  const [cat, setCat] = React.useState("All");
  const [box, setBox] = React.useState<Photo | null>(null);
  const shown = cat === "All" ? PHOTOS : PHOTOS.filter((p) => p.cat === cat);
  return (
    <div>
      <PageHero
        crumb="Campus & Gallery"
        eyebrow="Campus life"
        title="Moments from our campus"
        lead="A glimpse of everyday life at Gujarati Vidyalaya — classrooms, celebrations, sport and the green campus our students call home."
        image={IMG.faculty}
      />
      <section className="section">
        <div className="container container--wide">
          <Reveal
            style={{
              display: "flex",
              gap: "0.6rem",
              flexWrap: "wrap",
              justifyContent: "center",
              marginBottom: "var(--space-10)",
            }}
          >
            {CATS.map((c) => (
              <button
                key={c}
                type="button"
                onClick={() => setCat(c)}
                style={{
                  padding: "0.55rem 1.1rem",
                  borderRadius: "var(--radius-pill)",
                  cursor: "pointer",
                  fontFamily: "var(--font-sans)",
                  fontWeight: 600,
                  fontSize: "0.88rem",
                  border: `1px solid ${cat === c ? "var(--maroon-700)" : "var(--border-strong)"}`,
                  background: cat === c ? "var(--maroon-700)" : "transparent",
                  color: cat === c ? "var(--cream-50)" : "var(--ink-700)",
                  transition: "all var(--dur-fast)",
                }}
              >
                {c}
              </button>
            ))}
          </Reveal>
          <div className="masonry" style={{ columnCount: 3, columnGap: "var(--space-5)" }}>
            {shown.map((p, i) => (
              <Reveal
                key={p.t + i}
                delay={(i % 6) * 60}
                style={{ breakInside: "avoid", marginBottom: "var(--space-5)" }}
              >
                <button
                  type="button"
                  className="gallery-tile"
                  onClick={() => setBox(p)}
                  style={{
                    display: "block",
                    width: "100%",
                    padding: 0,
                    border: "none",
                    cursor: "pointer",
                    borderRadius: "var(--radius-lg)",
                    overflow: "hidden",
                    position: "relative",
                    boxShadow: "var(--shadow-md)",
                    background: "var(--surface-card)",
                  }}
                >
                  <Img
                    src={p.src}
                    alt={p.t}
                    style={{
                      width: "100%",
                      aspectRatio: i % 3 === 0 ? "3/4" : i % 3 === 1 ? "4/3" : "1/1",
                    }}
                  />
                  <span
                    className="tile-cap"
                    style={{
                      position: "absolute",
                      inset: 0,
                      background: "linear-gradient(180deg, transparent 55%, rgba(58,22,7,0.75))",
                      display: "flex",
                      alignItems: "flex-end",
                      padding: "1rem",
                    }}
                  >
                    <span
                      style={{
                        color: "var(--cream-50)",
                        fontFamily: "var(--font-sans)",
                        fontWeight: 600,
                        fontSize: "0.9rem",
                        display: "flex",
                        justifyContent: "space-between",
                        width: "100%",
                        alignItems: "center",
                      }}
                    >
                      {p.t}
                      <Icon name="arrows-out-simple" size={16} />
                    </span>
                  </span>
                </button>
              </Reveal>
            ))}
          </div>
        </div>
      </section>

      {box && (
        <div
          onClick={() => setBox(null)}
          style={{
            position: "fixed",
            inset: 0,
            zIndex: 900,
            background: "rgba(22,15,9,0.88)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            padding: "var(--gutter)",
            backdropFilter: "blur(4px)",
          }}
        >
          <button
            type="button"
            onClick={() => setBox(null)}
            aria-label="Close"
            style={{
              position: "absolute",
              top: 24,
              right: 24,
              width: 48,
              height: 48,
              borderRadius: "50%",
              border: "1px solid var(--border-on-dark)",
              background: "rgba(252,249,243,0.08)",
              color: "var(--cream-50)",
              cursor: "pointer",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
            }}
          >
            <Icon name="x" size={24} />
          </button>
          <figure
            onClick={(e) => e.stopPropagation()}
            style={{ margin: 0, maxWidth: 980, width: "100%" }}
          >
            <Img
              src={box.src}
              alt={box.t}
              style={{
                width: "100%",
                maxHeight: "76vh",
                borderRadius: "var(--radius-lg)",
                boxShadow: "var(--shadow-xl)",
              }}
            />
            <figcaption
              style={{
                marginTop: "1rem",
                display: "flex",
                gap: "0.8rem",
                alignItems: "center",
                color: "var(--cream-50)",
              }}
            >
              <Badge
                tone="gold"
                style={{ background: "rgba(248,240,220,0.16)", color: "var(--gold-300)" }}
              >
                {box.cat}
              </Badge>
              <span
                style={{ fontFamily: "var(--font-serif)", fontSize: "1.2rem", fontStyle: "italic" }}
              >
                {box.t}
              </span>
            </figcaption>
          </figure>
        </div>
      )}
    </div>
  );
}
