import { auth } from "@clerk/nextjs/server";
import { getCatalog } from "@/modules/library";
import Catalog from "./Catalog";
import LandingPage from "./LandingPage";
import { measureServerTask } from "@/lib/server-timing";

export const dynamic = "force-dynamic";

export default async function Home() {
  const { userId } = await measureServerTask("page.auth", () => auth());

  if (!userId) {
    return <LandingPage />;
  }

  const { books: bookList, setting } = await getCatalog(userId);

  return (
    <Catalog
      books={bookList}
      libraryName={setting.name}
      shareEnabled={setting.shareEnabled}
      shareId={setting.shareId}
    />
  );
}
