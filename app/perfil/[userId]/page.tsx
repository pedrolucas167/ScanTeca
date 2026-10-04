import { auth } from "@clerk/nextjs/server";
import PublicProfileClient from "./PublicProfileClient";

export const dynamic = "force-dynamic";

export default async function PublicProfilePage({ params }: { params: Promise<{ userId: string }> }) {
  await auth();
  const { userId } = await params;
  return <PublicProfileClient userId={userId} />;
}
