"use client";

/* Contact page — info cards, map, book-a-visit form, newsletter. */

import React from "react";

import { Button, Input, Select } from "../ds";
import { IMG } from "../site/content";
import { Icon } from "../site/Icon";
import { Kicker } from "../site/Kicker";
import { PageHero } from "../site/PageHero";
import { Reveal } from "../site/Reveal";

function Newsletter() {
  const [done, setDone] = React.useState(false);
  return (
    <section className="section" style={{ paddingTop: 0 }}>
      <div className="container container--wide">
        <Reveal>
          <div
            style={{
              borderRadius: "var(--radius-2xl)",
              background: "var(--surface-raised)",
              border: "1px solid var(--border-subtle)",
              padding: "clamp(2rem, 4vw, 3.5rem)",
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
              gap: "var(--space-12)",
              flexWrap: "wrap",
            }}
          >
            <div style={{ maxWidth: "34ch" }}>
              <Kicker>Stay in the loop</Kicker>
              <h2
                style={{
                  fontSize: "var(--text-section)",
                  fontWeight: 500,
                  margin: "0.8rem 0 0.6rem",
                }}
              >
                School newsletter
              </h2>
              <p
                style={{
                  fontFamily: "var(--font-sans)",
                  color: "var(--text-secondary)",
                  fontSize: "1rem",
                  lineHeight: 1.6,
                }}
              >
                Events, results and stories from campus — a few times a term, never spam.
              </p>
            </div>
            <form
              onSubmit={(e) => {
                e.preventDefault();
                setDone(true);
              }}
              style={{
                display: "flex",
                gap: "0.7rem",
                flex: 1,
                minWidth: 280,
                maxWidth: 460,
                alignItems: "flex-start",
              }}
            >
              {done ? (
                <div
                  style={{
                    fontFamily: "var(--font-sans)",
                    color: "var(--green-600)",
                    fontWeight: 600,
                    display: "flex",
                    gap: "0.5rem",
                    alignItems: "center",
                  }}
                >
                  <Icon name="check-circle" weight="fill" size={22} /> You&apos;re subscribed —
                  thank you!
                </div>
              ) : (
                <>
                  <Input
                    containerStyle={{ flex: 1 }}
                    type="email"
                    required
                    placeholder="Your email address"
                    icon={<Icon name="envelope-simple" size={16} />}
                  />
                  <Button type="submit" size="md">
                    Subscribe
                  </Button>
                </>
              )}
            </form>
          </div>
        </Reveal>
      </div>
    </section>
  );
}

export function ContactContent() {
  const [sent, setSent] = React.useState(false);
  const cards = [
    { i: "map-pin", t: "Visit us", lines: ["Beach Road, Mananchira", "Kozhikode, Kerala 673032"] },
    { i: "phone", t: "Call us", lines: ["0495 236 5215", "Mon–Sat, 9am – 4pm"] },
    {
      i: "envelope-simple",
      t: "Email",
      lines: ["info@srigujaratividyalaya.com", "admissions@srigujaratividyalaya.com"],
    },
  ];
  return (
    <div>
      <PageHero
        crumb="Contact"
        eyebrow="Get in touch"
        title="We'd love to hear from you"
        lead="Questions about admissions, a campus visit, or careers at Gujarati Vidyalaya — reach out and we'll respond promptly."
        image={IMG.campus}
      />

      <section className="section">
        <div className="container container--wide">
          <div
            className="cards-3"
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(3,1fr)",
              gap: "var(--space-6)",
              marginBottom: "var(--space-12)",
            }}
          >
            {cards.map((c, i) => (
              <Reveal key={c.t} delay={i * 80}>
                <div
                  style={{
                    background: "var(--surface-card)",
                    border: "1px solid var(--border-subtle)",
                    borderRadius: "var(--radius-lg)",
                    padding: "1.8rem",
                    boxShadow: "var(--shadow-sm)",
                    height: "100%",
                  }}
                >
                  <div
                    style={{
                      width: 50,
                      height: 50,
                      borderRadius: "var(--radius-md)",
                      background: "var(--maroon-50)",
                      color: "var(--maroon-700)",
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      marginBottom: "1.1rem",
                    }}
                  >
                    <Icon name={c.i} size={26} />
                  </div>
                  <h3 style={{ fontSize: "1.2rem", fontWeight: 600, marginBottom: "0.6rem" }}>
                    {c.t}
                  </h3>
                  {c.lines.map((l) => (
                    <div
                      key={l}
                      style={{
                        fontFamily: "var(--font-sans)",
                        fontSize: "0.95rem",
                        color: "var(--text-secondary)",
                        lineHeight: 1.6,
                      }}
                    >
                      {l}
                    </div>
                  ))}
                </div>
              </Reveal>
            ))}
          </div>

          <div
            className="contact-grid"
            style={{
              display: "grid",
              gridTemplateColumns: "1.1fr 0.9fr",
              gap: "var(--space-12)",
              alignItems: "stretch",
            }}
          >
            <Reveal>
              <div
                style={{
                  background: "var(--surface-card)",
                  borderRadius: "var(--radius-xl)",
                  padding: "clamp(1.5rem, 3vw, 2.4rem)",
                  boxShadow: "var(--shadow-lg)",
                  border: "1px solid var(--border-subtle)",
                  height: "100%",
                }}
              >
                <Kicker>Book a campus visit</Kicker>
                <h2 style={{ fontSize: "1.8rem", fontWeight: 500, margin: "0.8rem 0 1.4rem" }}>
                  Come and see our campus
                </h2>
                {sent ? (
                  <div style={{ textAlign: "center", padding: "1.5rem 0" }}>
                    <span
                      style={{
                        width: 60,
                        height: 60,
                        borderRadius: "50%",
                        background: "var(--green-100)",
                        color: "var(--green-600)",
                        display: "inline-flex",
                        alignItems: "center",
                        justifyContent: "center",
                        marginBottom: "1rem",
                      }}
                    >
                      <Icon name="check-circle" weight="fill" size={36} />
                    </span>
                    <h3 style={{ fontSize: "1.4rem", fontWeight: 600 }}>Visit requested</h3>
                    <p
                      style={{
                        fontFamily: "var(--font-sans)",
                        color: "var(--text-secondary)",
                        marginTop: "0.4rem",
                      }}
                    >
                      We&apos;ll confirm your slot by phone shortly.
                    </p>
                  </div>
                ) : (
                  <form
                    onSubmit={(e) => {
                      e.preventDefault();
                      setSent(true);
                    }}
                    style={{ display: "flex", flexDirection: "column", gap: "1.1rem" }}
                  >
                    <Input label="Your name" required placeholder="Full name" />
                    <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "1.1rem" }}>
                      <Input
                        label="Mobile"
                        required
                        placeholder="10-digit number"
                        icon={<Icon name="phone" size={16} />}
                      />
                      <Input label="Preferred date" type="date" />
                    </div>
                    <Select
                      label="Reason for visit"
                      placeholder="Select"
                      options={[
                        "Admission enquiry",
                        "Campus tour",
                        "Meet the principal",
                        "Careers / other",
                      ]}
                    />
                    <Button
                      type="submit"
                      size="lg"
                      fullWidth
                      iconRight={<Icon name="arrow-right" size={18} />}
                    >
                      Request a Visit
                    </Button>
                  </form>
                )}
              </div>
            </Reveal>
            <Reveal delay={120}>
              <div
                style={{
                  borderRadius: "var(--radius-xl)",
                  overflow: "hidden",
                  boxShadow: "var(--shadow-md)",
                  border: "1px solid var(--border-subtle)",
                  height: "100%",
                  minHeight: 360,
                  position: "relative",
                  background: "var(--surface-sunken)",
                }}
              >
                <iframe
                  title="Map"
                  src="https://www.openstreetmap.org/export/embed.html?bbox=75.77%2C11.24%2C75.80%2C11.27&layer=mapnik&marker=11.2588%2C75.7804"
                  style={{
                    width: "100%",
                    height: "100%",
                    border: 0,
                    filter: "saturate(0.85) sepia(0.08)",
                  }}
                />
                <div
                  style={{
                    position: "absolute",
                    left: 18,
                    bottom: 18,
                    background: "var(--surface-card)",
                    borderRadius: "var(--radius-md)",
                    padding: "0.9rem 1.1rem",
                    boxShadow: "var(--shadow-md)",
                    display: "flex",
                    gap: "0.7rem",
                    alignItems: "center",
                  }}
                >
                  <Icon
                    name="map-pin"
                    weight="fill"
                    size={22}
                    style={{ color: "var(--maroon-700)" }}
                  />
                  <div
                    style={{ fontFamily: "var(--font-sans)", fontSize: "0.85rem", fontWeight: 600 }}
                  >
                    Mananchira, Kozhikode
                  </div>
                </div>
              </div>
            </Reveal>
          </div>
        </div>
      </section>

      <Newsletter />
    </div>
  );
}
