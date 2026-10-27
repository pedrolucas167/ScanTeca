export const productionOrigin = "https://scanteca.vercel.app";
export const publicRoutes = ["/", "/feed", "/manifest.json", "/favicon.svg"];

export function checkPublicResponse(route, { status, body }) {
  if (!publicRoutes.includes(route)) throw new Error("Rota fora da lista pública permitida.");
  if (status !== 200) throw new Error(`Resposta HTTP ${status}.`);
  if (route === "/manifest.json") {
    const manifest = JSON.parse(body);
    if (manifest.name !== "Scanteca" || manifest.start_url !== "/" || manifest.display !== "standalone") throw new Error("Manifesto público inesperado.");
  } else if (route === "/favicon.svg") {
    if (!body.includes("<svg")) throw new Error("Ícone SVG ausente.");
  } else if (!body.includes("<html") || !body.includes("<title>Scanteca</title>")) throw new Error("HTML público inesperado.");
}
