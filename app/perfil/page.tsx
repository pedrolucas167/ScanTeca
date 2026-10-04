import { auth } from "@clerk/nextjs/server";
import ProfileClient from "./ProfileClient";

export const dynamic = "force-dynamic";

export default async function ProfilePage() {
  await auth();
  return <ProfileClient />;
}
