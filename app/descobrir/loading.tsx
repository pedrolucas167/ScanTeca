export default function DescobrirLoading() {
  return (
    <main className="mx-auto w-full max-w-2xl px-4 py-6" aria-busy="true" aria-label="Carregando recomendações">
      <p className="text-sm text-zinc-600 dark:text-zinc-400" role="status">Preparando suas recomendações…</p>
      <div className="mt-6 animate-pulse" aria-hidden="true">
        <div className="h-72 rounded-xl bg-zinc-200 dark:bg-zinc-800" />
        <div className="mt-6 h-6 w-48 rounded bg-zinc-200 dark:bg-zinc-800" />
        <div className="mt-4 grid grid-cols-3 gap-4">
          {[0, 1, 2].map((id) => <div key={id} className="h-40 rounded-lg bg-zinc-100 dark:bg-zinc-900" />)}
        </div>
      </div>
    </main>
  );
}
