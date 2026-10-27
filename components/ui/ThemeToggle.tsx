"use client";

import { Moon, Sun } from "lucide-react";
import { useSyncExternalStore } from "react";

const THEME_EVENT = "scanteca-theme-change";

function subscribeTheme(callback: () => void) {
  const preference = window.matchMedia("(prefers-color-scheme: dark)");
  const sync = () => {
    let saved: string | null = null;
    try { saved = localStorage.getItem("theme"); } catch {}
    document.documentElement.classList.toggle("dark", saved === "dark" || (!saved && preference.matches));
    callback();
  };
  const storage = (event: StorageEvent) => {
    if (event.key === "theme" || event.key === null) sync();
  };
  window.addEventListener(THEME_EVENT, callback);
  window.addEventListener("storage", storage);
  preference.addEventListener("change", sync);
  return () => {
    window.removeEventListener(THEME_EVENT, callback);
    window.removeEventListener("storage", storage);
    preference.removeEventListener("change", sync);
  };
}

export default function ThemeToggle() {
  const dark = useSyncExternalStore(
    subscribeTheme,
    () => document.documentElement.classList.contains("dark"),
    () => false
  );
  const toggle = () => {
    const next = !document.documentElement.classList.contains("dark");
    document.documentElement.classList.toggle("dark", next);
    try {
      localStorage.setItem("theme", next ? "dark" : "light");
    } catch {
    }
    window.dispatchEvent(new Event(THEME_EVENT));
  };

  return (
    <button
      type="button"
      onClick={toggle}
      title="Alternar entre modo claro e escuro"
      aria-label="Modo escuro"
      aria-pressed={dark}
      className="flex h-11 w-11 items-center justify-center rounded-full text-zinc-500 transition-colors hover:bg-zinc-100 hover:text-foreground dark:text-zinc-400 dark:hover:bg-zinc-800 dark:hover:text-zinc-200"
    >
      <Moon aria-hidden="true" className="h-4 w-4 dark:hidden" />
      <Sun aria-hidden="true" className="hidden h-4 w-4 dark:block" />
    </button>
  );
}
