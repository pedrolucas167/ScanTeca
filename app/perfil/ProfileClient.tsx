"use client";

import { useEffect, useState } from "react";
import { Lock, Save, Users } from "lucide-react";

type Visibility = "PUBLIC" | "FOLLOWERS" | "PRIVATE";

interface Profile {
  displayName: string;
  bio: string;
  visibility: Visibility;
  followers: number;
  following: number;
}

const visibilityLabels: Record<Visibility, string> = {
  PUBLIC: "Público para leitores autenticados",
  FOLLOWERS: "Somente seguidores",
  PRIVATE: "Privado",
};

export default function ProfileClient() {
  const [profile, setProfile] = useState<Profile | null>(null);
  const [message, setMessage] = useState("");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    fetch("/api/profile")
      .then(async (response) => {
        if (!response.ok) throw new Error("Não foi possível carregar seu perfil.");
        return response.json() as Promise<{ profile: Profile }>;
      })
      .then((data) => setProfile(data.profile))
      .catch((error: unknown) => setMessage(error instanceof Error ? error.message : "Erro ao carregar perfil."));
  }, []);

  if (!profile) {
    return <main className="mx-auto max-w-2xl p-6 text-sm text-on-surface-variant">{message || "Carregando perfil..."} 📚</main>;
  }

  const save = async () => {
    setSaving(true);
    setMessage("");
    try {
      const response = await fetch("/api/profile", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(profile),
      });
      if (!response.ok) throw new Error("Não foi possível salvar o perfil.");
      setMessage("Perfil atualizado ✨");
    } catch (error: unknown) {
      setMessage(error instanceof Error ? error.message : "Erro ao salvar perfil.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <main className="min-h-[calc(100dvh-4rem)] bg-surface px-4 py-6 pb-28 text-on-surface">
      <div className="mx-auto max-w-2xl">
        <p className="mb-1 text-[11px] font-semibold uppercase tracking-[0.16em] text-primary">Minha presença social</p>
        <h1 className="font-headline-lg-mobile text-3xl font-medium">Perfil do leitor</h1>
        <p className="mt-1 text-sm text-on-surface-variant">Escolha como a comunidade pode encontrar você.</p>

        <section className="mt-6 rounded-2xl border border-outline-variant/30 bg-surface-container-low p-5 shadow-lg">
          <div className="mb-5 flex items-center gap-4">
            <div className="flex h-16 w-16 items-center justify-center rounded-full bg-primary-container text-lg font-bold text-on-primary-container">
              {profile.displayName.slice(0, 2).toUpperCase()}
            </div>
            <div>
              <h2 className="text-lg font-semibold">{profile.displayName}</h2>
              <div className="mt-1 flex gap-3 text-xs text-on-surface-variant">
                <span><Users className="mr-1 inline h-3.5 w-3.5" />{profile.followers} seguidores</span>
                <span>{profile.following} seguindo</span>
              </div>
            </div>
          </div>

          <label className="mb-4 block text-sm font-medium">
            Nome exibido
            <input
              value={profile.displayName}
              onChange={(event) => setProfile({ ...profile, displayName: event.target.value })}
              maxLength={80}
              className="mt-2 w-full rounded-xl border border-outline-variant/30 bg-surface-container-lowest px-3 py-2.5 outline-none focus:border-primary"
            />
          </label>
          <label className="mb-4 block text-sm font-medium">
            Bio
            <textarea
              value={profile.bio}
              onChange={(event) => setProfile({ ...profile, bio: event.target.value })}
              maxLength={500}
              rows={4}
              placeholder="Que histórias fazem parte da sua estante? 📖"
              className="mt-2 w-full resize-none rounded-xl border border-outline-variant/30 bg-surface-container-lowest px-3 py-2.5 outline-none focus:border-primary"
            />
          </label>
          <label className="block text-sm font-medium">
            Visibilidade
            <select
              value={profile.visibility}
              onChange={(event) => setProfile({ ...profile, visibility: event.target.value as Visibility })}
              className="mt-2 w-full rounded-xl border border-outline-variant/30 bg-surface-container-lowest px-3 py-2.5 outline-none focus:border-primary"
            >
              {(Object.keys(visibilityLabels) as Visibility[]).map((visibility) => (
                <option key={visibility} value={visibility}>{visibilityLabels[visibility]}</option>
              ))}
            </select>
          </label>
          <p className="mt-3 flex items-center gap-2 text-xs text-on-surface-variant">
            <Lock className="h-3.5 w-3.5 text-primary" />
            A visibilidade também será aplicada às suas publicações no feed.
          </p>
          <button
            type="button"
            onClick={() => void save()}
            disabled={saving}
            className="mt-5 inline-flex items-center gap-2 rounded-full bg-primary-container px-4 py-2.5 text-sm font-semibold text-on-primary-container disabled:opacity-50"
          >
            <Save className="h-4 w-4" />{saving ? "Salvando..." : "Salvar perfil"}
          </button>
          {message && <p className="mt-3 text-xs text-primary">{message}</p>}
        </section>
      </div>
    </main>
  );
}
