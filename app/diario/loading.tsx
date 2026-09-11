export default function DiaryLoading() {
  return (
    <main className="mx-auto w-full max-w-5xl animate-pulse space-y-5 px-4 py-5" aria-busy="true" aria-label="Carregando diário">
      <div className="h-9 w-52 rounded-lg bg-surface-container-high" />
      <div className="h-64 rounded-2xl bg-surface-container" />
      <div className="h-52 rounded-2xl bg-surface-container-low" />
      <div className="grid grid-cols-3 gap-2">
        {Array.from({ length: 3 }).map((_, index) => <div key={index} className="h-24 rounded-xl bg-surface-container" />)}
      </div>
      <div className="h-36 rounded-2xl bg-surface-container-low" />
    </main>
  );
}
