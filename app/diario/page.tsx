import { auth } from "@clerk/nextjs/server";
import { redirect } from "next/navigation";
import { getDiaryPage } from "@/modules/reading";
import DiaryClient from "./DiaryClient";

export const dynamic = "force-dynamic";

export default async function DiaryPage({ searchParams }: { searchParams: Promise<{ bookId?: string }> }) {
  const { userId } = await auth();
  if (!userId) redirect("/sign-in");
  const { bookId } = await searchParams;

  const { books, active, sessions, entries } = await getDiaryPage(userId);

  return <DiaryClient books={books} initialActive={active} sessions={sessions} initialEntries={entries} initialBookId={bookId} />;
}
