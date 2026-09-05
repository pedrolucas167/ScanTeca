"use client";

import { useState } from "react";
import dynamic from "next/dynamic";
import Link from "next/link";
import { ArrowLeft, ScanLine, Search } from "lucide-react";
import BookSearch from "./BookSearch";

const Scanner = dynamic(() => import("./Scanner"), { ssr: false });

type Tab = "scan" | "search";

export default function AddBookClient({ initialTab }: { initialTab: Tab }) {
  const [tab, setTab] = useState<Tab>(initialTab);

  return (
    <div className="flex flex-1 flex-col items-center px-4 py-8">
      <div className={`w-full ${tab === "search" ? "max-w-3xl" : "max-w-2xl"}`}>
        <Link
          href="/"
          className="mb-6 inline-flex items-center gap-1 text-sm font-medium text-indigo-600 hover:text-indigo-700 dark:text-indigo-400"
        >
          <ArrowLeft className="h-4 w-4" />
          Voltar ao catálogo
        </Link>

        <h1 className="mb-6 text-center text-2xl font-bold text-foreground">
          Adicionar livro
        </h1>

        <div className="mb-8 flex justify-center">
          <div className="inline-flex rounded-full border border-zinc-300 bg-white p-1 dark:border-zinc-600 dark:bg-zinc-800">
            <button
              type="button"
              onClick={() => setTab("scan")}
              className={`inline-flex items-center gap-1.5 rounded-full px-5 py-2 text-sm font-medium transition-colors ${
                tab === "scan"
                  ? "bg-indigo-600 text-white shadow-sm"
                  : "text-zinc-600 hover:text-foreground dark:text-zinc-400"
              }`}
            >
              <ScanLine className="h-4 w-4" />
              Escanear ISBN
            </button>
            <button
              type="button"
              onClick={() => setTab("search")}
              className={`inline-flex items-center gap-1.5 rounded-full px-5 py-2 text-sm font-medium transition-colors ${
                tab === "search"
                  ? "bg-indigo-600 text-white shadow-sm"
                  : "text-zinc-600 hover:text-foreground dark:text-zinc-400"
              }`}
            >
              <Search className="h-4 w-4" />
              Buscar livro
            </button>
          </div>
        </div>

        {tab === "scan" ? <Scanner /> : <BookSearch />}
      </div>
    </div>
  );
}
