import type { ComponentProps } from "react";
import type { ClerkProvider } from "@clerk/nextjs";

const focusVisible = {
  outline: "2px solid var(--auth-focus)",
  outlineOffset: "2px",
};

// Variáveis CSS sincronizam modais e menus abertos com o tema e a cor de destaque.
export const clerkAppearance = {
  variables: {
    colorPrimary: "var(--color-indigo-600)",
    colorPrimaryForeground: "#ffffff",
    colorBackground: "var(--auth-surface)",
    colorForeground: "var(--foreground)",
    colorInput: "var(--auth-input-surface)",
    colorInputForeground: "var(--foreground)",
    colorMuted: "var(--auth-muted)",
    colorMutedForeground: "var(--auth-muted-foreground)",
    colorBorder: "var(--auth-border)",
    colorNeutral: "var(--foreground)",
    colorRing: "var(--auth-focus)",
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
    formFieldInput: {
      minHeight: "44px",
      fontSize: "1rem",
      backgroundColor: "var(--auth-input-surface)",
      "&:focus": focusVisible,
    },
    formFieldInputShowPasswordButton: {
      minHeight: "44px",
      minWidth: "44px",
      "&:focus-visible": focusVisible,
    },
    socialButtonsBlockButton: {
      minHeight: "44px",
      backgroundColor: "var(--auth-muted)",
      "&:focus-visible": focusVisible,
    },
    socialButtonsIconButton: {
      minHeight: "44px",
      minWidth: "44px",
      backgroundColor: "var(--auth-muted)",
      "&:focus-visible": focusVisible,
    },
    socialButtonsBlockButtonText: { color: "var(--foreground)", fontSize: "0.875rem" },
    formButtonPrimary: {
      minHeight: "44px",
      fontSize: "0.875rem",
      borderRadius: "9999px",
      "&:focus-visible": focusVisible,
    },
    footerActionLink: {
      display: "inline-flex",
      alignItems: "center",
      minHeight: "44px",
      color: "var(--auth-link)",
      "&:focus-visible": focusVisible,
    },
    modalCloseButton: {
      minHeight: "44px",
      minWidth: "44px",
      "&:focus-visible": focusVisible,
    },
    userButtonPopoverCard: { border: "1px solid var(--auth-border)" },
    userButtonTrigger: { borderRadius: "9999px" },
  },
} satisfies NonNullable<ComponentProps<typeof ClerkProvider>["appearance"]>;
