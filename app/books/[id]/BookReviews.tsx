"use client";

import { useState } from "react";

interface Review {
  id: string;
  content: string;
  rating: number | null;
  userId: string;
  userName: string | null;
  createdAt: Date;
}

export function BookReviews({
  bookId,
  initialReviews,
}: {
  bookId: string;
  initialReviews: Review[];
}) {
  const [reviews, setReviews] = useState<Review[]>(initialReviews);
  const [content, setContent] = useState("");
  const [rating, setRating] = useState<string>("");
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!content.trim()) return;

    setLoading(true);
    try {
      const res = await fetch(`/api/books/${bookId}/reviews`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          content: content.trim(),
          rating: rating ? Number(rating) : null,
        }),
      });

      const data = await res.json();

      if (res.ok) {
        setReviews((prev) => [data.review, ...prev]);
        setContent("");
        setRating("");
      } else {
        alert(data.error || "Erro ao salvar review");
      }
    } catch {
      alert("Erro de rede");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="rounded-xl border border-zinc-200 bg-white p-6 shadow-sm dark:border-zinc-800 dark:bg-zinc-900">
      <h2 className="mb-4 text-lg font-semibold text-foreground">
        Reviews públicas
      </h2>

      <form onSubmit={handleSubmit} className="mb-6 space-y-3">
        <textarea
          value={content}
          onChange={(e) => setContent(e.target.value)}
          placeholder="Escreva sua review..."
          rows={3}
          className="w-full rounded-lg border border-zinc-300 bg-white px-4 py-2.5 text-sm text-foreground placeholder-zinc-400 focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500 dark:border-zinc-600 dark:bg-zinc-800 dark:placeholder-zinc-500"
        />
        <div className="flex items-center gap-3">
          <select
            value={rating}
            onChange={(e) => setRating(e.target.value)}
            className="rounded-lg border border-zinc-300 bg-white px-3 py-2 text-sm text-foreground focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500 dark:border-zinc-600 dark:bg-zinc-800"
          >
            <option value="">Avaliação (opcional)</option>
            <option value="5">5 estrelas</option>
            <option value="4">4 estrelas</option>
            <option value="3">3 estrelas</option>
            <option value="2">2 estrelas</option>
            <option value="1">1 estrela</option>
          </select>
          <button
            type="submit"
            disabled={loading}
            className="rounded-lg bg-indigo-600 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-indigo-700 disabled:cursor-not-allowed disabled:opacity-70"
          >
            {loading ? "Salvando..." : "Publicar review"}
          </button>
        </div>
      </form>

      {reviews.length === 0 ? (
        <p className="text-sm text-zinc-500 dark:text-zinc-400">
          Nenhuma review ainda. Seja o primeiro a comentar.
        </p>
      ) : (
        <ul className="space-y-4">
          {reviews.map((review) => (
            <li
              key={review.id}
              className="border-b border-zinc-100 pb-4 last:border-0 dark:border-zinc-800"
            >
              <div className="mb-1 flex items-center gap-2">
                <span className="text-sm font-medium text-foreground">
                  {review.userName || "Leitor anônimo"}
                </span>
                {review.rating ? (
                  <span className="text-xs text-yellow-500">
                    {"★".repeat(review.rating)}
                  </span>
                ) : null}
                <span className="text-xs text-zinc-400">
                  {new Date(review.createdAt).toLocaleDateString("pt-BR")}
                </span>
              </div>
              <p className="text-sm leading-relaxed text-zinc-700 dark:text-zinc-300">
                {review.content}
              </p>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
