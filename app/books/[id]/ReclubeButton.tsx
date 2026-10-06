"use client";

import { useState } from "react";
import { RotateCcw } from "lucide-react";

interface ReclubeButtonProps {
  bookId: string;
}

export default function ReclubeButton({ bookId }: ReclubeButtonProps) {
  const [isLoading, setIsLoading] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  const handleReclube = async () => {
    setIsLoading(true);
    setMessage(null);

    try {
      const response = await fetch("/api/books", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: bookId, startReclube: true }),
      });

      const data = await response.json();

      if (!response.ok) {
        setMessage(data.error || "Erro ao iniciar reclube");
        return;
      }

      setMessage("Reclube iniciado! O livro voltou para 'Lendo'.");
      setTimeout(() => {
        window.location.reload();
      }, 1500);
    } catch {
      setMessage("Erro ao iniciar reclube");
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="flex flex-col gap-1">
      <button
        onClick={handleReclube}
        disabled={isLoading}
        className="inline-flex items-center gap-2 rounded-full bg-indigo-600 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed"
      >
        <RotateCcw className="h-4 w-4" />
        {isLoading ? "Iniciando..." : "Reclube"}
      </button>
      {message && (
        <span className="text-xs text-zinc-600 dark:text-zinc-400">
          {message}
        </span>
      )}
    </div>
  );
}
