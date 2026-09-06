"use client";

import { useState } from "react";
import { Target, Pencil, Check, X } from "lucide-react";

export default function GoalCard({
  initialGoal,
  readCount,
  year,
}: {
  initialGoal: number | null;
  readCount: number;
  year: number;
}) {
  const [goal, setGoal] = useState(initialGoal);
  const [editing, setEditing] = useState(false);
  const [input, setInput] = useState(initialGoal?.toString() ?? "");
  const [saving, setSaving] = useState(false);

  const save = async () => {
    const value = input.trim() ? Number(input) : null;
    if (value !== null && (!Number.isInteger(value) || value < 1)) return;
    setSaving(true);
    try {
      const res = await fetch("/api/library-settings", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ yearlyGoal: value }),
      });
      if (res.ok) {
        setGoal(value);
        setEditing(false);
      }
    } finally {
      setSaving(false);
    }
  };

  const pct =
    goal && goal > 0 ? Math.min(100, Math.round((readCount / goal) * 100)) : 0;

  return (
    <div className="rounded-xl border border-zinc-200 bg-white p-5 dark:border-zinc-700 dark:bg-zinc-900">
      <div className="flex items-center justify-between">
        <h2 className="flex items-center gap-2 font-serif text-lg font-semibold text-foreground">
          <Target className="h-5 w-5 text-indigo-600 dark:text-indigo-400" />
          Meta de {year}
        </h2>
        {!editing && (
          <button
            onClick={() => {
              setInput(goal?.toString() ?? "");
              setEditing(true);
            }}
            className="inline-flex items-center gap-1 text-xs font-medium text-zinc-500 transition-colors hover:text-indigo-600 dark:text-zinc-400 dark:hover:text-indigo-400"
          >
            <Pencil className="h-3 w-3" />
            {goal ? "Editar" : "Definir meta"}
          </button>
        )}
      </div>

      {editing ? (
        <div className="mt-3 flex items-center gap-2">
          <input
            type="number"
            min={1}
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") save();
              if (e.key === "Escape") setEditing(false);
            }}
            placeholder="Ex: 24"
            autoFocus
            className="w-24 rounded-lg border border-zinc-300 bg-white px-3 py-1.5 text-sm text-foreground focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500 dark:border-zinc-600 dark:bg-zinc-800"
          />
          <span className="text-sm text-zinc-500 dark:text-zinc-400">
            livros no ano
          </span>
          <button
            onClick={save}
            disabled={saving}
            className="rounded-lg bg-indigo-600 p-1.5 text-white hover:bg-indigo-700 disabled:opacity-70"
            title="Salvar"
          >
            <Check className="h-4 w-4" />
          </button>
          <button
            onClick={() => setEditing(false)}
            className="rounded-lg p-1.5 text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-300"
            title="Cancelar"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
      ) : goal ? (
        <>
          <div className="mt-3 h-2.5 w-full overflow-hidden rounded-full bg-zinc-200 dark:bg-zinc-700">
            <div
              className="h-full rounded-full bg-indigo-500 transition-all"
              style={{ width: `${pct}%` }}
            />
          </div>
          <p className="mt-2 text-sm text-zinc-600 dark:text-zinc-400">
            <strong className="text-foreground">{readCount}</strong> de{" "}
            <strong className="text-foreground">{goal}</strong> livros · {pct}%
            {readCount >= goal && " — meta batida! 🎉"}
          </p>
        </>
      ) : (
        <p className="mt-2 text-sm text-zinc-500 dark:text-zinc-400">
          Defina quantos livros quer ler em {year} e acompanhe aqui.
        </p>
      )}
    </div>
  );
}
