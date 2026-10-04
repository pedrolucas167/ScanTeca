import { auth } from "@clerk/nextjs/server";
import FeedClient from "./FeedClient";

export const dynamic = "force-dynamic";

export default async function FeedPage() {
  await auth();
  return <FeedClient />;
}
