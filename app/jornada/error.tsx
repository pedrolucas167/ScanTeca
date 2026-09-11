"use client";

export default function JornadaError({ reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return <main className="mx-auto flex min-h-[60vh] max-w-lg flex-col items-center justify-center px-4 text-center"><h1 className="font-serif text-2xl font-semibold text-foreground">Não foi possível carregar sua Jornada</h1><p className="mt-2 text-sm text-zinc-500 dark:text-zinc-400">A conexão pode ter oscilado. Seus dados permanecem seguros.</p><button onClick={reset} className="mt-5 rounded-full bg-indigo-600 px-5 py-2.5 text-sm font-semibold text-white hover:bg-indigo-700">Tentar novamente</button></main>;
}
