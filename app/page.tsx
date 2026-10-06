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

  // TEMPORARY: Test without Catalog component
  return (
    <div className="p-8">
      <h1 className="text-2xl font-bold">Home - Teste sem Catalog</h1>
      <p>Se você está vendo isso, o middleware funcionou e a página carregou sem o componente Catalog.</p>
    </div>
  );
}
