"use client";

/**
 * Helpers client-side de Web Push, compartilhados entre PushBell e PushOptIn.
 * Dispara `PUSH_CHANGED_EVENT` após subscribe/unsubscribe para os
 * componentes sincronizarem estado sem reload.
 */

export const PUSH_CHANGED_EVENT = "scanteca:push-changed";

export function pushSupported(): boolean {
  return (
    typeof window !== "undefined" &&
    "serviceWorker" in navigator &&
    "PushManager" in window &&
    "Notification" in window
  );
}

function urlBase64ToUint8Array(base64: string): Uint8Array {
  const padding = "=".repeat((4 - (base64.length % 4)) % 4);
  const normalized = (base64 + padding).replace(/-/g, "+").replace(/_/g, "/");
  const raw = atob(normalized);
  const out = new Uint8Array(raw.length);
  for (let i = 0; i < raw.length; i++) out[i] = raw.charCodeAt(i);
  return out;
}

function notifyChanged() {
  window.dispatchEvent(new Event(PUSH_CHANGED_EVENT));
}

export type SubscribeResult = "subscribed" | "denied" | "dismissed" | "error";

export async function subscribeToPush(): Promise<SubscribeResult> {
  if (!pushSupported()) return "error";
  try {
    const permission = await Notification.requestPermission();
    if (permission === "denied") return "denied";
    if (permission !== "granted") return "dismissed";

    const reg = await navigator.serviceWorker.ready;
    const sub = await reg.pushManager.subscribe({
      userVisibleOnly: true,
      applicationServerKey: urlBase64ToUint8Array(
        process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY!
      ) as BufferSource,
    });

    const res = await fetch("/api/push/subscribe", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(sub.toJSON()),
    });
    if (!res.ok) return "error";

    notifyChanged();
    return "subscribed";
  } catch {
    return "error";
  }
}

export async function unsubscribeFromPush(): Promise<boolean> {
  if (!pushSupported()) return false;
  try {
    const reg = await navigator.serviceWorker.ready;
    const existing = await reg.pushManager.getSubscription();
    if (!existing) return true;

    await fetch("/api/push/subscribe", {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ endpoint: existing.endpoint }),
    }).catch(() => {});
    await existing.unsubscribe();

    notifyChanged();
    return true;
  } catch {
    return false;
  }
}
