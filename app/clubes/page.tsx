"use client";

import { useState, useEffect } from "react";
import { Plus, Users, Lock, Globe, BookOpen } from "lucide-react";
import Link from "next/link";

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
  createdAt: string;
}

export default function BookClubsPage() {
  const [clubs, setClubs] = useState<BookClub[]>([]);
  const [loading, setLoading] = useState(true);
  const [showMyClubs, setShowMyClubs] = useState(false);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [formData, setFormData] = useState({
    name: "",
    description: "",
    maxMembers: "",
    isPrivate: false,
  });

  const fetchClubs = async () => {
    try {
      const response = await fetch(`/api/book-clubs?my=${showMyClubs}`);
      const data = await response.json();
      setClubs(data.clubs || []);
    } catch {
      console.error("Erro ao carregar clubes");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchClubs();
  }, [showMyClubs]);

  const handleCreateClub = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const response = await fetch("/api/book-clubs", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: formData.name,
          description: formData.description || null,
          maxMembers: formData.maxMembers ? parseInt(formData.maxMembers) : null,
          isPrivate: formData.isPrivate,
        }),
      });

      if (!response.ok) {
        const error = await response.json();
        alert(error.error || "Erro ao criar clube");
        return;
      }

      setShowCreateModal(false);
      setFormData({ name: "", description: "", maxMembers: "", isPrivate: false });
      fetchClubs();
    } catch (error) {
      alert("Erro ao criar clube");
    }
  };

  return (
    <div className="flex flex-1 flex-col px-4 py-8">
      <div className="mx-auto w-full max-w-6xl">
        <div className="mb-8 flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold text-foreground">Clubes de Livro</h1>
            <p className="mt-2 text-zinc-600 dark:text-zinc-400">
              Participe de discussões literárias com outros leitores
            </p>
          </div>
          <button
            onClick={() => setShowCreateModal(true)}
            className="inline-flex items-center gap-2 rounded-full bg-indigo-600 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-indigo-700"
          >
            <Plus className="h-4 w-4" />
            Criar Clube
          </button>
        </div>

        <div className="mb-6 flex items-center gap-4">
          <button
            onClick={() => setShowMyClubs(false)}
            className={`rounded-full px-4 py-2 text-sm font-medium transition-colors ${
              !showMyClubs
                ? "bg-indigo-600 text-white"
                : "bg-zinc-100 text-zinc-700 hover:bg-zinc-200 dark:bg-zinc-800 dark:text-zinc-300 dark:hover:bg-zinc-700"
            }`}
          >
            <Globe className="mr-2 h-4 w-4 inline" />
            Todos os Clubes
          </button>
          <button
            onClick={() => setShowMyClubs(true)}
            className={`rounded-full px-4 py-2 text-sm font-medium transition-colors ${
              showMyClubs
                ? "bg-indigo-600 text-white"
                : "bg-zinc-100 text-zinc-700 hover:bg-zinc-200 dark:bg-zinc-800 dark:text-zinc-300 dark:hover:bg-zinc-700"
            }`}
          >
            <Users className="mr-2 h-4 w-4 inline" />
            Meus Clubes
          </button>
        </div>

        {loading ? (
          <div className="flex items-center justify-center py-12">
            <div className="h-8 w-8 animate-spin rounded-full border-2 border-indigo-600 border-t-transparent" />
          </div>
        ) : clubs.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-12 text-center">
            <BookOpen className="h-16 w-16 text-zinc-400" />
            <h3 className="mt-4 text-lg font-medium text-foreground">
              {showMyClubs ? "Você ainda não participa de nenhum clube" : "Nenhum clube encontrado"}
            </h3>
            <p className="mt-2 text-zinc-600 dark:text-zinc-400">
              {showMyClubs
                ? "Explore os clubes públicos ou crie o seu próprio"
                : "Seja o primeiro a criar um clube de livro"}
            </p>
          </div>
        ) : (
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            {clubs.map((club) => (
              <Link
                key={club.id}
                href={`/clubes/${club.id}`}
                className="group block overflow-hidden rounded-xl border border-zinc-200 bg-white shadow-sm transition-all hover:shadow-md dark:border-zinc-800 dark:bg-zinc-900"
              >
                <div className="p-6">
                  <div className="mb-4 flex items-start justify-between">
                    <div className="flex-1">
                      <div className="mb-2 flex items-center gap-2">
                        {club.isPrivate ? (
                          <Lock className="h-4 w-4 text-zinc-500" />
                        ) : (
                          <Globe className="h-4 w-4 text-zinc-500" />
                        )}
                        {club.isOwner && (
                          <span className="rounded-full bg-indigo-100 px-2 py-0.5 text-xs font-medium text-indigo-700 dark:bg-indigo-900/30 dark:text-indigo-400">
                            Dono
                          </span>
                        )}
                        {club.isMember && !club.isOwner && (
                          <span className="rounded-full bg-green-100 px-2 py-0.5 text-xs font-medium text-green-700 dark:bg-green-900/30 dark:text-green-400">
                            Membro
                          </span>
                        )}
                      </div>
                      <h3 className="text-lg font-semibold text-foreground group-hover:text-indigo-600 dark:group-hover:text-indigo-400">
                        {club.name}
                      </h3>
                    </div>
                  </div>

                  {club.description && (
                    <p className="mb-4 line-clamp-2 text-sm text-zinc-600 dark:text-zinc-400">
                      {club.description}
                    </p>
                  )}

                  <div className="flex items-center gap-4 text-sm text-zinc-500 dark:text-zinc-400">
                    <div className="flex items-center gap-1">
                      <Users className="h-4 w-4" />
                      <span>{club.memberCount}</span>
                    </div>
                    <div className="flex items-center gap-1">
                      <BookOpen className="h-4 w-4" />
                      <span>{club.discussionCount} discussões</span>
                    </div>
                  </div>
                </div>
              </Link>
            ))}
          </div>
        )}
      </div>

      {showCreateModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="w-full max-w-md rounded-xl border border-zinc-200 bg-white p-6 shadow-lg dark:border-zinc-800 dark:bg-zinc-900">
            <h2 className="mb-4 text-xl font-bold text-foreground">Criar Novo Clube</h2>
            <form onSubmit={handleCreateClub} className="space-y-4">
              <div>
                <label className="mb-1 block text-sm font-medium text-foreground">
                  Nome do Clube *
                </label>
                <input
                  type="text"
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  required
                  maxLength={100}
                  className="w-full rounded-lg border border-zinc-300 bg-white px-3 py-2 text-foreground focus:border-indigo-500 focus:outline-none dark:border-zinc-700 dark:bg-zinc-800"
                  placeholder="Ex: Clube de Ficção Científica"
                />
              </div>

              <div>
                <label className="mb-1 block text-sm font-medium text-foreground">
                  Descrição
                </label>
                <textarea
                  value={formData.description}
                  onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                  maxLength={500}
                  rows={3}
                  className="w-full rounded-lg border border-zinc-300 bg-white px-3 py-2 text-foreground focus:border-indigo-500 focus:outline-none dark:border-zinc-700 dark:bg-zinc-800"
                  placeholder="Descreva o foco do clube..."
                />
              </div>

              <div>
                <label className="mb-1 block text-sm font-medium text-foreground">
                  Máximo de Membros
                </label>
                <input
                  type="number"
                  value={formData.maxMembers}
                  onChange={(e) => setFormData({ ...formData, maxMembers: e.target.value })}
                  min="1"
                  max="1000"
                  className="w-full rounded-lg border border-zinc-300 bg-white px-3 py-2 text-foreground focus:border-indigo-500 focus:outline-none dark:border-zinc-700 dark:bg-zinc-800"
                  placeholder="Deixe vazio para sem limite"
                />
              </div>

              <div className="flex items-center gap-2">
                <input
                  type="checkbox"
                  id="isPrivate"
                  checked={formData.isPrivate}
                  onChange={(e) => setFormData({ ...formData, isPrivate: e.target.checked })}
                  className="h-4 w-4 rounded border-zinc-300 text-indigo-600 focus:ring-indigo-500"
                />
                <label htmlFor="isPrivate" className="text-sm text-foreground">
                  Clube Privado
                </label>
              </div>

              <div className="flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setShowCreateModal(false)}
                  className="rounded-lg px-4 py-2 text-sm font-medium text-zinc-700 hover:bg-zinc-100 dark:text-zinc-300 dark:hover:bg-zinc-800"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="rounded-lg bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-700"
                >
                  Criar Clube
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
