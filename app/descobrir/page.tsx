import { auth } from "@clerk/nextjs/server";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import DescobrirClient from "./DescobrirClient";

export const dynamic = "force-dynamic";

export default async function DescobrirPage() {
  const { userId } = await auth();
  if (!userId) redirect("/sign-in");

  const books = await prisma.book.findMany({
    where: { userId },
    orderBy: { updatedAt: "desc" },
    select: {
      id: true,
      title: true,
      author: true,
      coverUrl: true,
      genre: true,
      pages: true,
      status: true,
      synopsis: true,
      createdAt: true,
    },
  });

  return <DescobrirClient books={books} />;
}
