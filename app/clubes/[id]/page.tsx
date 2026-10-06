"use client";

import { useState, useEffect } from "react";
import { useParams, useRouter } from "next/navigation";
import { ArrowLeft, Users, BookOpen, MessageSquare, Plus, Settings, LogOut } from "lucide-react";
import Link from "next/link";

interface BookClubDiscussion {
  id: string;
  title: string;
  content: string;
  bookId: string | null;
  userId: string;
  userName: string | null;
  createdAt: string;
  replyCount: number;
  replies: Array<{
    id: string;
    userId: string;
    userName: string | null;
    content: string;
    createdAt: string;
  }>;
}

interface BookClub {
  id: string;
  name: string;
  description: string | null;
  imageUrl: string | null;
  maxMembers: number | null;
  isPrivate: boolean;
  memberCount: number;
  discussionCount: number;
  isMember: boolean;
  isOwner: boolean;
  isAdmin: boolean;
  role: string | null;
  createdAt: string;
  discussions: BookClubDiscussion[];
}

export default function BookClubDetailPage() {
  const params = useParams();
  const router = useRouter();
  const [club, setClub] = useState<BookClub | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showNewDiscussion, setShowNewDiscussion] = useState(false);
  const [newDiscussion, setNewDiscussion] = useState({ title: "", content: "", bookId: "" });

  const loadClub = async () => {
    try {
      const response = await fetch(`/api/book-clubs/${params.id}`);
      if (!response.ok) {
        if (response.status === 404) {
          setError("Clube não encontrado");
        } else if (response.status === 403) {
          setError("Acesso negado");
        } else {
          setError("Erro ao carregar clube");
        }
        return;
      }
      const data = await response.json();
      setClub(data.club);
    } catch {
      setError("Erro ao carregar clube");
    } finally {
      setLoading(false);
    }
  };

  /* eslint-disable react-hooks/set-state-in-effect, react-hooks/exhaustive-deps */
  useEffect(() => {
    loadClub();
  }, [params.id]);
  /* eslint-enable react-hooks/set-state-in-effect, react-hooks/exhaustive-deps */

  const handleJoinLeave = async (action: "join" | "leave") => {
    try {
      const response = await fetch(`/api/book-clubs/${params.id}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action }),
      });

      if (!response.ok) {
        const error = await response.json();
        alert(error.error || "Erro ao realizar ação");
        return;
      }

      loadClub();
    } catch {
      alert("Erro ao realizar ação");
    }
  };

  const handleCreateDiscussion = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const response = await fetch(`/api/book-clubs/${params.id}/discussions`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(newDiscussion),
      });

      if (!response.ok) {
        const error = await response.json();
        alert(error.error || "Erro ao criar discussão");
        return;
      }

      setShowNewDiscussion(false);
      setNewDiscussion({ title: "", content: "", bookId: "" });
      loadClub();
    } catch {
      alert("Erro ao criar discussão");
    }
  };

  if (loading) {
    return (
      <div className="flex flex-1 flex-col items-center justify-center px-4 py-8">
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-indigo-600 border-t-transparent" />
      </div>
    );
  }

  if (error || !club) {
    return (
      <div className="flex flex-1 flex-col items-center justify-center px-4 py-8">
        <p className="text-zinc-600 dark:text-zinc-400">{error || "Clube não encontrado"}</p>
        <Link
          href="/clubes"
          className="mt-4 text-indigo-600 hover:text-indigo-700 dark:text-indigo-400"
        >
          Voltar para clubes
        </Link>
      </div>
    );
  }

  return (
    <div className="flex flex-1 flex-col px-4 py-8">
      <div className="mx-auto w-full max-w-4xl">
        <Link
          href="/clubes"
          className="mb-6 inline-flex items-center gap-1 text-sm font-medium text-indigo-600 hover:text-indigo-700 dark:text-indigo-400"
        >
          <ArrowLeft className="h-4 w-4" />
          Voltar aos clubes
        </Link>

        <div className="mb-8 overflow-hidden rounded-xl border border-zinc-200 bg-white shadow-sm dark:border-zinc-800 dark:bg-zinc-900">
          <div className="p-6">
            <div className="mb-4 flex items-start justify-between">
              <div className="flex-1">
                <h1 className="text-3xl font-bold text-foreground">{club.name}</h1>
                {club.description && (
                  <p className="mt-2 text-zinc-600 dark:text-zinc-400">{club.description}</p>
                )}
              </div>
              {club.isAdmin && (
                <button
                  onClick={() => router.push(`/clubes/${club.id}/configurar`)}
                  className="rounded-lg p-2 text-zinc-600 hover:bg-zinc-100 dark:text-zinc-400 dark:hover:bg-zinc-800"
                >
                  <Settings className="h-5 w-5" />
                </button>
              )}
            </div>

            <div className="flex flex-wrap items-center gap-4 text-sm text-zinc-500 dark:text-zinc-400">
              <div className="flex items-center gap-1">
                <Users className="h-4 w-4" />
                <span>{club.memberCount} membros</span>
              </div>
              <div className="flex items-center gap-1">
                <BookOpen className="h-4 w-4" />
                <span>{club.discussionCount} discussões</span>
              </div>
              {club.maxMembers && (
                <div className="flex items-center gap-1">
                  <span>Máximo: {club.maxMembers}</span>
                </div>
              )}
            </div>

            <div className="mt-6 flex items-center gap-3">
              {club.isMember ? (
                <>
                  <button
                    onClick={() => handleJoinLeave("leave")}
                    disabled={club.isOwner}
                    className="inline-flex items-center gap-2 rounded-lg border border-zinc-300 px-4 py-2 text-sm font-medium text-zinc-700 hover:bg-zinc-50 disabled:opacity-50 dark:border-zinc-700 dark:text-zinc-300 dark:hover:bg-zinc-800"
                  >
                    <LogOut className="h-4 w-4" />
                    Sair do Clube
                  </button>
                  <button
                    onClick={() => setShowNewDiscussion(true)}
                    className="inline-flex items-center gap-2 rounded-lg bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-700"
                  >
                    <Plus className="h-4 w-4" />
                    Nova Discussão
                  </button>
                </>
              ) : (
                <button
                  onClick={() => handleJoinLeave("join")}
                  className="inline-flex items-center gap-2 rounded-lg bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-700"
                >
                  <Users className="h-4 w-4" />
                  Entrar no Clube
                </button>
              )}
            </div>
          </div>
        </div>

        <div className="mt-8">
          <h2 className="mb-4 text-xl font-semibold text-foreground">Discussões</h2>

          {club.discussions.length === 0 ? (
            <div className="flex flex-col items-center justify-center rounded-xl border border-zinc-200 bg-white p-8 text-center dark:border-zinc-800 dark:bg-zinc-900">
              <MessageSquare className="h-16 w-16 text-zinc-400" />
              <h3 className="mt-4 text-lg font-medium text-foreground">
                {club.isMember ? "Nenhuma discussão ainda" : "Entre no clube para ver as discussões"}
              </h3>
              <p className="mt-2 text-zinc-600 dark:text-zinc-400">
                {club.isMember ? "Seja o primeiro a iniciar uma discussão" : "Participe do clube para contribuir"}
              </p>
            </div>
          ) : (
            <div className="space-y-4">
              {club.discussions.map((discussion) => (
                <Link
                  key={discussion.id}
                  href={`/clubes/${club.id}/discussao/${discussion.id}`}
                  className="block rounded-xl border border-zinc-200 bg-white p-6 shadow-sm transition-all hover:shadow-md dark:border-zinc-800 dark:bg-zinc-900"
                >
                  <h3 className="text-lg font-semibold text-foreground">{discussion.title}</h3>
                  <p className="mt-2 line-clamp-2 text-zinc-600 dark:text-zinc-400">
                    {discussion.content}
                  </p>
                  <div className="mt-4 flex items-center gap-4 text-sm text-zinc-500 dark:text-zinc-400">
                    <span>{discussion.userName || "Anônimo"}</span>
                    <span>•</span>
                    <span>{new Date(discussion.createdAt).toLocaleDateString("pt-BR")}</span>
                    {discussion.replyCount > 0 && (
                      <>
                        <span>•</span>
                        <span>{discussion.replyCount} respostas</span>
                      </>
                    )}
                  </div>
                </Link>
              ))}
            </div>
          )}
        </div>
      </div>

      {showNewDiscussion && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="w-full max-w-md rounded-xl border border-zinc-200 bg-white p-6 shadow-lg dark:border-zinc-800 dark:bg-zinc-900">
            <h2 className="mb-4 text-xl font-bold text-foreground">Nova Discussão</h2>
            <form onSubmit={handleCreateDiscussion} className="space-y-4">
              <div>
                <label className="mb-1 block text-sm font-medium text-foreground">
                  Título *
                </label>
                <input
                  type="text"
                  value={newDiscussion.title}
                  onChange={(e) => setNewDiscussion({ ...newDiscussion, title: e.target.value })}
                  required
                  className="w-full rounded-lg border border-zinc-300 bg-white px-3 py-2 text-foreground focus:border-indigo-500 focus:outline-none dark:border-zinc-700 dark:bg-zinc-800"
                  placeholder="Título da discussão"
                />
              </div>

              <div>
                <label className="mb-1 block text-sm font-medium text-foreground">
                  Conteúdo *
                </label>
                <textarea
                  value={newDiscussion.content}
                  onChange={(e) => setNewDiscussion({ ...newDiscussion, content: e.target.value })}
                  required
                  rows={4}
                  className="w-full rounded-lg border border-zinc-300 bg-white px-3 py-2 text-foreground focus:border-indigo-500 focus:outline-none dark:border-zinc-700 dark:bg-zinc-800"
                  placeholder="O que você quer discutir?"
                />
              </div>

              <div className="flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setShowNewDiscussion(false)}
                  className="rounded-lg px-4 py-2 text-sm font-medium text-zinc-700 hover:bg-zinc-100 dark:text-zinc-300 dark:hover:bg-zinc-800"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="rounded-lg bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-700"
                >
                  Criar Discussão
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
