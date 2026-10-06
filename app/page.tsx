import { auth } from "@clerk/nextjs/server";
import { prisma } from "@/lib/prisma";
import Catalog from "./Catalog";
import LandingPage from "./LandingPage";

export const dynamic = "force-dynamic";

export default async function Home() {
  console.log("Home page rendering");
  const { userId } = await auth();

  if (!userId) {
    return <LandingPage />;
  }

  const [books, setting] = await Promise.all([
    prisma.book.findMany({
      where: { userId },
      orderBy: { createdAt: "desc" },
      include: { collection: { select: { name: true } } },
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

  const bookList = books.map((b) => ({ ...b, collection: b.collection.name }));

  console.log("Home: rendering Catalog with", bookList.length, "books");

  // Test with empty books array first
  return (
    <Catalog
      books={[]}
      libraryName={setting.name}
      shareEnabled={setting.shareEnabled}
      shareId={setting.shareId}
    />
  );
}
