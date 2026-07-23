"use client";

import { MagnifyingGlass } from "@phosphor-icons/react";
import { cn } from "@repo/ui";
import {
  forwardRef,
  useId,
  type InputHTMLAttributes,
  type ReactNode,
  type SelectHTMLAttributes,
} from "react";

/**
 * Form fields (design handoff §inputs). 10px radius, sand hairline border, gold
 * focus ring. Label above the control, required asterisk, helper text, inline
 * error + danger border, disabled. One `Field` wrapper gives every input the
 * same rhythm; `FormRow`/`FormSection` standardize form spacing.
 */
const controlBase =
  "w-full rounded-[10px] border bg-white px-3 text-sm text-ink-900 placeholder:text-ink-400 " +
  "focus:outline-none focus:border-gold-500 focus:ring-[3px] focus:ring-gold-100 " +
  "disabled:cursor-not-allowed disabled:bg-cream-50 disabled:opacity-60";

function borderClass(error?: string) {
  return error ? "border-red-600" : "border-subtle";
}

export function Field({
  label,
  required,
  helper,
  error,
  htmlFor,
  children,
}: {
  label: string;
  required?: boolean | undefined;
  helper?: string | undefined;
  error?: string | undefined;
  htmlFor?: string | undefined;
  children: ReactNode;
}) {
  return (
    <div className="flex flex-col gap-1.5">
      <label htmlFor={htmlFor} className="text-[13px] font-semibold text-ink-900">
        {label}
        {required && <span className="ml-0.5 text-red-600">*</span>}
      </label>
      {children}
      {error ? (
        <p className="text-caption text-red-600" role="alert">
          {error}
        </p>
      ) : helper ? (
        <p className="text-caption text-ink-400">{helper}</p>
      ) : null}
    </div>
  );
}

export interface InputProps extends InputHTMLAttributes<HTMLInputElement> {
  label: string;
  helper?: string | undefined;
  error?: string | undefined;
}

export const Input = forwardRef<HTMLInputElement, InputProps>(function Input(
  { label, helper, error, required, id, className, ...props },
  ref,
) {
  const auto = useId();
  const fieldId = id ?? auto;
  return (
    <Field label={label} required={required} helper={helper} error={error} htmlFor={fieldId}>
      <input
        ref={ref}
        id={fieldId}
        required={required}
        aria-invalid={error ? true : undefined}
        className={cn(controlBase, borderClass(error), "h-11", className)}
        {...props}
      />
    </Field>
  );
});

/** Calendar-date input (IST dates are formatted by @repo/utils at render). */
export const DateField = forwardRef<HTMLInputElement, InputProps>(function DateField(props, ref) {
  return <Input ref={ref} type="date" {...props} />;
});

export interface SelectProps extends SelectHTMLAttributes<HTMLSelectElement> {
  label: string;
  helper?: string | undefined;
  error?: string | undefined;
  children: ReactNode;
}

export const Select = forwardRef<HTMLSelectElement, SelectProps>(function Select(
  { label, helper, error, required, id, className, children, ...props },
  ref,
) {
  const auto = useId();
  const fieldId = id ?? auto;
  return (
    <Field label={label} required={required} helper={helper} error={error} htmlFor={fieldId}>
      <select
        ref={ref}
        id={fieldId}
        required={required}
        aria-invalid={error ? true : undefined}
        className={cn(controlBase, borderClass(error), "h-11", className)}
        {...props}
      >
        {children}
      </select>
    </Field>
  );
});

/** Search box with a leading icon — the pill toolbar search (design handoff). */
export const SearchInput = forwardRef<HTMLInputElement, InputHTMLAttributes<HTMLInputElement>>(
  function SearchInput({ className, ...props }, ref) {
    return (
      <div
        className={cn(
          "flex w-full max-w-[320px] items-center gap-2 rounded-full border border-subtle bg-cream-50 px-3.5 py-2 transition-colors duration-fast focus-within:border-gold-500 focus-within:ring-[3px] focus-within:ring-gold-100",
          className,
        )}
      >
        <MagnifyingGlass aria-hidden size={15} className="shrink-0 text-ink-400" />
        <input
          ref={ref}
          type="search"
          className="w-full border-none bg-transparent text-[13px] text-ink-900 outline-none placeholder:text-ink-400"
          placeholder="Search…"
          {...props}
        />
      </div>
    );
  },
);

/** Consistent form rhythm: 16px between fields, 24px between sections. */
export function FormRow({ children, className }: { children: ReactNode; className?: string }) {
  return <div className={cn("flex flex-col gap-4", className)}>{children}</div>;
}

export function FormSection({ title, children }: { title?: string; children: ReactNode }) {
  return (
    <section className="flex flex-col gap-4 [&:not(:first-child)]:mt-6">
      {title && <h3 className="font-display text-title text-ink-800">{title}</h3>}
      {children}
    </section>
  );
}
