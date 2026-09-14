import { notFound } from "next/navigation";
import { isAdmin } from "@/lib/admin";
import { prisma } from "@/lib/prisma";
import BroadcastForm from "./BroadcastForm";

export const dynamic = "force-dynamic";

export default async function AdminPage() {
  if (!(await isAdmin())) notFound();

  const [subscribers, history] = await Promise.all([
    prisma.pushSubscription.count(),
    prisma.broadcastLog.findMany({
      orderBy: { createdAt: "desc" },
      take: 20,
    }),
  ]);

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

      <section className="mt-6 rounded-xl border border-zinc-200 bg-white p-5 dark:border-zinc-800 dark:bg-zinc-900">
        <h2 className="text-sm font-semibold uppercase tracking-wider text-indigo-600 dark:text-indigo-400">
          Histórico de envios
        </h2>
        {history.length === 0 ? (
          <p className="mt-4 text-sm text-zinc-500 dark:text-zinc-400">
            Nenhum broadcast enviado ainda.
          </p>
        ) : (
          <ul className="mt-4 divide-y divide-zinc-100 dark:divide-zinc-800">
            {history.map((log) => (
              <li key={log.id} className="py-3">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="truncate text-sm font-medium text-foreground">
                      {log.title}
                      {log.test && (
                        <span className="ml-2 rounded-full bg-amber-100 px-2 py-0.5 text-[10px] font-semibold uppercase text-amber-700 dark:bg-amber-950/50 dark:text-amber-400">
                          teste
                        </span>
                      )}
                    </p>
                    <p className="mt-0.5 line-clamp-2 text-xs text-zinc-500 dark:text-zinc-400">
                      {log.body}
                    </p>
                    <p className="mt-1 text-xs text-zinc-400 dark:text-zinc-500">
                      {new Date(log.createdAt).toLocaleString("pt-BR")}
                    </p>
                  </div>
                  <div className="shrink-0 text-right text-xs">
                    <p className="font-medium text-emerald-600 dark:text-emerald-400">
                      {log.sent} enviado{log.sent === 1 ? "" : "s"}
                    </p>
                    {log.failed > 0 && (
                      <p className="text-red-500">{log.failed} falha{log.failed === 1 ? "" : "s"}</p>
                    )}
                    {log.removed > 0 && (
                      <p className="text-zinc-400">{log.removed} removido{log.removed === 1 ? "" : "s"}</p>
                    )}
                  </div>
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>
    </main>
  );
}
