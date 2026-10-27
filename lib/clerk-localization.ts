import type { ComponentProps } from "react";
import type { ClerkProvider } from "@clerk/nextjs";
import { ptBR } from "@clerk/localizations";

export const clerkLocalization = {
  ...ptBR,
  // A tradução instalada deixa o placeholder de criação de senha sem definição.
  formFieldInputPlaceholder__signUpPassword: "Crie uma senha",
} satisfies NonNullable<ComponentProps<typeof ClerkProvider>["localization"]>;
