import { auth } from "@clerk/nextjs/server";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import Catalog from "./Catalog";

export const dynamic = "force-dynamic";

export default async function Home() {
  const { userId } = await auth();

  if (!userId) {
    redirect("/sign-in");
  }

  const [books, setting] = await Promise.all([
    prisma.book.findMany({
      where: { userId },
      orderBy: { createdAt: "desc" },
    }),
    prisma.librarySetting.upsert({
      where: { userId },
      update: {},
      create: {
        userId,
        name: "Minha Biblioteca",
      },
    }),
  ]);

  return <Catalog books={books} libraryName={setting.name} />;
}
