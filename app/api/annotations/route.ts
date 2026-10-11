import { NextRequest, NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { prisma } from "@/lib/prisma";
import { z } from "zod";

const schema = z.object({
  bookId: z.string(),
  chapter: z.number().optional(),
  paragraph: z.number(),
  content: z.string().min(1).max(2000),
  position: z.number().optional(),
  type: z.enum(["comment", "highlight", "reaction"]).default("comment"),
  sessionId: z.string().optional(),
});

export async function POST(req: NextRequest) {
  const { userId } = await auth();
  if (!userId) return NextResponse.json({ error: "Auth required" }, { status: 401 });

  const body = await req.json();
  const data = schema.parse(body);

  // Upsert passage para garantir id único do trecho
  const passage = await prisma.bookPassage.upsert({
    where: {
      // usar um identificador composite; ex: bookId+chapter+paragraph
      // ou criar um hash/slug se necessário
      id: `${data.bookId}-c${data.chapter ?? 0}-p${data.paragraph}`,
    },
    update: {},
    create: {
      id: `${data.bookId}-c${data.chapter ?? 0}-p${data.paragraph}`,
      bookId: data.bookId,
      chapter: data.chapter ?? 0,
      paragraph: data.paragraph,
    },
  });

  const annotation = await prisma.annotation.create({
    data: {
      passageId: passage.id,
      userId,
      content: data.content,
      position: data.position,
      type: data.type,
      sessionId: data.sessionId,
    },
  });

  return NextResponse.json(annotation);
}
