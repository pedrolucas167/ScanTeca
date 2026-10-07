"use client";

import Link from "next/link";
import { Bell, BellOff, BellRing, Check, Settings } from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";
import {
  PUSH_CHANGED_EVENT,
  getSwRegistration,
  pushSupported,
  subscribeToPush,
  unsubscribeFromPush,
} from "@/lib/push-client";

interface Notification {
  id: string;
  message: string;
  url: string;
  readAt: string | null;
  createdAt: string;
}

type PushState = "loading" | "unsupported" | "denied" | "off" | "on";

export default function UnifiedNotifications() {
  const [open, setOpen] = useState(false);
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [pushState, setPushState] = useState<PushState>("loading");
  const [pushBusy, setPushBusy] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  // Load notifications
  useEffect(() => {
    const load = async () => {
      const response = await fetch("/api/notifications");
      if (!response.ok) return;
      const data = (await response.json()) as {
        notifications: Notification[];
        unreadCount: number;
      };
      setNotifications(data.notifications);
      setUnreadCount(data.unreadCount);
    };
    void load();
    const close = (event: MouseEvent) => {
      if (!ref.current?.contains(event.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", close);
    return () => document.removeEventListener("mousedown", close);
  }, []);

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
    await fetch("/api/notifications", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(id ? { id } : {}),
    });
    if (id) {
      setNotifications((items) => items.map((item) => item.id === id ? { ...item, readAt: new Date().toISOString() } : item));
      setUnreadCount((count) => Math.max(0, count - 1));
    } else {
      setNotifications((items) => items.map((item) => ({ ...item, readAt: item.readAt ?? new Date().toISOString() })));
      setUnreadCount(0);
    }
  };

  const togglePush = async () => {
    if (pushBusy || pushState === "unsupported" || pushState === "denied") return;
    setPushBusy(true);
    try {
      if (pushState === "on") {
        const ok = await unsubscribeFromPush();
        if (ok) setPushState("off");
        return;
      }
      const result = await subscribeToPush();
      if (result === "subscribed") setPushState("on");
      else if (result === "denied") setPushState("denied");
      else setPushState("off");
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
    <div ref={ref} className="relative">
      <button
        type="button"
        onClick={() => setOpen((value) => !value)}
        aria-label="Notificações"
        className="relative flex h-9 w-9 items-center justify-center rounded-full text-zinc-500 transition-colors hover:bg-zinc-100 hover:text-foreground dark:text-zinc-400 dark:hover:bg-zinc-800"
      >
        <Bell className="h-5 w-5" />
        {unreadCount > 0 && <span className="absolute right-1 top-1 h-2 w-2 rounded-full bg-rose-500" />}
      </button>
      {open && (
        <div className="absolute right-0 top-full z-50 mt-2 w-80 overflow-hidden rounded-xl border border-zinc-200 bg-white shadow-xl dark:border-zinc-800 dark:bg-zinc-900">
          {/* Header */}
          <div className="flex items-center justify-between border-b border-zinc-100 px-4 py-3 dark:border-zinc-800">
            <h2 className="text-sm font-semibold">Notificações</h2>
            {unreadCount > 0 && (
              <button type="button" onClick={() => void markRead()} className="text-xs text-indigo-600 hover:underline dark:text-indigo-400">
                Marcar todas como lidas
              </button>
            )}
          </div>

          {/* Notifications list */}
          <div className="max-h-64 overflow-y-auto">
            {notifications.length === 0 ? (
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
                  <span className="mt-1 block text-xs text-zinc-400">{new Date(notification.createdAt).toLocaleString("pt-BR")}</span>
                </Link>
              ))
            )}
          </div>

          {/* Push toggle section */}
          {pushState !== "loading" && pushState !== "unsupported" && (
            <div className="border-t border-zinc-100 px-4 py-3 dark:border-zinc-800">
              <button
                type="button"
                onClick={togglePush}
                disabled={pushBusy || pushState === "denied"}
                className="flex w-full items-center justify-between rounded-lg px-3 py-2 text-sm transition-colors disabled:opacity-50 hover:bg-zinc-50 dark:hover:bg-zinc-800"
              >
                <div className="flex items-center gap-2">
                  <PushIcon className="h-4 w-4" />
                  <span className="text-zinc-700 dark:text-zinc-300">{pushTitle}</span>
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
