"use client";

/* Admissions page — digital journey, enquiry form, fees & FAQ. */

import React from "react";

import { Accordion, Button, Checkbox, Input, Select } from "../ds";
import { IMG } from "../site/content";
import { Icon } from "../site/Icon";
import { Kicker } from "../site/Kicker";
import { PageHero } from "../site/PageHero";
import { Reveal } from "../site/Reveal";

function Journey() {
  const steps = [
    {
      n: "01",
      icon: "paper-plane-tilt",
      t: "Submit an Enquiry",
      d: "Tell us about your child in a two-minute form.",
    },
    {
      n: "02",
      icon: "chats-circle",
      t: "Personal Interaction",
      d: "A warm conversation with our admissions team and a child-friendly interaction.",
    },
    {
      n: "03",
      icon: "files",
      t: "Registration",
      d: "Complete the registration with the required documents.",
    },
    {
      n: "04",
      icon: "confetti",
      t: "Welcome to Gujarati",
      d: "Receive your offer and join the family — orientation follows.",
    },
  ];
  return (
    <section className="section">
      <div className="container container--wide">
        <Reveal style={{ textAlign: "center", marginBottom: "var(--space-12)" }}>
          <Kicker>
            <span style={{ display: "inline-flex", margin: "0 auto" }}>The admissions journey</span>
          </Kicker>
          <h2 style={{ fontSize: "var(--text-section)", fontWeight: 500, marginTop: "0.8rem" }}>
            Four simple, guided steps
          </h2>
        </Reveal>
        <div
          className="cards-4"
          style={{ display: "grid", gridTemplateColumns: "repeat(4,1fr)", gap: "var(--space-6)" }}
        >
          {steps.map((s, i) => (
            <Reveal key={s.n} delay={i * 90} style={{ height: "100%" }}>
              <div
                style={{
                  position: "relative",
                  background: "var(--surface-card)",
                  border: "1px solid var(--border-subtle)",
                  borderRadius: "var(--radius-lg)",
                  padding: "1.7rem 1.5rem",
                  height: "100%",
                  boxShadow: "var(--shadow-sm)",
                }}
              >
                <span
                  style={{
                    position: "absolute",
                    top: 16,
                    right: 18,
                    fontFamily: "var(--font-display)",
                    fontSize: "2.4rem",
                    color: "var(--cream-200)",
                    fontWeight: 600,
                    lineHeight: 1,
                  }}
                >
                  {s.n}
                </span>
                <div
                  style={{
                    width: 50,
                    height: 50,
                    borderRadius: "var(--radius-md)",
                    background: "var(--maroon-700)",
                    color: "var(--cream-50)",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    marginBottom: "1.1rem",
                  }}
                >
                  <Icon name={s.icon} size={26} />
                </div>
                <h3 style={{ fontSize: "1.2rem", fontWeight: 600, marginBottom: "0.5rem" }}>
                  {s.t}
                </h3>
                <p
                  style={{
                    fontFamily: "var(--font-sans)",
                    fontSize: "0.9rem",
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

function EnquiryForm() {
  const [sent, setSent] = React.useState(false);
  return (
    <section className="section" style={{ background: "var(--surface-raised)" }}>
      <div
        className="container container--wide enq-grid"
        style={{
          display: "grid",
          gridTemplateColumns: "1fr 1.1fr",
          gap: "var(--space-16)",
          alignItems: "start",
        }}
      >
        <Reveal>
          <Kicker>Admission enquiry</Kicker>
          <h2
            style={{
              fontSize: "var(--text-section)",
              fontWeight: 500,
              margin: "0.8rem 0 1.2rem",
              maxWidth: "16ch",
            }}
          >
            Let&apos;s start the conversation
          </h2>
          <p
            style={{
              fontFamily: "var(--font-sans)",
              fontSize: "1.02rem",
              lineHeight: 1.7,
              color: "var(--text-secondary)",
              marginBottom: "1.8rem",
            }}
          >
            Share a few details and our admissions team will reach out within one working day with
            next steps and a prospectus.
          </p>
          <div style={{ display: "flex", flexDirection: "column", gap: "1rem" }}>
            {[
              { i: "phone", t: "Call us", d: "0495 236 5215" },
              { i: "envelope-simple", t: "Email", d: "admissions@srigujaratividyalaya.com" },
              { i: "map-pin", t: "Visit", d: "Beach Rd, Mananchira, Kozhikode" },
            ].map((c) => (
              <div key={c.t} style={{ display: "flex", gap: "0.9rem", alignItems: "center" }}>
                <span
                  style={{
                    width: 44,
                    height: 44,
                    borderRadius: "var(--radius-md)",
                    background: "var(--maroon-50)",
                    color: "var(--maroon-700)",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    flex: "none",
                  }}
                >
                  <Icon name={c.i} size={22} />
                </span>
                <div>
                  <div
                    style={{
                      fontFamily: "var(--font-sans)",
                      fontSize: "0.78rem",
                      letterSpacing: "0.08em",
                      textTransform: "uppercase",
                      color: "var(--text-muted)",
                    }}
                  >
                    {c.t}
                  </div>
                  <div
                    style={{
                      fontFamily: "var(--font-sans)",
                      fontWeight: 600,
                      color: "var(--text-primary)",
                    }}
                  >
                    {c.d}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </Reveal>
        <Reveal delay={120}>
          <div
            style={{
              background: "var(--surface-card)",
              borderRadius: "var(--radius-xl)",
              padding: "clamp(1.5rem, 3vw, 2.4rem)",
              boxShadow: "var(--shadow-lg)",
              border: "1px solid var(--border-subtle)",
            }}
          >
            {sent ? (
              <div style={{ textAlign: "center", padding: "2rem 0" }}>
                <span
                  style={{
                    width: 64,
                    height: 64,
                    borderRadius: "50%",
                    background: "var(--green-100)",
                    color: "var(--green-600)",
                    display: "inline-flex",
                    alignItems: "center",
                    justifyContent: "center",
                    marginBottom: "1.2rem",
                  }}
                >
                  <Icon name="check-circle" weight="fill" size={40} />
                </span>
                <h3 style={{ fontSize: "1.5rem", fontWeight: 600, marginBottom: "0.5rem" }}>
                  Thank you!
                </h3>
                <p style={{ fontFamily: "var(--font-sans)", color: "var(--text-secondary)" }}>
                  Your enquiry is in. We&apos;ll be in touch within one working day.
                </p>
                <Button
                  variant="secondary"
                  style={{ marginTop: "1.4rem" }}
                  onClick={() => setSent(false)}
                >
                  Submit another
                </Button>
              </div>
            ) : (
              <form
                onSubmit={(e) => {
                  e.preventDefault();
                  setSent(true);
                }}
                style={{ display: "flex", flexDirection: "column", gap: "1.1rem" }}
              >
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "1.1rem" }}>
                  <Input label="Parent / Guardian name" required placeholder="Full name" />
                  <Input label="Student name" required placeholder="Child's name" />
                </div>
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "1.1rem" }}>
                  <Input
                    label="Mobile"
                    required
                    placeholder="10-digit number"
                    icon={<Icon name="phone" size={16} />}
                  />
                  <Input
                    label="Email"
                    type="email"
                    placeholder="you@email.com"
                    icon={<Icon name="envelope-simple" size={16} />}
                  />
                </div>
                <Select
                  label="Applying for"
                  required
                  placeholder="Select a grade"
                  options={[
                    "Pre-KG",
                    "LKG",
                    "UKG",
                    "Class I",
                    "Class V",
                    "Class IX",
                    "Class XI — Science",
                    "Class XI — Commerce",
                  ]}
                />
                <Checkbox
                  label="I agree to be contacted about admissions"
                  description="We'll only use your details to respond to this enquiry."
                  defaultChecked
                />
                <Button
                  type="submit"
                  size="lg"
                  fullWidth
                  iconRight={<Icon name="arrow-right" size={18} />}
                >
                  Submit Enquiry
                </Button>
              </form>
            )}
          </div>
        </Reveal>
      </div>
    </section>
  );
}

function Fees() {
  return (
    <section className="section">
      <div className="container container--narrow">
        <Reveal style={{ textAlign: "center", marginBottom: "var(--space-10)" }}>
          <Kicker>
            <span style={{ display: "inline-flex", margin: "0 auto" }}>Good to know</span>
          </Kicker>
          <h2 style={{ fontSize: "var(--text-section)", fontWeight: 500, marginTop: "0.8rem" }}>
            Fees &amp; frequently asked
          </h2>
        </Reveal>
        <Reveal>
          <Accordion
            defaultOpen={0}
            items={[
              {
                q: "What is the fee structure?",
                a: "Fees vary by grade and are kept deliberately accessible as a community institution. Download the brochure or speak to our office for the current year's structure and payment schedule.",
              },
              {
                q: "Are there sibling or community concessions?",
                a: "Yes. As a charitable society managed by the linguistic minority, the school offers considerations for siblings and community members. Please enquire with the admissions office.",
              },
              {
                q: "What documents are required for admission?",
                a: "Birth certificate, transfer certificate (for transfers), recent photographs, and previous report cards where applicable.",
              },
              {
                q: "Is transport included?",
                a: "Transport is optional and charged separately, with routes covering Kozhikode and nearby areas.",
              },
            ]}
          />
        </Reveal>
      </div>
    </section>
  );
}

export function AdmissionsContent() {
  return (
    <div>
      <PageHero
        crumb="Admissions"
        eyebrow="Admissions 2026-27"
        title="A warm welcome begins here"
        lead="A guided, parent-friendly admissions experience — from first enquiry to your child's first day."
        image={IMG.a2}
      />
      <Journey />
      <EnquiryForm />
      <Fees />
    </div>
  );
}
