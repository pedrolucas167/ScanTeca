// Preload exclusivo do servidor iniciado pelo Playwright. Não é importado pelo app.
const originalFetch = globalThis.fetch;
globalThis.fetch = async (input, init) => {
  const url = new URL(typeof input === "string" ? input : input instanceof URL ? input.href : input.url);
  const metadata = (url.hostname === "www.googleapis.com" && url.pathname.startsWith("/books/"))
    || url.hostname === "openlibrary.org"
    || ((url.hostname === "pt.wikipedia.org" || url.hostname === "en.wikipedia.org") && url.pathname === "/w/api.php");
  if (metadata) return Response.json({ items: [], totalItems: 0, docs: [], query: { pages: {} } });
  return originalFetch(input, init);
};
