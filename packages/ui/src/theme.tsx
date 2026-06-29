"use client";

import { createContext, useContext, type ReactNode } from "react";

import { tokens, type Tokens } from "./tokens";

/**
 * Framework-neutral theme provider (works on web and React Native — no DOM).
 * Exposes the design tokens via context; the mount point for theme switching
 * (e.g. dark mode) in later milestones. Not a visual component.
 */
const ThemeContext = createContext<Tokens>(tokens);

export function ThemeProvider({ children }: { children: ReactNode }) {
  return <ThemeContext.Provider value={tokens}>{children}</ThemeContext.Provider>;
}

export function useTheme(): Tokens {
  return useContext(ThemeContext);
}
