"use client";

import React from "react";

interface InputProps extends Omit<
  React.InputHTMLAttributes<HTMLInputElement>,
  "style" | "children"
> {
  label?: string;
  hint?: string;
  error?: string;
  icon?: React.ReactNode;
  style?: React.CSSProperties;
  containerStyle?: React.CSSProperties;
}

/**
 * Input — labelled text field for admissions enquiry, contact and search forms.
 */
export function Input({
  label,
  hint,
  error,
  id,
  required = false,
  icon,
  type = "text",
  style,
  containerStyle,
  onFocus,
  onBlur,
  ...rest
}: InputProps) {
  const autoId = React.useId();
  const fieldId = id ?? autoId;
  const [focus, setFocus] = React.useState(false);
  const borderColor = error ? "var(--red-600)" : focus ? "var(--brand)" : "var(--border-strong)";

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "0.4rem", ...containerStyle }}>
      {label && (
        <label
          htmlFor={fieldId}
          style={{
            fontFamily: "var(--font-sans)",
            fontSize: "0.8125rem",
            fontWeight: 600,
            color: "var(--text-primary)",
            letterSpacing: "0.01em",
          }}
        >
          {label}
          {required && <span style={{ color: "var(--red-600)" }}> *</span>}
        </label>
      )}
      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: "0.6rem",
          background: "var(--surface-card)",
          border: `1px solid ${borderColor}`,
          borderRadius: "var(--radius-md)",
          padding: "0 0.9rem",
          boxShadow: focus ? "0 0 0 3px rgba(122,52,20,0.12)" : "none",
          transition: "border-color var(--dur-fast), box-shadow var(--dur-fast)",
        }}
      >
        {icon && <span style={{ color: "var(--text-muted)", display: "flex" }}>{icon}</span>}
        <input
          id={fieldId}
          type={type}
          required={required}
          onFocus={(e) => {
            setFocus(true);
            onFocus?.(e);
          }}
          onBlur={(e) => {
            setFocus(false);
            onBlur?.(e);
          }}
          style={{
            flex: 1,
            border: "none",
            outline: "none",
            background: "transparent",
            fontFamily: "var(--font-sans)",
            fontSize: "0.9375rem",
            color: "var(--text-primary)",
            padding: "0.75rem 0",
            minWidth: 0,
            ...style,
          }}
          {...rest}
        />
      </div>
      {(hint || error) && (
        <span
          style={{
            fontFamily: "var(--font-sans)",
            fontSize: "0.75rem",
            color: error ? "var(--red-600)" : "var(--text-muted)",
          }}
        >
          {error || hint}
        </span>
      )}
    </div>
  );
}
