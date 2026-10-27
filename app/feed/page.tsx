import { auth } from "@clerk/nextjs/server";
import FeedClient from "./FeedClient";
import FeedSignInPrompt from "./FeedSignInPrompt";

export const dynamic = "force-dynamic";

export default async function FeedPage() {
  const { userId } = await auth();
  if (!userId) return <FeedSignInPrompt />;
  return <FeedClient />;
}
