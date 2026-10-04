"use client";

import { useEffect, useState, useRef } from "react";
import { Lock, Save, Users, Camera, X } from "lucide-react";
import Image from "next/image";

type Visibility = "PUBLIC" | "FOLLOWERS" | "PRIVATE";

interface Profile {
  displayName: string;
  bio: string;
  visibility: Visibility;
  followers: number;
  following: number;
  avatarUrl?: string | null;
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
  const [uploadingAvatar, setUploadingAvatar] = useState(false);
  const [avatarPreview, setAvatarPreview] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

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

  const handleFileSelect = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    if (file.size > 5 * 1024 * 1024) {
      setMessage("Imagem muito grande. Máximo 5MB.");
      return;
    }

    const reader = new FileReader();
    reader.onloadend = () => {
      const base64 = reader.result as string;
      setAvatarPreview(base64);
      uploadAvatar(base64);
    };
    reader.readAsDataURL(file);
  };

  const uploadAvatar = async (base64: string) => {
    setUploadingAvatar(true);
    setMessage("");
    try {
      const response = await fetch("/api/profile/avatar", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ image: base64 }),
      });
      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || "Erro ao fazer upload.");
      }
      const data = (await response.json()) as { avatarUrl: string };
      setProfile((prev) => prev ? { ...prev, avatarUrl: data.avatarUrl } : null);
      setAvatarPreview(null);
      setMessage("Avatar atualizado ✨");
    } catch (error: unknown) {
      setMessage(error instanceof Error ? error.message : "Erro ao fazer upload.");
      setAvatarPreview(null);
    } finally {
      setUploadingAvatar(false);
    }
  };

  const removeAvatar = async () => {
    setUploadingAvatar(true);
    setMessage("");
    try {
      const response = await fetch("/api/profile/avatar", { method: "DELETE" });
      if (!response.ok) throw new Error("Erro ao remover avatar.");
      setProfile((prev) => prev ? { ...prev, avatarUrl: null } : null);
      setAvatarPreview(null);
      setMessage("Avatar removido ✨");
    } catch (error: unknown) {
      setMessage(error instanceof Error ? error.message : "Erro ao remover avatar.");
    } finally {
      setUploadingAvatar(false);
    }
  };

  return (
    <main className="min-h-[calc(100dvh-4rem)] bg-surface px-4 py-6 pb-28 text-on-surface sm:px-6 sm:py-8">
      <div className="mx-auto max-w-2xl sm:max-w-3xl">
        <p className="mb-1 text-[11px] font-semibold uppercase tracking-[0.16em] text-primary sm:text-xs">Minha presença social</p>
        <h1 className="font-headline-lg-mobile text-3xl font-medium sm:text-4xl">Perfil do leitor</h1>
        <p className="mt-1 text-sm text-on-surface-variant sm:text-base">Escolha como a comunidade pode encontrar você.</p>

        <section className="mt-6 rounded-2xl border border-outline-variant/30 bg-surface-container-low p-5 shadow-lg sm:p-6">
          <div className="mb-5 flex items-center gap-4 sm:gap-6">
            <div className="relative group shrink-0">
              <div className="flex h-20 w-20 items-center justify-center overflow-hidden rounded-full border-2 border-primary/40 bg-surface-container-high sm:h-24 sm:w-24">
                {avatarPreview ? (
                  <Image src={avatarPreview} alt="Preview" width={96} height={96} className="h-full w-full object-cover" />
                ) : profile.avatarUrl ? (
                  <Image src={profile.avatarUrl} alt={profile.displayName} width={96} height={96} className="h-full w-full object-cover" />
                ) : (
                  <span className="text-lg font-bold text-primary sm:text-xl">{profile.displayName.slice(0, 2).toUpperCase()}</span>
                )}
              </div>
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                disabled={uploadingAvatar}
                className="absolute -bottom-1 -right-1 flex h-8 w-8 items-center justify-center rounded-full bg-primary text-white shadow-lg transition hover:bg-primary/90 disabled:opacity-50 sm:h-9 sm:w-9"
                aria-label="Alterar avatar"
              >
                <Camera className="h-4 w-4 sm:h-5 sm:w-5" />
              </button>
              {profile.avatarUrl && !avatarPreview && (
                <button
                  type="button"
                  onClick={() => void removeAvatar()}
                  disabled={uploadingAvatar}
                  className="absolute -top-1 -right-1 flex h-6 w-6 items-center justify-center rounded-full bg-error text-white shadow-lg transition hover:bg-error/90 disabled:opacity-50 sm:h-7 sm:w-7"
                  aria-label="Remover avatar"
                >
                  <X className="h-3 w-3 sm:h-4 sm:w-4" />
                </button>
              )}
            </div>
            <div className="min-w-0 flex-1">
              <h2 className="text-lg font-semibold sm:text-xl">{profile.displayName}</h2>
              <div className="mt-1 flex gap-3 text-xs text-on-surface-variant sm:text-sm">
                <span><Users className="mr-1 inline h-3.5 w-3.5 sm:h-4 sm:w-4" />{profile.followers} seguidores</span>
                <span>{profile.following} seguindo</span>
              </div>
            </div>
          </div>
          <input
            ref={fileInputRef}
            type="file"
            accept="image/jpeg,image/jpg,image/png,image/webp"
            onChange={handleFileSelect}
            className="hidden"
          />

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
