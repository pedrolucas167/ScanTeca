import { auth } from "@clerk/nextjs/server";
import { redirect } from "next/navigation";
import NotificationSettings from "./NotificationSettings";
import PrivacySettings from "./PrivacySettings";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

export default async function SettingsPage() {
  const { userId } = await auth();
  if (!userId) redirect("/sign-in");
  const preference = await prisma.privacyPreference.findUnique({ where: { userId }, select: { city: true } });

  return (
    <main className="mx-auto w-full max-w-2xl px-4 py-10">
      <h1 className="text-2xl font-bold text-foreground">Configurações</h1>
      <p className="mt-1 text-sm text-zinc-500 dark:text-zinc-400">
        Gerencie sua privacidade, notificações e dispositivos inscritos.
      </p>
      <PrivacySettings initialCity={preference?.city ?? ""} />
      <NotificationSettings />
    </main>
  );
}
