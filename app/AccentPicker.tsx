"use client";

import { useEffect, useRef, useState, useSyncExternalStore } from "react";
import { Check, Palette } from "lucide-react";

const ACCENTS = [
  { id: "indigo", label: "Índigo", color: "#6366f1" },
  { id: "vinho", label: "Vinho", color: "#e11d48" },
  { id: "floresta", label: "Floresta", color: "#059669" },
  { id: "terracota", label: "Terracota", color: "#ea580c" },
] as const;

const ACCENT_EVENT = "scanteca-accent-change";

function subscribeAccent(callback: () => void) {
  window.addEventListener(ACCENT_EVENT, callback);
  return () => window.removeEventListener(ACCENT_EVENT, callback);
}

export default function AccentPicker() {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const current = useSyncExternalStore(
    subscribeAccent,
    () => document.documentElement.dataset.accent || "indigo",
    () => "indigo"
  );

  useEffect(() => {
    if (!open) return;
    const onClick = (e: MouseEvent) => {
      if (!ref.current?.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", onClick);
    return () => document.removeEventListener("mousedown", onClick);
  }, [open]);

  const pick = (id: string) => {
    document.documentElement.setAttribute("data-accent", id);
    setOpen(false);
    try {
      localStorage.setItem("accent", id);
    } catch {
    }
    window.dispatchEvent(new Event(ACCENT_EVENT));
  };

  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        title="Cor de destaque da interface"
        aria-expanded={open}
        className="rounded-full p-2 text-zinc-500 transition-colors hover:bg-zinc-100 hover:text-foreground dark:text-zinc-400 dark:hover:bg-zinc-800 dark:hover:text-zinc-200"
      >
        <Palette className="h-4 w-4" />
      </button>
      {open && (
        <div className="absolute right-0 top-full z-50 mt-2 w-40 overflow-hidden rounded-xl border border-zinc-200 bg-white shadow-lg dark:border-zinc-700 dark:bg-zinc-900">
          {ACCENTS.map((a) => (
            <button
              key={a.id}
              type="button"
              onClick={() => pick(a.id)}
              className="flex w-full items-center gap-2.5 px-3 py-2 text-left text-sm text-zinc-600 transition-colors hover:bg-zinc-50 dark:text-zinc-300 dark:hover:bg-zinc-800"
            >
              <span
                className="h-3.5 w-3.5 rounded-full ring-1 ring-inset ring-black/10 dark:ring-white/20"
                style={{ backgroundColor: a.color }}
              />
              <span className="flex-1">{a.label}</span>
              {current === a.id && (
                <Check className="h-3.5 w-3.5 text-indigo-600 dark:text-indigo-400" />
              )}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
