"use client";

import { useState } from "react";
import dynamic from "next/dynamic";
import Link from "next/link";
import BookSearch from "./BookSearch";

const Scanner = dynamic(() => import("./Scanner"), { ssr: false });

type Tab = "scan" | "search";

function Icon({
  name,
  className = "",
  fill = false,
}: {
  name: string;
  className?: string;
  fill?: boolean;
}) {
  return (
    <span
      className={`material-symbols-outlined ${className}`}
      style={fill ? { fontVariationSettings: "'FILL' 1" } : undefined}
    >
      {name}
    </span>
  );
}

export default function AddBookClient({ initialTab }: { initialTab: Tab }) {
  const [tab, setTab] = useState<Tab>(initialTab);

  return (
    <div className="relative flex flex-1 flex-col bg-surface text-on-surface">
      <header className="sticky top-0 z-40 flex w-full items-center justify-between border-b border-outline-variant/20 bg-surface/80 px-4 py-3 shadow-sm backdrop-blur-md">
        <div className="flex items-center gap-2">
          <Link
            href="/"
            className="flex h-9 w-9 items-center justify-center rounded-full text-on-surface-variant transition-colors hover:bg-surface-container-high hover:text-on-surface active:scale-95"
          >
            <Icon name="close" className="text-[20px]" />
          </Link>
          <span className="font-headline-lg-mobile text-headline-lg-mobile tracking-tight text-on-surface">
            {tab === "scan" ? "Scanner ISBN" : "Buscar Livro"}
          </span>
        </div>
        <div className="flex items-center gap-2">
          <span className="rounded-full border border-primary-container/40 bg-primary-container/20 px-2 py-1 font-label-md text-label-md text-primary">
            {tab === "scan" ? "Scanner" : "Pesquisa"}
          </span>
        </div>
      </header>

      <div className="z-30 bg-gradient-to-b from-surface/90 via-surface/40 to-transparent px-4 pb-3 pt-4">
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center rounded-full border border-outline-variant/30 bg-surface-container-high/80 p-1 backdrop-blur-md">
            <button
              type="button"
              onClick={() => setTab("scan")}
              className={`flex items-center gap-1.5 rounded-full px-3 py-1.5 font-label-sm text-label-sm transition-all ${
                tab === "scan"
                  ? "bg-primary-container text-on-primary-container shadow-sm"
                  : "text-on-surface-variant hover:text-on-surface"
              }`}
            >
              <Icon name="qr_code_scanner" className="text-[14px]" fill={tab === "scan"} />
              <span>ISBN / EAN</span>
            </button>
            <button
              type="button"
              onClick={() => setTab("search")}
              className={`flex items-center gap-1 rounded-full px-3 py-1.5 font-label-sm text-label-sm transition-colors ${
                tab === "search"
                  ? "bg-primary-container text-on-primary-container shadow-sm"
                  : "text-on-surface-variant hover:text-on-surface"
              }`}
            >
              <Icon name="search" className="text-[14px]" />
              <span>Buscar livro</span>
            </button>
          </div>
        </div>
      </div>

      <div className="flex flex-1 flex-col">
        {tab === "scan" ? <Scanner /> : <BookSearch />}
      </div>
    </div>
  );
}
