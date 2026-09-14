"use client";

import { useEffect, useState } from "react";
import { MonitorSmartphone, Trash2 } from "lucide-react";

interface Device {
  id: string;
  userAgent: string | null;
  createdAt: string;
}

interface Prefs {
  reviews: boolean;
  updates: boolean;
  progress: boolean;
}

function parseUserAgent(ua: string | null): string {
  if (!ua) return "Dispositivo desconhecido";
  if (/iphone|ipad/i.test(ua)) return "iPhone/iPad";
  if (/android/i.test(ua)) return "Android";
  if (/windows/i.test(ua)) return "Windows";
  if (/mac os|macintosh/i.test(ua)) return "Mac";
  if (/linux/i.test(ua)) return "Linux";
  return "Outro dispositivo";
}

function browserName(ua: string | null): string {
  if (!ua) return "";
  if (/edg\//i.test(ua)) return "Edge";
  if (/chrome\//i.test(ua)) return "Chrome";
  if (/firefox\//i.test(ua)) return "Firefox";
  if (/safari\//i.test(ua)) return "Safari";
  return "";
}

export default function NotificationSettings() {
  const [devices, setDevices] = useState<Device[] | null>(null);
  const [prefs, setPrefs] = useState<Prefs | null>(null);
  const [removing, setRemoving] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const [devRes, prefRes] = await Promise.all([
          fetch("/api/push/devices"),
          fetch("/api/push/preferences"),
        ]);
        if (!cancelled && devRes.ok) {
          const data = await devRes.json();
          setDevices(data.devices);
        }
        if (!cancelled && prefRes.ok) {
          const data = await prefRes.json();
          setPrefs(data.preferences);
        }
      } catch {
        if (!cancelled) setError("Falha ao carregar configurações");
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const togglePref = async (key: keyof Prefs) => {
    if (!prefs) return;
    const next = { ...prefs, [key]: !prefs[key] };
    setPrefs(next); // otimista
    try {
      const res = await fetch("/api/push/preferences", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ [key]: next[key] }),
      });
      if (!res.ok) throw new Error();
    } catch {
      setPrefs(prefs); // rollback
      setError("Falha ao salvar preferência");
    }
  };

  const removeDevice = async (id: string) => {
    if (removing) return;
    setRemoving(id);
    try {
      const res = await fetch(`/api/push/devices/${id}`, { method: "DELETE" });
      if (!res.ok) throw new Error();
      setDevices((prev) => prev?.filter((d) => d.id !== id) ?? null);
    } catch {
      setError("Falha ao remover dispositivo");
    } finally {
      setRemoving(null);
    }
  };

  const toggleCls = (on: boolean) =>
    `relative h-6 w-11 rounded-full transition-colors ${
      on ? "bg-indigo-600" : "bg-zinc-300 dark:bg-zinc-700"
    }`;
  const knobCls = (on: boolean) =>
    `absolute top-0.5 h-5 w-5 rounded-full bg-white shadow transition-transform ${
      on ? "translate-x-[22px]" : "translate-x-0.5"
    }`;

  return (
    <div className="mt-6 space-y-6">
      {error && (
        <p className="rounded-lg bg-red-50 p-3 text-sm text-red-600 dark:bg-red-950/40 dark:text-red-400">
          {error}
        </p>
      )}

      {/* Preferências por categoria */}
      <section className="rounded-xl border border-zinc-200 bg-white p-5 dark:border-zinc-800 dark:bg-zinc-900">
        <h2 className="text-sm font-semibold uppercase tracking-wider text-indigo-600 dark:text-indigo-400">
          O que você quer receber
        </h2>
        <div className="mt-4 space-y-4">
          {(
            [
              {
                key: "updates" as const,
                label: "Novidades e atualizações",
                desc: "Avisos sobre novas features e melhorias do Scanteca.",
              },
              {
                key: "reviews" as const,
                label: "Reviews na sua biblioteca",
                desc: "Quando alguém comenta em um livro da sua estante compartilhada.",
              },
              {
                key: "progress" as const,
                label: "Progresso de leitura",
                desc: "Meta anual batida e lembretes quando você fica dias sem registrar páginas.",
              },
            ]
          ).map((item) => (
            <div key={item.key} className="flex items-center justify-between gap-4">
              <div>
                <p className="text-sm font-medium text-foreground">{item.label}</p>
                <p className="text-xs text-zinc-500 dark:text-zinc-400">
                  {item.desc}
                </p>
              </div>
              <button
                type="button"
                role="switch"
                aria-checked={prefs?.[item.key] ?? true}
                aria-label={item.label}
                disabled={!prefs}
                onClick={() => togglePref(item.key)}
                className={toggleCls(prefs?.[item.key] ?? true)}
              >
                <span className={knobCls(prefs?.[item.key] ?? true)} />
              </button>
            </div>
          ))}
        </div>
      </section>

      {/* Dispositivos inscritos */}
      <section className="rounded-xl border border-zinc-200 bg-white p-5 dark:border-zinc-800 dark:bg-zinc-900">
        <h2 className="text-sm font-semibold uppercase tracking-wider text-indigo-600 dark:text-indigo-400">
          Dispositivos inscritos
        </h2>
        {devices === null ? (
          <p className="mt-4 text-sm text-zinc-500">Carregando...</p>
        ) : devices.length === 0 ? (
          <p className="mt-4 text-sm text-zinc-500 dark:text-zinc-400">
            Nenhum dispositivo inscrito. Ative as notificações pelo sino no topo
            da página.
          </p>
        ) : (
          <ul className="mt-4 divide-y divide-zinc-100 dark:divide-zinc-800">
            {devices.map((d) => (
              <li key={d.id} className="flex items-center justify-between gap-3 py-3">
                <div className="flex items-center gap-3">
                  <MonitorSmartphone className="h-5 w-5 shrink-0 text-zinc-400" />
                  <div>
                    <p className="text-sm font-medium text-foreground">
                      {parseUserAgent(d.userAgent)}
                      {browserName(d.userAgent) && (
                        <span className="text-zinc-400">
                          {" "}
                          · {browserName(d.userAgent)}
                        </span>
                      )}
                    </p>
                    <p className="text-xs text-zinc-500 dark:text-zinc-400">
                      Inscrito em{" "}
                      {new Date(d.createdAt).toLocaleDateString("pt-BR")}
                    </p>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => removeDevice(d.id)}
                  disabled={removing === d.id}
                  title="Remover dispositivo"
                  className="rounded-full p-2 text-zinc-400 transition-colors hover:bg-red-50 hover:text-red-600 disabled:opacity-50 dark:hover:bg-red-950/40"
                >
                  <Trash2 className="h-4 w-4" />
                </button>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
