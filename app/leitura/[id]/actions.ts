"use server";

import { auth } from "@clerk/nextjs/server";
import { prisma } from "@/lib/prisma";
import { redirect } from "next/navigation";

export async function addAnnotation(formData: FormData, bookId: string, passageId?: string) {
  const { userId } = await auth();
  if (!userId) throw new Error("Auth required");
  const content = formData.get("content") as string;
  if (!content || !passageId) return;
  await prisma.annotation.create({
    data: {
      passageId,
      userId,
      content,
      type: "comment",
    },
  });
  redirect(`/leitura/${bookId}`);
}
