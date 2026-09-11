import { auth } from "@clerk/nextjs/server";
import { redirect } from "next/navigation";
import { getRouteData } from "@/lib/route-data";
import RotaNaEstante from "./RotaNaEstante";

export const metadata = {
  title: "Rota na Estante — Scanteca",
  description: "Roteiro de resgate físico dos livros encontrados pelo Oráculo.",
};

export default async function RotaPage({ searchParams }: { searchParams: Promise<{ books?: string }> }) {
  const { userId } = await auth();
  if (!userId) redirect("/sign-in");
  const { books } = await searchParams;
  const requestedIds = (books ?? "").split(",").map((id) => id.trim()).filter(Boolean).slice(0, 8);
  const data = await getRouteData(userId, requestedIds);
  return <RotaNaEstante initialData={data} />;
}
