import { notFound } from "next/navigation";
import { isAdmin } from "@/lib/admin";
import { prisma } from "@/lib/prisma";
import BroadcastForm from "./BroadcastForm";

export const dynamic = "force-dynamic";

export default async function AdminPage() {
  if (!(await isAdmin())) notFound();

  const subscribers = await prisma.pushSubscription.count();

  return (
    <main className="mx-auto w-full max-w-2xl px-4 py-10">
      <h1 className="text-2xl font-bold text-foreground">Administração</h1>
      <p className="mt-1 text-sm text-zinc-500 dark:text-zinc-400">
        Dispare notificações push para os usuários inscritos.
      </p>

      <div className="mt-6 rounded-xl border border-zinc-200 bg-white p-5 dark:border-zinc-800 dark:bg-zinc-900">
        <p className="text-sm text-zinc-600 dark:text-zinc-400">
          <span className="text-lg font-bold text-foreground">{subscribers}</span>{" "}
          {subscribers === 1 ? "dispositivo inscrito" : "dispositivos inscritos"}
        </p>
      </div>

      <BroadcastForm />
    </main>
  );
}
