export default function JornadaLoading() {
  return (
    <main className="mx-auto w-full max-w-6xl animate-pulse px-4 py-10" aria-busy="true" aria-label="Carregando jornada">
      <div className="mx-auto h-10 w-64 rounded-lg bg-zinc-200 dark:bg-zinc-800" />
      <div className="mx-auto mt-3 h-4 w-96 max-w-full rounded bg-zinc-100 dark:bg-zinc-900" />
      <div className="mt-10 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
        {Array.from({ length: 5 }).map((_, index) => <div key={index} className="h-28 rounded-xl bg-zinc-200 dark:bg-zinc-800" />)}
      </div>
      <div className="mt-6 h-40 rounded-xl bg-zinc-100 dark:bg-zinc-900" />
      <div className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {Array.from({ length: 3 }).map((_, index) => <div key={index} className="h-32 rounded-xl bg-zinc-200 dark:bg-zinc-800" />)}
      </div>
    </main>
  );
}
