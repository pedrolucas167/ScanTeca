import { auth, clerkClient } from "@clerk/nextjs/server";

/**
 * Admin é definido pela role no Clerk: publicMetadata.role === "admin".
 * Lê o usuário via Backend API — não depende de customizar o session token.
 */
export async function isAdmin(): Promise<boolean> {
  const { userId } = await auth();
  if (!userId) return false;
  try {
    const client = await clerkClient();
    const user = await client.users.getUser(userId);
    return user.publicMetadata?.role === "admin";
  } catch {
    return false;
  }
}
