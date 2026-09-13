import { auth } from "@clerk/nextjs/server";
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { isAdmin } from "@/lib/admin";
import { pushConfigured, sendPush } from "@/lib/push";
import { readJson } from "@/lib/validation";
import { rateLimitGuard, rateLimits } from "@/lib/rate-limit";

const broadcastSchema = z.object({
  title: z.string().trim().min(1, "Título obrigatório").max(80),
  body: z.string().trim().min(1, "Mensagem obrigatória").max(240),
  url: z
    .string()
    .trim()
    .max(500)
    .regex(/^\/|^https?:\/\//, "URL deve ser interna (/...) ou https")
    .optional(),
});

export async function POST(request: NextRequest) {
  const { userId } = await auth();
  if (!userId)
    return NextResponse.json({ error: "Não autorizado" }, { status: 401 });
  if (!(await isAdmin()))
    return NextResponse.json({ error: "Proibido" }, { status: 403 });

  const rateLimit = await rateLimitGuard(request, {
    route: "admin/broadcast",
    userId,
    ...rateLimits["admin/broadcast"],
  });
  if (rateLimit) return rateLimit;

  if (!pushConfigured()) {
    return NextResponse.json(
      { error: "Push não configurado — faltam as VAPID keys no servidor" },
      { status: 503 }
    );
  }

  const parsed = await readJson(request, broadcastSchema);
  if (!parsed.ok) return parsed.response;

  const result = await sendPush(parsed.data);
  return NextResponse.json({ ok: true, ...result });
}
