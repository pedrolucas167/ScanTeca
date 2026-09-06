"use client";

import { Moon, Sun } from "lucide-react";

/**
 * Alterna a classe .dark no <html>. Os dois ícones ficam no DOM e o CSS
 * decide qual exibir — sem estado, sem hydration mismatch.
 */
export default function ThemeToggle() {
  const toggle = () => {
    const next = !document.documentElement.classList.contains("dark");
    document.documentElement.classList.toggle("dark", next);
    try {
      localStorage.setItem("theme", next ? "dark" : "light");
    } catch {
      // storage indisponível (modo privado) — tema vale só nesta sessão
    }
  };

  return (
    <button
      type="button"
      onClick={toggle}
      title="Alternar entre modo claro e escuro"
      className="rounded-full p-2 text-zinc-500 transition-colors hover:bg-zinc-100 hover:text-foreground dark:text-zinc-400 dark:hover:bg-zinc-800 dark:hover:text-zinc-200"
    >
      <Moon className="h-4 w-4 dark:hidden" />
      <Sun className="hidden h-4 w-4 dark:block" />
    </button>
  );
}
