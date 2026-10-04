"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { ArrowLeft, Lock, UserMinus, UserPlus, Users } from "lucide-react";

interface PublicProfile {
  userId: string;
  displayName: string;
  bio: string;
  visibility: "PUBLIC" | "FOLLOWERS" | "PRIVATE";
  followers: number;
  following: number;
  isFollowing: boolean;
  restricted: boolean;
  posts: Array<{
    id: string;
    text: string;
    label: string;
    time: string;
    likes: number;
    comments: number;
    book: { title: string; author: string; cover: string | null } | null;
  }>;
}

export default function PublicProfileClient({ userId }: { userId: string }) {
  const [profile, setProfile] = useState<PublicProfile | null>(null);
  const [error, setError] = useState("");

  useEffect(() => {
    fetch(`/api/profile/${encodeURIComponent(userId)}`)
      .then(async (response) => {
        if (!response.ok) throw new Error("Perfil não encontrado.");
        return response.json() as Promise<{ profile: PublicProfile }>;
      })
      .then((data) => setProfile(data.profile))
      .catch((reason: unknown) => setError(reason instanceof Error ? reason.message : "Erro ao carregar perfil."));
  }, [userId]);

  const toggleFollow = async () => {
    if (!profile) return;
    const response = await fetch("/api/profile/follow", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ followingId: profile.userId }),
    });
    if (!response.ok) {
      setError("Não foi possível atualizar o vínculo.");
      return;
    }
    const data = (await response.json()) as { following: boolean };
    setProfile({ ...profile, isFollowing: data.following, followers: profile.followers + (data.following ? 1 : -1) });
  };

  if (error) return <main className="mx-auto max-w-2xl p-6 text-sm text-error">{error}</main>;
  if (!profile) return <main className="mx-auto max-w-2xl p-6 text-sm text-on-surface-variant">Carregando perfil... 📚</main>;

  return (
    <main className="min-h-[calc(100dvh-4rem)] bg-surface px-4 py-6 pb-28 text-on-surface">
      <div className="mx-auto max-w-2xl">
        <Link href="/descobrir/leitores" className="inline-flex items-center gap-2 text-xs text-on-surface-variant hover:text-primary">
          <ArrowLeft className="h-4 w-4" />Voltar para descoberta
        </Link>
        <section className="mt-5 rounded-2xl border border-outline-variant/30 bg-surface-container-low p-5 shadow-lg">
          <div className="flex items-start gap-4">
            <div className="flex h-16 w-16 shrink-0 items-center justify-center rounded-full bg-primary-container text-lg font-bold text-on-primary-container">
              {profile.displayName.slice(0, 2).toUpperCase()}
            </div>
            <div className="min-w-0 flex-1">
              <h1 className="text-2xl font-medium">{profile.displayName}</h1>
              <p className="mt-2 text-sm leading-6 text-on-surface-variant">{profile.bio || "Leitor em busca da próxima história."}</p>
              <div className="mt-3 flex gap-4 text-xs text-on-surface-variant">
                <span><Users className="mr-1 inline h-3.5 w-3.5" />{profile.followers} seguidores</span>
                <span>{profile.following} seguindo</span>
              </div>
            </div>
            <button type="button" onClick={() => void toggleFollow()} className={`inline-flex shrink-0 items-center gap-1.5 rounded-full px-3 py-2 text-xs font-semibold ${profile.isFollowing ? "border border-primary/30 text-primary" : "bg-primary-container text-on-primary-container"}`}>
              {profile.isFollowing ? <UserMinus className="h-3.5 w-3.5" /> : <UserPlus className="h-3.5 w-3.5" />}
              {profile.isFollowing ? "Seguindo" : "Seguir"}
            </button>
          </div>
        </section>

        {profile.restricted ? (
          <section className="mt-5 rounded-2xl border border-outline-variant/30 bg-surface-container-low p-8 text-center">
            <Lock className="mx-auto h-8 w-8 text-primary" />
            <h2 className="mt-3 font-headline-md text-xl">Perfil restrito</h2>
            <p className="mt-2 text-sm text-on-surface-variant">
              Siga este leitor para acompanhar as publicações.
            </p>
          </section>
        ) : (
          <section className="mt-5">
            <h2 className="mb-3 font-headline-md text-xl">Publicações</h2>
            <div className="space-y-4">
              {profile.posts.length === 0 && <p className="rounded-xl border border-outline-variant/30 bg-surface-container-low p-5 text-sm text-on-surface-variant">Ainda não há publicações.</p>}
              {profile.posts.map((post) => (
                <article key={post.id} className="rounded-2xl border border-outline-variant/30 bg-surface-container-low p-4">
                  <p className="text-xs text-primary">{post.label} · {new Date(post.time).toLocaleDateString("pt-BR")}</p>
                  <p className="mt-2 text-sm leading-6">{post.text}</p>
                  {post.book && <p className="mt-3 rounded-xl bg-surface-container p-3 text-xs text-on-surface-variant">📖 {post.book.title} · {post.book.author}</p>}
                  <p className="mt-3 text-xs text-on-surface-variant">❤️ {post.likes} · 💬 {post.comments}</p>
                </article>
              ))}
            </div>
          </section>
        )}
      </div>
    </main>
  );
}
