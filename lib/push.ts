import webpush from "web-push";
import { prisma } from "@/lib/prisma";

export interface PushPayload {
  title: string;
  body: string;
  url?: string;
}

let vapidReady = false;

function ensureVapid(): boolean {
  if (vapidReady) return true;
  const publicKey = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;
  const privateKey = process.env.VAPID_PRIVATE_KEY;
  if (!publicKey || !privateKey) return false;
  webpush.setVapidDetails(
    process.env.VAPID_SUBJECT || "mailto:contato@scanteca.app",
    publicKey,
    privateKey
  );
  vapidReady = true;
  return true;
}

export function pushConfigured(): boolean {
  return ensureVapid();
}

/**
 * Envia uma notificação para todas as inscrições (ou só as de um usuário).
 * Endpoints que expiraram (404/410) são removidos do banco.
 */
export async function sendPush(
  payload: PushPayload,
  userId?: string
): Promise<{ sent: number; failed: number; removed: number }> {
  if (!ensureVapid()) return { sent: 0, failed: 0, removed: 0 };

  const subs = await prisma.pushSubscription.findMany({
    where: userId ? { userId } : undefined,
  });

  const body = JSON.stringify(payload);
  const dead: string[] = [];
  let sent = 0;
  let failed = 0;

  await Promise.all(
    subs.map(async (sub) => {
      try {
        await webpush.sendNotification(
          {
            endpoint: sub.endpoint,
            keys: { p256dh: sub.p256dh, auth: sub.auth },
          },
          body,
          { TTL: 60 * 60 * 24 }
        );
        sent++;
      } catch (err) {
        const status = (err as { statusCode?: number }).statusCode;
        if (status === 404 || status === 410) {
          dead.push(sub.id);
        } else {
          failed++;
        }
      }
    })
  );

  if (dead.length > 0) {
    await prisma.pushSubscription
      .deleteMany({ where: { id: { in: dead } } })
      .catch(() => {});
  }

  return { sent, failed, removed: dead.length };
}
