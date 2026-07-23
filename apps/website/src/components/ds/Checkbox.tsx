"use client";

import React from "react";

interface CheckboxProps extends Omit<
  React.InputHTMLAttributes<HTMLInputElement>,
  "style" | "children" | "type"
> {
  label?: React.ReactNode;
  description?: React.ReactNode;
  style?: React.CSSProperties;
}

/**
 * Checkbox — consent and multi-select option (e.g. "I agree to be contacted").
 */
export function Checkbox({
  label,
  description,
  checked,
  defaultChecked,
  onChange,
  id,
  style,
  ...rest
}: CheckboxProps) {
  const autoId = React.useId();
  const fieldId = id ?? autoId;
  const [internal, setInternal] = React.useState(defaultChecked ?? false);
  const isControlled = checked !== undefined;
  const on = isControlled ? checked : internal;

  return (
    <label
      htmlFor={fieldId}
      style={{
        display: "flex",
        gap: "0.7rem",
        alignItems: "flex-start",
        cursor: "pointer",
        fontFamily: "var(--font-sans)",
        ...style,
      }}
    >
      <input
        id={fieldId}
        type="checkbox"
        checked={on}
        onChange={(e) => {
          if (!isControlled) setInternal(e.target.checked);
          onChange?.(e);
        }}
        style={{ position: "absolute", opacity: 0, width: 1, height: 1 }}
        {...rest}
      />
      <span
        aria-hidden
        style={{
          flex: "none",
          width: 22,
          height: 22,
          borderRadius: "var(--radius-xs)",
          border: `1.5px solid ${on ? "var(--brand)" : "var(--border-strong)"}`,
          background: on ? "var(--brand)" : "var(--surface-card)",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          transition: "all var(--dur-fast) var(--ease-out)",
          marginTop: 1,
        }}
      >
        {on && (
          <svg
            width="13"
            height="13"
            viewBox="0 0 24 24"
            fill="none"
            stroke="var(--cream-50)"
            strokeWidth="3.5"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <polyline points="20 6 9 17 4 12" />
          </svg>
        )}
      </span>
      <span>
        <span style={{ fontSize: "0.9375rem", color: "var(--text-primary)", fontWeight: 500 }}>
          {label}
        </span>
        {description && (
          <span
            style={{
              display: "block",
              fontSize: "0.8125rem",
              color: "var(--text-muted)",
              marginTop: 2,
            }}
          >
            {description}
          </span>
        )}
      </span>
    </label>
  );
}
