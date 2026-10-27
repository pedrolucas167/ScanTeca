"use client";

import { useEffect, useId, useRef, useState } from "react";
import Link from "next/link";
import { ChevronDown, Menu, X } from "lucide-react";

interface Props {
  links: { href: string; label: string }[];
  mobile?: boolean;
}

// Disclosure de navegação: links normais, percorridos com Tab (não um menu ARIA).
export default function NavigationDropdown({ links, mobile = false }: Props) {
  const [open, setOpen] = useState(false);
  const id = useId();
  const root = useRef<HTMLDivElement>(null);
  const trigger = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (!open) return;
    const outside = (event: PointerEvent) => {
      if (!root.current?.contains(event.target as Node)) setOpen(false);
    };
    document.addEventListener("pointerdown", outside);
    return () => document.removeEventListener("pointerdown", outside);
  }, [open]);

  return (
    <div ref={root} className={`relative z-50 ${mobile ? "xl:hidden" : ""}`}
      onKeyDown={event => {
        if (event.key === "Escape" && open) {
          event.preventDefault();
          setOpen(false);
          trigger.current?.focus();
        }
      }}
      onBlur={event => {
        if (!event.currentTarget.contains(event.relatedTarget as Node | null)) setOpen(false);
      }}
    >
      <button ref={trigger} type="button" onClick={() => setOpen(value => !value)}
        aria-expanded={open} aria-controls={id} aria-label={mobile ? "Menu de navegação" : undefined}
        className={`flex min-h-11 items-center justify-center gap-1 rounded-md text-sm font-medium text-zinc-600 transition-colors hover:bg-zinc-100 hover:text-foreground focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-indigo-500 dark:text-zinc-400 dark:hover:bg-zinc-800 ${mobile ? "w-11 rounded-full" : "px-3 py-2"}`}
      >
        {mobile ? open ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" /> : <>Mais<ChevronDown className="h-4 w-4" aria-hidden="true" /></>}
      </button>
      {open && (
        <div id={id} className={`absolute top-full mt-1 max-h-[60dvh] w-52 max-w-[calc(100vw-1.5rem)] overflow-y-auto rounded-xl border border-zinc-200 bg-white py-1 shadow-lg dark:border-zinc-800 dark:bg-zinc-950 ${mobile ? "right-0" : "left-0"}`}>
          {links.map(link => (
            <Link key={link.href} href={link.href} onClick={() => setOpen(false)}
              className="flex min-h-11 items-center px-4 py-2.5 text-sm font-medium text-zinc-700 transition-colors hover:bg-zinc-100 focus-visible:bg-zinc-100 focus-visible:outline-2 focus-visible:outline-inset focus-visible:outline-indigo-500 dark:text-zinc-300 dark:hover:bg-zinc-800 dark:focus-visible:bg-zinc-800"
            >{link.label}</Link>
          ))}
        </div>
      )}
    </div>
  );
}
