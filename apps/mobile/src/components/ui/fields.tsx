import { useState, type ReactNode } from "react";
import { Text, TextInput, View, type TextInputProps } from "react-native";

/**
 * Form fields (design handoff, mobile). Label above, required asterisk, helper/
 * inline error, >=44pt height, 10px radius, sand hairline that turns gold on
 * focus. `Field` gives every control the same rhythm; FormRow/FormSection
 * standardize form spacing.
 */
export function Field({
  label,
  required,
  helper,
  error,
  children,
}: {
  label: string;
  required?: boolean;
  helper?: string;
  error?: string;
  children: ReactNode;
}) {
  return (
    <View className="gap-1.5">
      <Text className="font-sans text-sm font-semibold text-neutral-900">
        {label}
        {required ? <Text className="font-sans text-danger-600"> *</Text> : null}
      </Text>
      {children}
      {error ? (
        <Text className="font-sans text-caption text-danger-600">{error}</Text>
      ) : helper ? (
        <Text className="font-sans text-caption text-neutral-500">{helper}</Text>
      ) : null}
    </View>
  );
}

export interface TextFieldProps extends TextInputProps {
  label: string;
  required?: boolean;
  helper?: string;
  error?: string;
}

export function TextField({
  label,
  required,
  helper,
  error,
  onFocus,
  onBlur,
  ...props
}: TextFieldProps) {
  const [focused, setFocused] = useState(false);
  const border = error ? "border-danger-500" : focused ? "border-gold-500" : "border-subtle";
  return (
    <Field label={label} required={required} helper={helper} error={error}>
      <TextInput
        placeholderTextColor="#948676"
        onFocus={(e) => {
          setFocused(true);
          onFocus?.(e);
        }}
        onBlur={(e) => {
          setFocused(false);
          onBlur?.(e);
        }}
        className={`min-h-11 rounded-[10px] border bg-white px-3 font-sans text-body text-neutral-900 ${border}`}
        {...props}
      />
    </Field>
  );
}

export function FormRow({ children }: { children: ReactNode }) {
  return <View className="gap-4">{children}</View>;
}

export function FormSection({ title, children }: { title?: string; children: ReactNode }) {
  return (
    <View className="gap-4">
      {title ? <Text className="font-display text-title text-neutral-900">{title}</Text> : null}
      {children}
    </View>
  );
}
