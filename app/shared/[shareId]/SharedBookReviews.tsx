"use client";

import { useState } from "react";
import Link from "next/link";
import { useAuth } from "@clerk/nextjs";
import { MessageSquare, Star, ChevronDown, ChevronUp } from "lucide-react";

interface Review {
  id: string;
  content: string;
  rating: number | null;
  userName: string | null;
  createdAt: string | Date;
}

export function SharedBookReviews({
  bookId,
  initialReviews,
}: {
  bookId: string;
  initialReviews: Review[];
}) {
  const { isSignedIn } = useAuth();
  const [open, setOpen] = useState(false);
  const [reviews, setReviews] = useState<Review[]>(initialReviews);
  const [content, setContent] = useState("");
  const [rating, setRating] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!content.trim()) return;

    setLoading(true);
    setError(null);
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
        setError(data.error || "Erro ao publicar review");
      }
    } catch {
      setError("Erro de rede");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="mt-3 border-t border-zinc-100 pt-3 dark:border-zinc-800">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="flex w-full items-center justify-between text-xs font-medium text-zinc-500 transition-colors hover:text-indigo-600 dark:text-zinc-400 dark:hover:text-indigo-400"
      >
        <span className="flex items-center gap-1.5">
          <MessageSquare className="h-3.5 w-3.5" />
          {reviews.length === 0
            ? "Reviews"
            : `${reviews.length} ${reviews.length === 1 ? "review" : "reviews"}`}
        </span>
        {open ? (
          <ChevronUp className="h-3.5 w-3.5" />
        ) : (
          <ChevronDown className="h-3.5 w-3.5" />
        )}
      </button>

      {open && (
        <div className="mt-3 space-y-3">
          {reviews.length === 0 ? (
            <p className="text-xs text-zinc-400 dark:text-zinc-500">
              Nenhuma review ainda.
            </p>
          ) : (
            <ul className="space-y-3">
              {reviews.map((review) => (
                <li key={review.id}>
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-medium text-foreground">
                      {review.userName || "Leitor anônimo"}
                    </span>
                    {review.rating ? (
                      <span className="flex items-center gap-0.5 text-[10px] text-yellow-500">
                        {Array.from({ length: review.rating }).map((_, i) => (
                          <Star key={i} className="h-2.5 w-2.5 fill-current" />
                        ))}
                      </span>
                    ) : null}
                    <span className="text-[10px] text-zinc-400">
                      {new Date(review.createdAt).toLocaleDateString("pt-BR")}
                    </span>
                  </div>
                  <p className="mt-0.5 text-xs leading-relaxed text-zinc-600 dark:text-zinc-300">
                    {review.content}
                  </p>
                </li>
              ))}
            </ul>
          )}

          {isSignedIn ? (
            <form onSubmit={handleSubmit} className="space-y-2">
              <textarea
                value={content}
                onChange={(e) => setContent(e.target.value)}
                placeholder="Escreva sua review..."
                rows={2}
                className="w-full rounded-lg border border-zinc-300 bg-white px-3 py-2 text-xs text-foreground placeholder-zinc-400 focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500 dark:border-zinc-600 dark:bg-zinc-800 dark:placeholder-zinc-500"
              />
              <div className="flex items-center gap-2">
                <select
                  value={rating}
                  onChange={(e) => setRating(e.target.value)}
                  className="rounded-lg border border-zinc-300 bg-white px-2 py-1.5 text-xs text-foreground focus:border-indigo-500 focus:outline-none dark:border-zinc-600 dark:bg-zinc-800"
                >
                  <option value="">Nota</option>
                  <option value="5">5★</option>
                  <option value="4">4★</option>
                  <option value="3">3★</option>
                  <option value="2">2★</option>
                  <option value="1">1★</option>
                </select>
                <button
                  type="submit"
                  disabled={loading || !content.trim()}
                  className="rounded-lg bg-indigo-600 px-3 py-1.5 text-xs font-medium text-white transition-colors hover:bg-indigo-700 disabled:opacity-60"
                >
                  {loading ? "Publicando..." : "Publicar"}
                </button>
                {error && (
                  <span className="text-[10px] text-red-500">{error}</span>
                )}
              </div>
            </form>
          ) : (
            <p className="text-xs text-zinc-400 dark:text-zinc-500">
              <Link
                href="/sign-in"
                className="font-medium text-indigo-600 hover:underline dark:text-indigo-400"
              >
                Entre
              </Link>{" "}
              para deixar sua review.
            </p>
          )}
        </div>
      )}
    </div>
  );
}
