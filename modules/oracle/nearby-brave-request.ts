import { get } from "node:https";

// Use the Node HTTPS client so Next/Vercel fetch tracing does not record the
// outbound query string, which contains the device coordinates.
export function requestNearbyPlaces(endpoint: URL, key: string, requestSignal: AbortSignal): Promise<unknown> {
  const signal = AbortSignal.any([requestSignal, AbortSignal.timeout(8000)]);
  return new Promise((resolve, reject) => {
    const fail = () => reject(new Error("Busca de lugares indisponível"));
    const request = get(endpoint, { signal, headers: { Accept: "application/json", "X-Subscription-Token": key } }, response => {
      response.on("error", fail);
      response.on("aborted", fail);
      if (response.statusCode !== 200) {
        response.resume();
        fail();
        return;
      }
      let body = "";
      response.setEncoding("utf8");
      response.on("data", (chunk: string) => {
        body += chunk;
        if (body.length > 1_000_000) {
          response.destroy();
          fail();
        }
      });
      response.on("end", () => {
        try { resolve(JSON.parse(body)); } catch { fail(); }
      });
    });
    request.on("error", fail);
  });
}
