"use client";

import { useState, useRef } from "react";
import { useRouter } from "next/navigation";

export default function ManualAddPage() {
  const router = useRouter();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const [form, setForm] = useState({
    isbn: "",
    title: "",
    author: "",
    publishedDate: "",
    synopsis: "",
    coverUrl: "",
  });

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (file.size > 2 * 1024 * 1024) {
      setMessage("A imagem deve ter no máximo 2MB");
      return;
    }

    const reader = new FileReader();
    reader.onload = (event) => {
      const base64 = event.target?.result as string;
      setPreview(base64);
      setForm((f) => ({ ...f, coverUrl: base64 }));
    };
    reader.readAsDataURL(file);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.title.trim()) {
      setMessage("Título é obrigatório");
      return;
    }

    setLoading(true);
    setMessage(null);

    try {
      const res = await fetch("/api/books", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      });

      const data = await res.json();

      if (res.ok) {
        setMessage(`✓ ${data.book.title} adicionado! Redirecionando...`);
        setTimeout(() => {
          router.push("/");
        }, 1200);
      } else {
        setMessage(data.error || "Erro ao adicionar livro");
      }
    } catch {
      setMessage("Erro de rede ao enviar livro");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex flex-1 flex-col items-center px-4 py-8">
      <h1 className="mb-2 text-2xl font-bold text-foreground">
        ➕ Adicionar Livro Manualmente
      </h1>
      <p className="mb-6 max-w-md text-center text-sm text-zinc-500 dark:text-zinc-400">
        Preencha os dados do livro. Útil para livros sem ISBN ou sem capa na base.
      </p>

      <form
        onSubmit={handleSubmit}
        className="w-full max-w-md rounded-xl border border-zinc-200 bg-white p-6 shadow-sm dark:border-zinc-800 dark:bg-zinc-900"
      >
        <div className="mb-4">
          <label className="mb-1 block text-sm font-medium text-zinc-700 dark:text-zinc-300">
            ISBN (opcional)
          </label>
          <input
            type="text"
            value={form.isbn}
            onChange={(e) => setForm({ ...form, isbn: e.target.value })}
            placeholder="Ex: 9788535902778"
            className="w-full rounded-lg border border-zinc-300 bg-white px-4 py-2.5 text-sm text-foreground placeholder-zinc-400 focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500 dark:border-zinc-600 dark:bg-zinc-800 dark:placeholder-zinc-500"
          />
        </div>

        <div className="mb-4">
          <label className="mb-1 block text-sm font-medium text-zinc-700 dark:text-zinc-300">
            Título *
          </label>
          <input
            type="text"
            value={form.title}
            onChange={(e) => setForm({ ...form, title: e.target.value })}
            placeholder="Título do livro"
            className="w-full rounded-lg border border-zinc-300 bg-white px-4 py-2.5 text-sm text-foreground placeholder-zinc-400 focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500 dark:border-zinc-600 dark:bg-zinc-800 dark:placeholder-zinc-500"
            required
          />
        </div>

        <div className="mb-4">
          <label className="mb-1 block text-sm font-medium text-zinc-700 dark:text-zinc-300">
            Autor
          </label>
          <input
            type="text"
            value={form.author}
            onChange={(e) => setForm({ ...form, author: e.target.value })}
            placeholder="Nome do autor"
            className="w-full rounded-lg border border-zinc-300 bg-white px-4 py-2.5 text-sm text-foreground placeholder-zinc-400 focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500 dark:border-zinc-600 dark:bg-zinc-800 dark:placeholder-zinc-500"
          />
        </div>

        <div className="mb-4">
          <label className="mb-1 block text-sm font-medium text-zinc-700 dark:text-zinc-300">
            Data de publicação
          </label>
          <input
            type="text"
            value={form.publishedDate}
            onChange={(e) => setForm({ ...form, publishedDate: e.target.value })}
            placeholder="Ex: 2019"
            className="w-full rounded-lg border border-zinc-300 bg-white px-4 py-2.5 text-sm text-foreground placeholder-zinc-400 focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500 dark:border-zinc-600 dark:bg-zinc-800 dark:placeholder-zinc-500"
          />
        </div>

        <div className="mb-4">
          <label className="mb-1 block text-sm font-medium text-zinc-700 dark:text-zinc-300">
            Sinopse
          </label>
          <textarea
            value={form.synopsis}
            onChange={(e) => setForm({ ...form, synopsis: e.target.value })}
            placeholder="Resumo do livro..."
            rows={3}
            className="w-full rounded-lg border border-zinc-300 bg-white px-4 py-2.5 text-sm text-foreground placeholder-zinc-400 focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500 dark:border-zinc-600 dark:bg-zinc-800 dark:placeholder-zinc-500"
          />
        </div>

        <div className="mb-6">
          <label className="mb-1 block text-sm font-medium text-zinc-700 dark:text-zinc-300">
            Foto da capa
          </label>
          <input
            ref={fileInputRef}
            type="file"
            accept="image/*"
            onChange={handleFileChange}
            className="mb-2 w-full text-sm text-zinc-600 file:mr-4 file:rounded-full file:border-0 file:bg-indigo-50 file:px-4 file:py-2 file:text-sm file:font-semibold file:text-indigo-700 hover:file:bg-indigo-100 dark:text-zinc-400 dark:file:bg-zinc-800 dark:file:text-zinc-300"
          />
          {preview && (
            <div className="mt-3 flex justify-center">
              <img
                src={preview}
                alt="Pré-visualização da capa"
                className="h-48 rounded-lg object-contain shadow-sm"
              />
            </div>
          )}
        </div>

        <div className="flex gap-3">
          <button
            type="button"
            onClick={() => router.push("/")}
            className="flex-1 rounded-lg border border-zinc-300 bg-white px-4 py-2.5 text-sm font-medium text-zinc-700 transition-colors hover:bg-zinc-50 dark:border-zinc-600 dark:bg-zinc-800 dark:text-zinc-300 dark:hover:bg-zinc-700"
          >
            Cancelar
          </button>
          <button
            type="submit"
            disabled={loading}
            className="flex-1 rounded-lg bg-indigo-600 px-4 py-2.5 text-sm font-medium text-white transition-colors hover:bg-indigo-700 disabled:cursor-not-allowed disabled:opacity-70"
          >
            {loading ? "Salvando..." : "Salvar Livro"}
          </button>
        </div>
      </form>

      {message && (
        <div
          className={`mt-6 w-full max-w-md rounded-lg p-4 text-sm font-medium ${
            message.startsWith("✓")
              ? "bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400"
              : "bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400"
          }`}
        >
          {message}
        </div>
      )}
    </div>
  );
}
