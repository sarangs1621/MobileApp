import type { ComponentType } from "react";

/**
 * Shape of a phosphor-react-native icon component (Plus, Bell, etc.). Screens and
 * primitives accept this as an `Icon` prop so the heritage look uses Phosphor,
 * matching the web app. The legacy Feather `icon` string props stay for
 * not-yet-migrated screens and are removed as they move over.
 */
export type IconWeight = "thin" | "light" | "regular" | "bold" | "fill" | "duotone";
export type PhosphorIcon = ComponentType<{
  size?: number;
  color?: string;
  weight?: IconWeight;
}>;
