import { prisma } from "@/lib/prisma";
import { sendPush } from "@/lib/push";

export type SocialNotificationType =
  | "FOLLOW"
  | "REACTION"
  | "COMMENT"
  | "DISCUSSION_REPLY";

interface SocialNotificationInput {
  recipientId: string;
  actorId: string;
  actorName: string;
  type: SocialNotificationType;
  message: string;
  url: string;
}

export async function createSocialNotification(
  input: SocialNotificationInput
): Promise<void> {
  if (input.recipientId === input.actorId) return;

  await prisma.socialNotification.create({
    data: {
      recipientId: input.recipientId,
      actorId: input.actorId,
      type: input.type,
      message: input.message,
      url: input.url,
    },
  });

  void sendPush(
    {
      title: "Scanteca",
      body: input.message,
      url: input.url,
    },
    { userId: input.recipientId, category: "updates" }
  ).catch(() => {});
}
