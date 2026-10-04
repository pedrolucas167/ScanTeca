import { auth } from "@clerk/nextjs/server";
import ReadersClient from "./ReadersClient";

export const dynamic = "force-dynamic";

export default async function ReadersPage() {
  await auth();
  return <ReadersClient />;
}
