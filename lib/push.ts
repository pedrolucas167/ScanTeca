import webpush from "web-push";
import { prisma } from "@/lib/prisma";

export interface PushPayload {
  title: string;
  body: string;
  url?: string;
}

/** Categorias de notificação — cada uma mapeia pra uma coluna em NotificationPreference. */
export type PushCategory = "updates" | "reviews" | "progress";

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
 * Respeita NotificationPreference: usuários que desligaram a categoria
 * não recebem. Endpoints que expiraram (404/410) são removidos do banco.
 */
export async function sendPush(
  payload: PushPayload,
  options: { userId?: string; category?: PushCategory } = {}
): Promise<{ sent: number; failed: number; removed: number }> {
  if (!ensureVapid()) return { sent: 0, failed: 0, removed: 0 };

  const { userId, category } = options;

  let subs = await prisma.pushSubscription.findMany({
    where: userId ? { userId } : undefined,
  });

  // Opt-out por categoria: remove inscrições de quem desligou essa categoria.
  if (category && subs.length > 0) {
    const userIds = [...new Set(subs.map((s) => s.userId))];
    const optedOut = await prisma.notificationPreference.findMany({
      where: { userId: { in: userIds }, [category]: false },
      select: { userId: true },
    });
    if (optedOut.length > 0) {
      const blocked = new Set(optedOut.map((p) => p.userId));
      subs = subs.filter((s) => !blocked.has(s.userId));
    }
  }

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

/**
 * Dispara push se o usuário acabou de bater a meta anual.
 * Chamado após marcar um livro como READ — só notifica quando o
 * contador do ano fica exatamente igual à meta (uma vez só).
 */
export async function notifyGoalIfReached(userId: string): Promise<void> {
  const year = new Date().getFullYear();
  const yearStart = new Date(year, 0, 1);
  const [readThisYear, setting] = await Promise.all([
    prisma.book.count({
      where: {
        userId,
        status: "READ",
        OR: [
          { finishedAt: { gte: yearStart } },
          { finishedAt: null, createdAt: { gte: yearStart } },
        ],
      },
    }),
    prisma.librarySetting.findUnique({
      where: { userId },
      select: { yearlyGoal: true },
    }),
  ]);
  const goal = setting?.yearlyGoal;
  if (!goal || readThisYear !== goal) return;
  await sendPush(
    {
      title: "Meta batida! 🎉",
      body: `Você leu ${readThisYear} livros em ${year} — meta anual completa.`,
      url: "/jornada",
    },
    { userId, category: "progress" }
  );
}

/** Registra um broadcast no histórico (chamado pela rota admin). */
export async function logBroadcast(
  adminId: string,
  payload: PushPayload,
  result: { sent: number; failed: number; removed: number },
  test: boolean
): Promise<void> {
  await prisma.broadcastLog
    .create({
      data: {
        adminId,
        title: payload.title,
        body: payload.body,
        url: payload.url ?? null,
        test,
        sent: result.sent,
        failed: result.failed,
        removed: result.removed,
      },
    })
    .catch(() => {});
}
