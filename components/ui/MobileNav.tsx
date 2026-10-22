"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { Menu, X } from "lucide-react";

const LINKS = [
  { href: "/", label: "Catálogo" },
  { href: "/feed", label: "Feed social" },
  { href: "/perfil", label: "Meu perfil" },
  { href: "/descobrir/leitores", label: "Descobrir leitores" },
  { href: "/descobrir", label: "Descobrir" },
  { href: "/jornada", label: "Jornada" },
  { href: "/diario", label: "Diário" },
  { href: "/rota", label: "Rota" },
  { href: "/manifesto", label: "Manifesto" },
  { href: "/oracle", label: "Oráculo" },
];

export default function MobileNav() {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const onClick = (e: MouseEvent) => {
      if (!ref.current?.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", onClick);
    return () => document.removeEventListener("mousedown", onClick);
  }, [open]);

  return (
    <div ref={ref} className="relative xl:hidden">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        aria-controls="mobile-navigation"
        aria-label="Menu de navegação"
        className="flex h-11 w-11 items-center justify-center rounded-full text-zinc-500 transition-colors hover:bg-zinc-100 hover:text-foreground dark:text-zinc-400 dark:hover:bg-zinc-800 dark:hover:text-zinc-200"
      >
        {open ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
      </button>
      {open && (
        <div id="mobile-navigation" className="absolute right-0 top-full mt-2 max-h-[60dvh] w-52 max-w-[calc(100vw-1.5rem)] overflow-y-auto rounded-xl border border-zinc-200 bg-white py-1 shadow-lg dark:border-zinc-800 dark:bg-zinc-900">
          {LINKS.map((l) => (
            <Link
              key={l.href}
              href={l.href}
              onClick={() => setOpen(false)}
              className="flex min-h-11 items-center px-4 py-2.5 text-sm font-medium text-zinc-700 transition-colors hover:bg-zinc-50 hover:text-foreground dark:text-zinc-300 dark:hover:bg-zinc-800"
            >
              {l.label}
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
