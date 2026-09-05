"use client";

import { useState, useRef } from "react";
import { useRouter } from "next/navigation";
import { BookOpen, Check, PlusCircle, Search } from "lucide-react";

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
    status: "TO_READ" as "READ" | "TO_READ" | "WISHLIST",
    collection: "Minha Biblioteca",
    notes: "",
    rating: "" as string,
  });

  const handleSearchCoverByTitle = async () => {
    if (!form.title.trim()) {
      setMessage("Preencha o título para buscar a capa");
      return;
    }

    setLoading(true);
    setMessage(null);

    try {
      const res = await fetch("/api/search-cover", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: form.title,
          author: form.author,
          isbn: form.isbn,
        }),
      });

      const data = await res.json();

      if (res.ok && data.coverUrl) {
        setForm((f) => ({ ...f, coverUrl: data.coverUrl }));
        setPreview(data.coverUrl);
        setMessage(`Capa encontrada para "${form.title}"`);
      } else {
        setMessage(
          data.error ||
            "Nenhuma capa encontrada. Você pode adicionar uma URL manualmente ou tirar uma foto."
        );
      }
    } catch {
      setMessage("Erro ao buscar capa. Tente usar uma URL ou foto.");
    } finally {
      setLoading(false);
    }
  };

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
        setMessage(`${data.book.title} adicionado! Redirecionando...`);
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
      <h1 className="mb-2 flex items-center justify-center gap-2 text-2xl font-bold text-foreground">
        <PlusCircle className="h-6 w-6 text-indigo-600 dark:text-indigo-400" />
        Adicionar Livro Manualmente
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

        <div className="mb-4">
          <label className="mb-1 block text-sm font-medium text-zinc-700 dark:text-zinc-300">
            Coleção / Estante
          </label>
          <input
            type="text"
            value={form.collection}
            onChange={(e) => setForm({ ...form, collection: e.target.value })}
            placeholder="Ex: Estante da Sala"
            className="w-full rounded-lg border border-zinc-300 bg-white px-4 py-2.5 text-sm text-foreground placeholder-zinc-400 focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500 dark:border-zinc-600 dark:bg-zinc-800 dark:placeholder-zinc-500"
          />
        </div>

        <div className="mb-4">
          <label className="mb-1 block text-sm font-medium text-zinc-700 dark:text-zinc-300">
            Status
          </label>
          <select
            value={form.status}
            onChange={(e) =>
              setForm({
                ...form,
                status: e.target.value as "READ" | "TO_READ" | "WISHLIST",
              })
            }
            className="w-full rounded-lg border border-zinc-300 bg-white px-4 py-2.5 text-sm text-foreground focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500 dark:border-zinc-600 dark:bg-zinc-800"
          >
            <option value="TO_READ">A ler</option>
            <option value="READ">Lido</option>
            <option value="WISHLIST">Desejo</option>
          </select>
        </div>

        <div className="mb-4">
          <label className="mb-1 block text-sm font-medium text-zinc-700 dark:text-zinc-300">
            Avaliação
          </label>
          <select
            value={form.rating}
            onChange={(e) => setForm({ ...form, rating: e.target.value })}
            className="w-full rounded-lg border border-zinc-300 bg-white px-4 py-2.5 text-sm text-foreground focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500 dark:border-zinc-600 dark:bg-zinc-800"
          >
            <option value="">Sem avaliação</option>
            <option value="1">1 estrela</option>
            <option value="2">2 estrelas</option>
            <option value="3">3 estrelas</option>
            <option value="4">4 estrelas</option>
            <option value="5">5 estrelas</option>
          </select>
        </div>

        <div className="mb-4">
          <label className="mb-1 block text-sm font-medium text-zinc-700 dark:text-zinc-300">
            Notas pessoais
          </label>
          <textarea
            value={form.notes}
            onChange={(e) => setForm({ ...form, notes: e.target.value })}
            placeholder="Minhas anotações..."
            rows={2}
            className="w-full rounded-lg border border-zinc-300 bg-white px-4 py-2.5 text-sm text-foreground placeholder-zinc-400 focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500 dark:border-zinc-600 dark:bg-zinc-800 dark:placeholder-zinc-500"
          />
        </div>

        <div className="mb-6 rounded-lg border border-zinc-200 bg-zinc-50 p-4 dark:border-zinc-700 dark:bg-zinc-800/50">
          <label className="mb-1 block text-sm font-medium text-zinc-700 dark:text-zinc-300">
            Capa do livro
          </label>
          <p className="mb-3 text-xs text-zinc-500 dark:text-zinc-400">
            Você pode buscar automaticamente, colar uma URL, ou enviar uma foto.
          </p>

          <button
            type="button"
            onClick={handleSearchCoverByTitle}
            disabled={loading}
            className="mb-3 w-full rounded-lg border border-indigo-200 bg-indigo-50 px-4 py-2.5 text-sm font-medium text-indigo-700 transition-colors hover:bg-indigo-100 disabled:cursor-not-allowed disabled:opacity-70 dark:border-indigo-900 dark:bg-indigo-900/30 dark:text-indigo-300 dark:hover:bg-indigo-900/50"
          >
            {loading ? (
              "Buscando..."
            ) : (
              <span className="flex items-center justify-center gap-2">
                <Search className="h-4 w-4" />
                Buscar capa pelo título
              </span>
            )}
          </button>

          <div className="mb-3 flex items-center gap-2 text-xs text-zinc-400 dark:text-zinc-500">
            <span className="h-px flex-1 bg-zinc-300 dark:bg-zinc-600" />
            ou
            <span className="h-px flex-1 bg-zinc-300 dark:bg-zinc-600" />
          </div>

          <input
            type="text"
            value={form.coverUrl}
            onChange={(e) => {
              const url = e.target.value;
              setForm({ ...form, coverUrl: url });
              setPreview(url);
            }}
            placeholder="URL da imagem da capa"
            className="mb-3 w-full rounded-lg border border-zinc-300 bg-white px-4 py-2.5 text-sm text-foreground placeholder-zinc-400 focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500 dark:border-zinc-600 dark:bg-zinc-800 dark:placeholder-zinc-500"
          />

          <input
            ref={fileInputRef}
            type="file"
            accept="image/*"
            onChange={handleFileChange}
            className="w-full text-sm text-zinc-600 file:mr-4 file:rounded-full file:border-0 file:bg-indigo-50 file:px-4 file:py-2 file:text-sm file:font-semibold file:text-indigo-700 hover:file:bg-indigo-100 dark:text-zinc-400 dark:file:bg-zinc-800 dark:file:text-zinc-300"
          />

          {preview && (
            <div className="mt-3 flex flex-col items-center gap-2 rounded-lg border border-zinc-200 bg-white p-3 dark:border-zinc-700 dark:bg-zinc-900">
              <p className="text-xs font-medium text-zinc-600 dark:text-zinc-400">
                Pré-visualização
              </p>
              <img
                src={preview}
                alt="Pré-visualização da capa"
                className="h-48 rounded-lg object-contain shadow-sm"
                onError={(e) => {
                  e.currentTarget.style.display = "none";
                }}
              />
            </div>
          )}

          <p className="mt-3 text-xs text-amber-600 dark:text-amber-400">
            Não encontrou a capa? Você pode deixar em branco e adicionar depois,
            ou usar uma URL de outra fonte.
          </p>
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
            message.includes("adicionado")
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
