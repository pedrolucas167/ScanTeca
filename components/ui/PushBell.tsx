"use client";

import { useCallback, useEffect, useState } from "react";
import { Bell, BellOff, BellRing } from "lucide-react";
import {
  PUSH_CHANGED_EVENT,
  getSwRegistration,
  pushSupported,
  subscribeToPush,
  unsubscribeFromPush,
} from "@/lib/push-client";

type State = "loading" | "unsupported" | "denied" | "off" | "on";

export default function PushBell() {
  const [state, setState] = useState<State>("loading");
  const [busy, setBusy] = useState(false);

  const refresh = useCallback(async () => {
    if (!pushSupported()) {
      setState("unsupported");
      return;
    }
    if (Notification.permission === "denied") {
      setState("denied");
      return;
    }
    const reg = await getSwRegistration();
    const sub = reg
      ? await reg.pushManager.getSubscription().catch(() => null)
      : null;
    setState(sub ? "on" : "off");
  }, []);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      // Cede a thread: setState fora do corpo síncrono do efeito.
      await Promise.resolve();
      if (!cancelled) await refresh();
    })();
    // Sincroniza quando o PushOptIn (ou outro sino) muda a inscrição.
    const onChanged = () => void refresh();
    window.addEventListener(PUSH_CHANGED_EVENT, onChanged);
    return () => {
      cancelled = true;
      window.removeEventListener(PUSH_CHANGED_EVENT, onChanged);
    };
  }, [refresh]);

  const toggle = async () => {
    if (busy || state === "unsupported" || state === "denied") return;
    setBusy(true);
    try {
      if (state === "on") {
        const ok = await unsubscribeFromPush();
        if (ok) setState("off");
        return;
      }
      const result = await subscribeToPush();
      if (result === "subscribed") setState("on");
      else if (result === "denied") setState("denied");
      else setState("off");
    } finally {
      setBusy(false);
    }
  };

  if (state === "loading" || state === "unsupported") return null;

  const Icon = state === "on" ? BellRing : state === "denied" ? BellOff : Bell;
  const title =
    state === "on"
      ? "Notificações ativas — tocar para desativar"
      : state === "denied"
        ? "Notificações bloqueadas no navegador"
        : "Ativar notificações";

  return (
    <button
      type="button"
      onClick={toggle}
      disabled={busy || state === "denied"}
      title={title}
      aria-label={title}
      className={`flex h-9 w-9 items-center justify-center rounded-full transition-colors disabled:opacity-50 ${
        state === "on"
          ? "text-indigo-600 hover:bg-indigo-50 dark:text-indigo-400 dark:hover:bg-indigo-950"
          : "text-zinc-500 hover:bg-zinc-100 hover:text-foreground dark:text-zinc-400 dark:hover:bg-zinc-800"
      }`}
    >
      <Icon className="h-5 w-5" />
    </button>
  );
}
