"use client";

export default function AppError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  console.error("AppError caught:", error);
  console.error("Error message:", error.message);
  console.error("Error stack:", error.stack);
  console.error("Error digest:", error.digest);

  return (
    <main className="mx-auto flex min-h-[60vh] max-w-lg flex-col items-center justify-center px-4 text-center">
      <h1 className="font-serif text-2xl font-semibold text-foreground">Não foi possível carregar esta tela</h1>
      <p className="mt-2 text-sm text-zinc-500 dark:text-zinc-400">Ocorreu uma falha temporária. Tente novamente em instantes.</p>
      <button onClick={reset} className="mt-5 rounded-full bg-indigo-600 px-5 py-2.5 text-sm font-semibold text-white hover:bg-indigo-700">Tentar novamente</button>
    </main>
  );
}
