import type { ComponentProps } from "react";
import type { ClerkProvider } from "@clerk/nextjs";

// Variáveis CSS sincronizam modais e menus abertos com o tema e a cor de destaque.
export const clerkAppearance = {
  variables: {
    colorPrimary: "var(--color-indigo-600)",
    colorPrimaryForeground: "#ffffff",
    colorBackground: "var(--auth-surface)",
    colorForeground: "var(--foreground)",
    colorInput: "var(--auth-surface)",
    colorInputForeground: "var(--foreground)",
    colorMuted: "var(--auth-muted)",
    colorMutedForeground: "var(--auth-muted-foreground)",
    colorBorder: "var(--auth-border)",
    colorNeutral: "var(--foreground)",
    colorRing: "var(--color-indigo-400)",
    colorModalBackdrop: "rgba(0, 0, 0, 0.55)",
    fontFamily: "var(--font-geist-sans), Arial, Helvetica, sans-serif",
    fontFamilyButtons: "var(--font-geist-sans), Arial, Helvetica, sans-serif",
    fontFamilyMono: "var(--font-geist-mono), monospace",
    borderRadius: "0.75rem",
  },
  elements: {
    card: {
      border: "1px solid var(--auth-border)",
      boxShadow: "0 16px 48px rgba(0, 0, 0, 0.12)",
    },
    headerTitle: {
      fontFamily: 'var(--font-garamond), Georgia, "Times New Roman", serif',
      fontSize: "1.75rem",
    },
    formButtonPrimary: { borderRadius: "9999px" },
    userButtonPopoverCard: { border: "1px solid var(--auth-border)" },
    userButtonTrigger: { borderRadius: "9999px" },
  },
} satisfies NonNullable<ComponentProps<typeof ClerkProvider>["appearance"]>;
