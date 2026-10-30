import { auth } from "@clerk/nextjs/server";
import { redirect } from "next/navigation";
import type { RecommendationsPayload } from "@/lib/recommendations";
import { getRecommendations } from "@/lib/recommendations-service";
import DescobrirClient from "./DescobrirClient";

export const dynamic = "force-dynamic";

export default async function DescobrirPage() {
  const { userId } = await auth();
  if (!userId) redirect("/sign-in");

  let result: RecommendationsPayload | null = null;
  try {
    result = (await getRecommendations(userId)).data;
  } catch (error) {
    console.error("[DescobrirPage] getRecommendations error:", error);
  }

  if (!result) {
    return <DescobrirClient books={[]} recommendations={null} />;
  }

  return <DescobrirClient books={result.books} recommendations={result} />;
}
