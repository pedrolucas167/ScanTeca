"use client";

import Link from "next/link";
import { Bell, BellOff, BellRing, Settings } from "lucide-react";
import { useCallback, useEffect, useId, useRef, useState } from "react";
import { loadNotifications, markNotificationsRead, type SocialNotification } from "./notification-requests";
import {
  PUSH_CHANGED_EVENT,
  getSwRegistration,
  pushSupported,
  subscribeToPush,
  unsubscribeFromPush,
} from "@/lib/push-client";

type PushState = "loading" | "unsupported" | "denied" | "off" | "on";

export default function UnifiedNotifications() {
  const [open, setOpen] = useState(false);
  const [notifications, setNotifications] = useState<SocialNotification[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [pushState, setPushState] = useState<PushState>("loading");
  const [pushBusy, setPushBusy] = useState(false);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const [status, setStatus] = useState("");
  const [reload, setReload] = useState(0);
  const [marking, setMarking] = useState(false);
  const markingRef = useRef(false);
  const ref = useRef<HTMLDivElement>(null);
  const trigger = useRef<HTMLButtonElement>(null);
  const panelId = useId();

  // Load notifications
  useEffect(() => {
    const controller = new AbortController();
    const load = async () => {
      try {
        const data = await loadNotifications(controller.signal);
        if (controller.signal.aborted) return;
        setNotifications(data.notifications);
        setUnreadCount(data.unreadCount);
      } catch {
        if (!controller.signal.aborted) setLoadError("Não foi possível carregar as notificações.");
      } finally {
        if (!controller.signal.aborted) setLoading(false);
      }
    };
    void load();
    const close = (event: MouseEvent) => {
      if (!ref.current?.contains(event.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", close);
    return () => {
      controller.abort();
      document.removeEventListener("mousedown", close);
    };
  }, [reload]);

  // Load push state
  const refreshPushState = useCallback(async () => {
    if (!pushSupported()) {
      setPushState("unsupported");
      return;
    }
    if (Notification.permission === "denied") {
      setPushState("denied");
      return;
    }
    const reg = await getSwRegistration();
    const sub = reg
      ? await reg.pushManager.getSubscription().catch(() => null)
      : null;
    setPushState(sub ? "on" : "off");
  }, []);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      await Promise.resolve();
      if (!cancelled) await refreshPushState();
    })();
    const onChanged = () => void refreshPushState();
    window.addEventListener(PUSH_CHANGED_EVENT, onChanged);
    return () => {
      cancelled = true;
      window.removeEventListener(PUSH_CHANGED_EVENT, onChanged);
    };
  }, [refreshPushState]);

  const markRead = async (id?: string) => {
    if (markingRef.current) return;
    markingRef.current = true;
    setMarking(true);
    setActionError(null);
    setStatus("");
    try {
      await markNotificationsRead(id);
      if (!id) trigger.current?.focus();
      if (id) {
        setNotifications((items) => items.map((item) => item.id === id ? { ...item, readAt: new Date().toISOString() } : item));
        setUnreadCount((count) => Math.max(0, count - 1));
      } else {
        setNotifications((items) => items.map((item) => ({ ...item, readAt: item.readAt ?? new Date().toISOString() })));
        setUnreadCount(0);
      }
      setStatus(id ? "Notificação marcada como lida." : "Todas as notificações foram marcadas como lidas.");
    } catch {
      setActionError("Não foi possível marcar as notificações como lidas. Tente novamente.");
    } finally {
      markingRef.current = false;
      setMarking(false);
    }
  };

  const togglePush = async () => {
    if (pushBusy || pushState === "unsupported" || pushState === "denied") return;
    setPushBusy(true);
    setActionError(null);
    setStatus("");
    try {
      if (pushState === "on") {
        const ok = await unsubscribeFromPush();
        if (ok) { setPushState("off"); setStatus("Notificações push desativadas."); }
        else setActionError("Não foi possível desativar as notificações push.");
        return;
      }
      const result = await subscribeToPush();
      if (result === "subscribed") { setPushState("on"); setStatus("Notificações push ativadas."); }
      else if (result === "denied") setPushState("denied");
      else { setPushState("off"); if (result === "error") setActionError("Não foi possível ativar as notificações push."); }
    } catch {
      setActionError("Não foi possível atualizar as notificações push.");
    } finally {
      setPushBusy(false);
    }
  };

  const PushIcon = pushState === "on" ? BellRing : pushState === "denied" ? BellOff : Bell;
  const pushTitle =
    pushState === "on"
      ? "Notificações push ativas"
      : pushState === "denied"
        ? "Notificações bloqueadas no navegador"
        : "Ativar notificações push";

  return (
    <div ref={ref} className="static sm:relative"
      onKeyDown={event => {
        if (event.key === "Escape" && open) {
          event.preventDefault(); setOpen(false); trigger.current?.focus();
        }
      }}
      onBlur={event => {
        // Desabilitar/remover o botão durante a gravação produz relatedTarget null.
        // O painel só fecha quando o foco realmente segue para outro elemento.
        if (event.relatedTarget && event.relatedTarget !== document.body && !event.currentTarget.contains(event.relatedTarget as Node)) setOpen(false);
      }}
    >
      <button
        ref={trigger}
        type="button"
        onClick={() => setOpen((value) => !value)}
        aria-label={unreadCount ? `Notificações, ${unreadCount} não lidas` : "Notificações"}
        aria-expanded={open}
        aria-controls={panelId}
        className="relative flex h-11 w-11 items-center justify-center rounded-full text-zinc-500 transition-colors hover:bg-zinc-100 hover:text-foreground dark:text-zinc-400 dark:hover:bg-zinc-800"
      >
        <Bell className="h-5 w-5" />
        {unreadCount > 0 && <span className="absolute right-1 top-1 h-2 w-2 rounded-full bg-rose-500" />}
      </button>
      {open && (
        <div id={panelId} role="region" aria-label="Notificações" className="absolute left-3 right-3 top-full z-50 mt-2 max-h-[65dvh] max-w-[calc(100vw-1.5rem)] overflow-y-auto rounded-xl border border-zinc-200 bg-white shadow-xl sm:left-auto sm:right-0 sm:w-80 dark:border-zinc-800 dark:bg-zinc-900">
          {/* Header */}
          <div className="flex items-center justify-between border-b border-zinc-100 px-4 py-3 dark:border-zinc-800">
            <h2 className="text-sm font-semibold">Notificações</h2>
            {unreadCount > 0 && (
              <button type="button" onClick={() => void markRead()} disabled={marking} className="min-h-11 px-2 text-xs text-indigo-600 hover:underline disabled:opacity-50 dark:text-indigo-400">
                {marking ? "Salvando..." : "Marcar todas como lidas"}
              </button>
            )}
          </div>

          {/* Notifications list */}
          <div className="max-h-64 overflow-y-auto">
            {loading ? <p role="status" className="px-4 py-8 text-sm text-zinc-600 dark:text-zinc-400">Carregando notificações...</p> : loadError ? (
              <div className="px-4 py-4 text-sm">
                <p role="alert">{loadError}</p>
                <button type="button" onClick={() => { setLoading(true); setLoadError(null); setReload(value => value + 1); }} className="mt-2 min-h-11 rounded-lg px-3 text-indigo-600 hover:bg-zinc-100 dark:text-indigo-400 dark:hover:bg-zinc-800">Tentar novamente</button>
              </div>
            ) : notifications.length === 0 ? (
              <p className="px-4 py-8 text-center text-sm text-zinc-500">Nenhuma novidade por enquanto. 📚</p>
            ) : (
              notifications.map((notification) => (
                <Link
                  key={notification.id}
                  href={notification.url}
                  onClick={() => {
                    if (!notification.readAt) void markRead(notification.id);
                    setOpen(false);
                  }}
                  className={`block border-b border-zinc-100 px-4 py-3 text-sm transition-colors hover:bg-zinc-50 dark:border-zinc-800 dark:hover:bg-zinc-800/60 ${
                    notification.readAt ? "text-zinc-500" : "bg-indigo-50/60 text-foreground dark:bg-indigo-950/20"
                  }`}
                >
                  <span>{notification.message}</span>
                  <span className="mt-1 block text-xs text-zinc-600 dark:text-zinc-400">{new Date(notification.createdAt).toLocaleString("pt-BR")}</span>
                </Link>
              ))
            )}
          </div>
          <p role="status" className={status ? "px-4 py-2 text-sm" : "sr-only"}>{status}</p>
          {actionError && <p role="alert" className="px-4 py-2 text-sm text-red-700 dark:text-red-300">{actionError}</p>}

          {/* Push toggle section */}
          {pushState !== "loading" && pushState !== "unsupported" && (
            <div className="border-t border-zinc-100 px-4 py-3 dark:border-zinc-800">
              <button
                type="button"
                onClick={togglePush}
                disabled={pushBusy || pushState === "denied"}
                aria-busy={pushBusy}
                className="flex min-h-11 w-full items-center justify-between rounded-lg px-3 py-2 text-sm transition-colors disabled:opacity-50 hover:bg-zinc-50 dark:hover:bg-zinc-800"
              >
                <div className="flex items-center gap-2">
                  <PushIcon className="h-4 w-4" />
                  <span className="text-zinc-700 dark:text-zinc-300">{pushBusy ? "Atualizando notificações..." : pushTitle}</span>
                </div>
                {pushState === "on" && (
                  <span className="h-2 w-2 rounded-full bg-green-500" />
                )}
              </button>
            </div>
          )}

          {/* Settings link */}
          <Link
            href="/configuracoes"
            onClick={() => setOpen(false)}
            className="flex items-center justify-center gap-2 border-t border-zinc-100 px-4 py-3 text-xs font-medium text-indigo-600 hover:bg-zinc-50 dark:border-zinc-800 dark:text-indigo-400 dark:hover:bg-zinc-800"
          >
            <Settings className="h-3.5 w-3.5" />
            Configurações de notificação
          </Link>
        </div>
      )}
    </div>
  );
}
