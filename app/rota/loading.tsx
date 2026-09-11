export default function RouteLoading() {
  return (
    <main className="mx-auto w-full max-w-5xl animate-pulse px-4 py-8" aria-busy="true" aria-label="Carregando rota na estante">
      <div className="h-10 w-64 rounded-lg bg-surface-container-high" />
      <div className="mt-3 h-4 w-96 max-w-full rounded bg-surface-container" />
      <div className="mt-8 h-14 rounded-full bg-surface-container" />
      <div className="mt-5 space-y-3">
        {Array.from({ length: 4 }).map((_, index) => <div key={index} className="h-28 rounded-2xl bg-surface-container-low" />)}
      </div>
    </main>
  );
}
