"use client";

import { useEffect, useState, useCallback } from "react";
import { useUser } from "@clerk/nextjs";
import Image from "next/image";
import {
  Check,
  X,
  Flag,
  Shield,
  AlertTriangle,
  Loader2,
} from "lucide-react";

type ModerationStatus = "PENDING" | "APPROVED" | "REJECTED" | "FLAGGED";

interface ModerationPost {
  id: string;
  author: string;
  content: string;
  imageUrl?: string | null;
  book?: { title: string; author: string } | null;
  moderationStatus: ModerationStatus;
  moderationReason?: string | null;
  moderatedBy?: string | null;
  moderatedAt?: string | null;
  createdAt: string;
}

export default function ModerationPage() {
  const { user } = useUser();
  const [posts, setPosts] = useState<ModerationPost[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [filter, setFilter] = useState<ModerationStatus>("PENDING");
  const [processing, setProcessing] = useState<string | null>(null);

  const isAdmin = user?.publicMetadata?.role === "admin";

  useEffect(() => {
    const fetchPosts = async () => {
      if (!isAdmin) {
        setError("Acesso negado. Você não tem permissão de administrador.");
        setLoading(false);
        return;
      }

      setLoading(true);
      setError(null);
      try {
        const response = await fetch(`/api/admin/moderation?status=${filter}`);
        if (!response.ok) throw new Error("Erro ao carregar posts.");
        const data = await response.json();
        setPosts(data.posts);
      } catch (err) {
        setError(err instanceof Error ? err.message : "Erro ao carregar posts.");
      } finally {
        setLoading(false);
      }
    };

    fetchPosts();
  }, [isAdmin, filter]);

  const moderatePost = async (postId: string, action: "APPROVE" | "REJECT" | "FLAG") => {
    setProcessing(postId);
    try {
      const response = await fetch("/api/admin/moderation", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ postId, action }),
      });
      if (!response.ok) throw new Error("Erro ao moderar post.");

      // Refresh posts after moderation
      const refreshResponse = await fetch(`/api/admin/moderation?status=${filter}`);
      if (!refreshResponse.ok) throw new Error("Erro ao carregar posts.");
      const data = await refreshResponse.json();
      setPosts(data.posts);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erro ao moderar post.");
    } finally {
      setProcessing(null);
    }
  };

  if (!isAdmin) {
    return (
      <main className="min-h-[calc(100dvh-4rem)] bg-surface px-4 py-6 text-on-surface">
        <div className="mx-auto max-w-4xl">
          <div className="rounded-2xl border border-error/30 bg-error-container/20 p-8 text-center">
            <Shield className="mx-auto mb-4 h-12 w-12 text-error" />
            <h1 className="text-xl font-semibold text-error">Acesso Negado</h1>
            <p className="mt-2 text-sm text-on-surface-variant">
              Você não tem permissão para acessar esta página.
            </p>
          </div>
        </div>
      </main>
    );
  }

  const statusColors = {
    PENDING: "bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-400",
    APPROVED: "bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400",
    REJECTED: "bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400",
    FLAGGED: "bg-orange-100 text-orange-800 dark:bg-orange-900/30 dark:text-orange-400",
  };

  const statusLabels = {
    PENDING: "Pendente",
    APPROVED: "Aprovado",
    REJECTED: "Rejeitado",
    FLAGGED: "Sinalizado",
  };

  return (
    <main className="min-h-[calc(100dvh-4rem)] bg-surface px-4 py-6 text-on-surface">
      <div className="mx-auto max-w-4xl">
        <header className="mb-6">
          <p className="mb-1 text-[11px] font-semibold uppercase tracking-[0.16em] text-primary">
            Administração
          </p>
          <h1 className="font-headline-lg-mobile text-3xl font-medium tracking-tight">
            Moderação de Conteúdo
          </h1>
          <p className="mt-1 text-sm text-on-surface-variant">
            Revise e modere publicações da comunidade.
          </p>
        </header>

        <div className="mb-6 flex items-center gap-2 overflow-x-auto pb-2">
          {(["PENDING", "APPROVED", "REJECTED", "FLAGGED"] as ModerationStatus[]).map((status) => (
            <button
              key={status}
              onClick={() => setFilter(status)}
              className={`whitespace-nowrap rounded-full px-4 py-2 text-sm font-medium transition ${
                filter === status
                  ? "bg-primary text-on-primary"
                  : "bg-surface-container text-on-surface-variant hover:bg-surface-container-high"
              }`}
            >
              {statusLabels[status]}
            </button>
          ))}
        </div>

        {loading && (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="h-8 w-8 animate-spin text-primary" />
          </div>
        )}

        {error && (
          <div className="mb-4 rounded-xl border border-error/30 bg-error-container/20 p-4 text-sm text-error">
            {error}
          </div>
        )}

        {!loading && !error && posts.length === 0 && (
          <div className="rounded-xl border border-outline-variant/30 bg-surface-container-low p-8 text-center text-sm text-on-surface-variant">
            Nenhuma publicação encontrada com este filtro.
          </div>
        )}

        <div className="space-y-4">
          {posts.map((post) => (
            <article
              key={post.id}
              className="rounded-2xl border border-outline-variant/30 bg-surface-container-low p-4 shadow-lg sm:p-5"
            >
              <div className="mb-3 flex items-start justify-between">
                <div className="flex-1">
                  <div className="mb-2 flex items-center gap-2">
                    <span className="text-sm font-semibold">{post.author}</span>
                    <span
                      className={`rounded-full px-2 py-0.5 text-xs font-medium ${statusColors[post.moderationStatus]}`}
                    >
                      {statusLabels[post.moderationStatus]}
                    </span>
                  </div>
                  <p className="text-xs text-on-surface-variant">
                    {new Date(post.createdAt).toLocaleString("pt-BR")}
                  </p>
                </div>

                {post.moderationStatus === "PENDING" && (
                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => moderatePost(post.id, "APPROVE")}
                      disabled={processing === post.id}
                      className="flex items-center gap-1 rounded-full bg-green-600 px-3 py-1.5 text-xs font-medium text-white transition hover:bg-green-700 disabled:opacity-50"
                    >
                      {processing === post.id ? (
                        <Loader2 className="h-3 w-3 animate-spin" />
                      ) : (
                        <Check className="h-3 w-3" />
                      )}
                      Aprovar
                    </button>
                    <button
                      onClick={() => moderatePost(post.id, "REJECT")}
                      disabled={processing === post.id}
                      className="flex items-center gap-1 rounded-full bg-red-600 px-3 py-1.5 text-xs font-medium text-white transition hover:bg-red-700 disabled:opacity-50"
                    >
                      {processing === post.id ? (
                        <Loader2 className="h-3 w-3 animate-spin" />
                      ) : (
                        <X className="h-3 w-3" />
                      )}
                      Rejeitar
                    </button>
                    <button
                      onClick={() => moderatePost(post.id, "FLAG")}
                      disabled={processing === post.id}
                      className="flex items-center gap-1 rounded-full bg-orange-600 px-3 py-1.5 text-xs font-medium text-white transition hover:bg-orange-700 disabled:opacity-50"
                    >
                      {processing === post.id ? (
                        <Loader2 className="h-3 w-3 animate-spin" />
                      ) : (
                        <Flag className="h-3 w-3" />
                      )}
                      Sinalizar
                    </button>
                  </div>
                )}
              </div>

              {post.imageUrl && (
                <div className="mb-3 overflow-hidden rounded-xl border border-outline-variant/20">
                  <div className="relative h-64 w-full">
                    <Image src={post.imageUrl} alt="Imagem do post" fill className="object-cover" />
                  </div>
                </div>
              )}

              <p className="mb-3 text-sm leading-6 text-on-surface">{post.content}</p>

              {post.book && (
                <div className="mb-3 flex gap-3 rounded-xl border border-outline-variant/20 bg-surface-container p-3">
                  <div className="flex h-16 w-12 items-center justify-center rounded bg-surface-container-high text-xl">
                    📖
                  </div>
                  <div className="flex min-w-0 flex-col justify-center">
                    <span className="mb-1 text-[10px] font-semibold uppercase tracking-wider text-primary">
                      Livro em destaque
                    </span>
                    <h3 className="text-sm font-medium">{post.book.title}</h3>
                    <p className="text-xs text-on-surface-variant">{post.book.author}</p>
                  </div>
                </div>
              )}

              {post.moderationReason && (
                <div className="mt-3 flex items-start gap-2 rounded-lg border border-error/30 bg-error-container/20 p-3">
                  <AlertTriangle className="h-4 w-4 shrink-0 text-error" />
                  <div>
                    <p className="text-xs font-semibold text-error">Motivo da moderação</p>
                    <p className="text-xs text-on-surface-variant">{post.moderationReason}</p>
                  </div>
                </div>
              )}

              {post.moderatedBy && (
                <p className="mt-2 text-xs text-on-surface-variant">
                  Moderado por {post.moderatedBy} em{" "}
                  {post.moderatedAt
                    ? new Date(post.moderatedAt).toLocaleString("pt-BR")
                    : ""}
                </p>
              )}
            </article>
          ))}
        </div>
      </div>
    </main>
  );
}
