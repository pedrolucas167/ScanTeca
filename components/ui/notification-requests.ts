export interface SocialNotification {
  id: string;
  message: string;
  url: string;
  readAt: string | null;
  createdAt: string;
}

export async function loadNotifications(signal?: AbortSignal): Promise<{
  notifications: SocialNotification[];
  unreadCount: number;
}> {
  const response = await fetch("/api/notifications", { signal });
  if (!response.ok) throw new Error("Não foi possível carregar as notificações.");
  const data = await response.json();
  if (!Array.isArray(data.notifications) || !Number.isInteger(data.unreadCount) || data.unreadCount < 0) {
    throw new Error("Não foi possível carregar as notificações.");
  }
  return data;
}

export async function markNotificationsRead(id?: string): Promise<void> {
  const response = await fetch("/api/notifications", {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(id ? { id } : {}),
  });
  if (!response.ok) throw new Error("Não foi possível marcar as notificações como lidas.");
}
