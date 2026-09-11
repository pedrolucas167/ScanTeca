import { auth } from "@clerk/nextjs/server";
import { redirect } from "next/navigation";
import { buildRecommendations, type RecommendationsPayload } from "@/lib/recommendations";
import DescobrirClient from "./DescobrirClient";

export const dynamic = "force-dynamic";

export default async function DescobrirPage() {
  const { userId } = await auth();
  if (!userId) redirect("/sign-in");

  let result: RecommendationsPayload | null = null;
  try {
    result = await buildRecommendations(userId);
  } catch (error) {
    console.error("[DescobrirPage] buildRecommendations error:", error);
  }

  if (!result) {
    return <DescobrirClient books={[]} recommendations={null} />;
  }

  return <DescobrirClient books={result.books} recommendations={result} />;
}
