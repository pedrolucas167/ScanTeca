export default function CatalogLoading() {
  return (
    <main className="mx-auto w-full max-w-6xl animate-pulse px-4 py-8" aria-busy="true" aria-label="Carregando catálogo">
      <div className="h-9 w-56 rounded-lg bg-zinc-200 dark:bg-zinc-800" />
      <div className="mt-3 h-4 w-80 max-w-full rounded bg-zinc-100 dark:bg-zinc-900" />
      <div className="mt-8 grid grid-cols-2 gap-4 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6">
        {Array.from({ length: 12 }).map((_, index) => (
          <div key={index}>
            <div className="aspect-[2/3] rounded-xl bg-zinc-200 dark:bg-zinc-800" />
            <div className="mt-3 h-4 rounded bg-zinc-200 dark:bg-zinc-800" />
            <div className="mt-2 h-3 w-2/3 rounded bg-zinc-100 dark:bg-zinc-900" />
          </div>
        ))}
      </div>
    </main>
  );
}
