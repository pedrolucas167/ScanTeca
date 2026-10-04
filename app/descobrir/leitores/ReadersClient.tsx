"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { Search, UserPlus, Users } from "lucide-react";

interface Reader {
  userId: string;
  displayName: string;
  bio: string;
  visibility: "PUBLIC" | "FOLLOWERS";
  followers: number;
  following: number;
  isFollowing: boolean;
}

export default function ReadersClient() {
  const [query, setQuery] = useState("");
  const [readers, setReaders] = useState<Reader[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const loadReaders = async (search = "") => {
    setLoading(true);
    setError("");
    try {
      const response = await fetch(`/api/discover/readers?q=${encodeURIComponent(search)}`);
      if (!response.ok) throw new Error("Não foi possível carregar os leitores.");
      const data = (await response.json()) as { readers: Reader[] };
      setReaders(data.readers);
    } catch (reason: unknown) {
      setError(reason instanceof Error ? reason.message : "Erro ao carregar leitores.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    let cancelled = false;
    fetch("/api/discover/readers")
      .then(async (response) => {
        if (!response.ok) throw new Error("Não foi possível carregar os leitores.");
        return response.json() as Promise<{ readers: Reader[] }>;
      })
      .then((data) => {
        if (!cancelled) setReaders(data.readers);
      })
      .catch((reason: unknown) => {
        if (!cancelled) {
          setError(reason instanceof Error ? reason.message : "Erro ao carregar leitores.");
        }
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const toggleFollow = async (reader: Reader) => {
    const response = await fetch("/api/profile/follow", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ followingId: reader.userId }),
    });
    if (!response.ok) {
      setError("Não foi possível atualizar o vínculo.");
      return;
    }
    const data = (await response.json()) as { following: boolean };
    setReaders((current) => current.map((item) =>
      item.userId === reader.userId
        ? { ...item, isFollowing: data.following, followers: item.followers + (data.following ? 1 : -1) }
        : item
    ));
  };

  return (
    <main className="min-h-[calc(100dvh-4rem)] bg-surface px-4 py-6 pb-28 text-on-surface">
      <div className="mx-auto max-w-3xl">
        <p className="mb-1 text-[11px] font-semibold uppercase tracking-[0.16em] text-primary">Grafo social</p>
        <h1 className="font-headline-lg-mobile text-3xl font-medium">Descobrir leitores</h1>
        <p className="mt-1 text-sm text-on-surface-variant">Encontre pessoas que também transformam livros em conversa. ✨</p>

        <form
          className="relative mt-6"
          onSubmit={(event) => {
            event.preventDefault();
            void loadReaders(query);
          }}
        >
          <Search className="absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-primary" />
          <input
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Buscar por nome ou bio..."
            className="w-full rounded-full border border-outline-variant/30 bg-surface-container-lowest py-3 pl-11 pr-24 text-sm outline-none focus:border-primary"
          />
          <button type="submit" className="absolute right-2 top-1/2 -translate-y-1/2 rounded-full bg-primary-container px-4 py-2 text-xs font-semibold text-on-primary-container">
            Buscar
          </button>
        </form>

        {error && <p className="mt-4 rounded-xl bg-error-container/20 p-3 text-sm text-error">{error}</p>}
        <div className="mt-6 grid gap-4 sm:grid-cols-2">
          {loading && <p className="text-sm text-on-surface-variant">Mapeando leitores... 📚</p>}
          {!loading && readers.length === 0 && (
            <p className="rounded-2xl border border-outline-variant/30 bg-surface-container-low p-6 text-sm text-on-surface-variant sm:col-span-2">
              Nenhum leitor encontrado. Tente outro nome ou convide alguém para a rede.
            </p>
          )}
          {readers.map((reader) => (
            <article key={reader.userId} className="rounded-2xl border border-outline-variant/30 bg-surface-container-low p-4 shadow-lg">
              <div className="flex items-start gap-3">
                <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-primary-container text-sm font-bold text-on-primary-container">
                  {reader.displayName.slice(0, 2).toUpperCase()}
                </div>
                <div className="min-w-0 flex-1">
                  <Link href={`/perfil/${reader.userId}`} className="font-semibold hover:text-primary">
                    {reader.displayName}
                  </Link>
                  <p className="mt-1 line-clamp-2 text-xs leading-5 text-on-surface-variant">{reader.bio || "Leitor em busca da próxima história."}</p>
                </div>
              </div>
              <div className="mt-4 flex items-center justify-between border-t border-outline-variant/20 pt-3">
                <span className="text-xs text-on-surface-variant">
                  <Users className="mr-1 inline h-3.5 w-3.5" />{reader.followers} seguidores
                </span>
                <button type="button" onClick={() => void toggleFollow(reader)} className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-semibold ${reader.isFollowing ? "border border-primary/30 text-primary" : "bg-primary-container text-on-primary-container"}`}>
                  <UserPlus className="h-3.5 w-3.5" />{reader.isFollowing ? "Seguindo" : "Seguir"}
                </button>
              </div>
            </article>
          ))}
        </div>
      </div>
    </main>
  );
}
