"use client";

import { useEffect, useState } from "react";
import { BellRing, X } from "lucide-react";
import {
  getSwRegistration,
  pushSupported,
  subscribeToPush,
} from "@/lib/push-client";

const DISMISS_KEY = "scanteca:push-optin-dismissed";
// Repergunta depois de 7 dias se o usuário dispensar sem decidir.
const DISMISS_TTL_MS = 7 * 24 * 60 * 60 * 1000;

/**
 * Card de opt-in pós-login. Só aparece quando:
 * - o browser suporta push;
 * - a permissão ainda é "default" (nunca perguntada);
 * - não há inscrição ativa;
 * - o usuário não dispensou recentemente.
 * O texto funciona como termo de aceite: ao clicar em "Ativar" o usuário
 * consente em receber notificações — e o prompt nativo do browser confirma.
 */
export default function PushOptIn() {
  const [visible, setVisible] = useState(false);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      await Promise.resolve();
      if (cancelled || !pushSupported()) return;
      if (Notification.permission !== "default") return;

      const dismissedAt = Number(localStorage.getItem(DISMISS_KEY) || 0);
      if (dismissedAt && Date.now() - dismissedAt < DISMISS_TTL_MS) return;

      const reg = await getSwRegistration();
      const sub = reg
        ? await reg.pushManager.getSubscription().catch(() => null)
        : null;
      if (!cancelled && !sub) setVisible(true);
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const dismiss = () => {
    localStorage.setItem(DISMISS_KEY, String(Date.now()));
    setVisible(false);
  };

  const accept = async () => {
    if (busy) return;
    setBusy(true);
    const result = await subscribeToPush();
    setBusy(false);
    // "subscribed" e "denied" são decisões definitivas — some de vez.
    // "dismissed"/"error" também fecha, mas o dismiss nativo do browser
    // não grava no localStorage: o card pode reaparecer em outra sessão.
    if (result === "denied") {
      localStorage.setItem(DISMISS_KEY, String(Date.now()));
    }
    setVisible(false);
  };

  if (!visible) return null;

  return (
    <div className="fixed inset-x-4 bottom-4 z-50 mx-auto max-w-md sm:inset-x-auto sm:right-6 sm:bottom-6 sm:mx-0">
      <div className="rounded-2xl border border-zinc-200 bg-white p-4 shadow-xl shadow-zinc-900/10 dark:border-zinc-800 dark:bg-zinc-900 dark:shadow-black/40">
        <div className="flex items-start gap-3">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-indigo-100 dark:bg-indigo-950">
            <BellRing className="h-5 w-5 text-indigo-600 dark:text-indigo-400" />
          </div>
          <div className="min-w-0 flex-1">
            <p className="text-sm font-semibold text-foreground">
              Ative as notificações
            </p>
            <p className="mt-1 text-xs leading-relaxed text-zinc-500 dark:text-zinc-400">
              Receba avisos sobre novidades e atualizações do Scanteca. Ao
              ativar, você concorda em receber notificações push neste
              dispositivo — pode desativar quando quiser pelo sino no topo ou
              nas configurações do navegador.
            </p>
            <div className="mt-3 flex items-center gap-2">
              <button
                type="button"
                onClick={accept}
                disabled={busy}
                className="rounded-full bg-indigo-600 px-4 py-1.5 text-xs font-medium text-white transition-colors hover:bg-indigo-700 disabled:opacity-50"
              >
                {busy ? "Ativando..." : "Ativar notificações"}
              </button>
              <button
                type="button"
                onClick={dismiss}
                className="rounded-full px-3 py-1.5 text-xs font-medium text-zinc-500 transition-colors hover:bg-zinc-100 hover:text-foreground dark:text-zinc-400 dark:hover:bg-zinc-800"
              >
                Agora não
              </button>
            </div>
          </div>
          <button
            type="button"
            onClick={dismiss}
            aria-label="Fechar"
            className="shrink-0 rounded-full p-1 text-zinc-400 transition-colors hover:bg-zinc-100 hover:text-foreground dark:hover:bg-zinc-800"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
      </div>
    </div>
  );
}
