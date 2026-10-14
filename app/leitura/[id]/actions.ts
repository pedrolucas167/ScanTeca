"use server";

import { auth } from "@clerk/nextjs/server";
import { redirect } from "next/navigation";
import { addPassageComment } from "@/modules/reading";

export async function addAnnotation(formData: FormData, bookId: string, passageId?: string) {
  const { userId } = await auth();
  if (!userId) throw new Error("Auth required");
  if (!passageId) return;
  await addPassageComment(userId, { bookId, passageId, content: formData.get("content") });
  redirect(`/leitura/${bookId}`);
}
