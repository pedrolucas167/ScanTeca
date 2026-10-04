"use client";

import Link from "next/link";
import { Bell, Check } from "lucide-react";
import { useEffect, useRef, useState } from "react";

interface Notification {
  id: string;
  message: string;
  url: string;
  readAt: string | null;
  createdAt: string;
}

export default function NotificationsMenu() {
  const [open, setOpen] = useState(false);
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const ref = useRef<HTMLDivElement>(null);

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
          <div className="flex items-center justify-between border-b border-zinc-100 px-4 py-3 dark:border-zinc-800">
            <h2 className="text-sm font-semibold">Notificações</h2>
            {unreadCount > 0 && (
              <button type="button" onClick={() => void markRead()} className="text-xs text-indigo-600 hover:underline dark:text-indigo-400">
                Marcar todas como lidas
              </button>
            )}
          </div>
          <div className="max-h-96 overflow-y-auto">
            {notifications.length === 0 ? (
              <p className="px-4 py-8 text-center text-sm text-zinc-500">Nenhuma novidade por enquanto. 📚</p>
            ) : notifications.map((notification) => (
              <Link
                key={notification.id}
                href={notification.url}
                onClick={() => { if (!notification.readAt) void markRead(notification.id); setOpen(false); }}
                className={`block border-b border-zinc-100 px-4 py-3 text-sm transition-colors hover:bg-zinc-50 dark:border-zinc-800 dark:hover:bg-zinc-800/60 ${notification.readAt ? "text-zinc-500" : "bg-indigo-50/60 text-foreground dark:bg-indigo-950/20"}`}
              >
                <span>{notification.message}</span>
                <span className="mt-1 block text-xs text-zinc-400">{new Date(notification.createdAt).toLocaleString("pt-BR")}</span>
              </Link>
            ))}
          </div>
          <Link href="/configuracoes" onClick={() => setOpen(false)} className="flex items-center justify-center gap-2 px-4 py-3 text-xs font-medium text-indigo-600 hover:bg-zinc-50 dark:text-indigo-400 dark:hover:bg-zinc-800">
            <Check className="h-3.5 w-3.5" /> Configurar notificações
          </Link>
        </div>
      )}
    </div>
  );
}
