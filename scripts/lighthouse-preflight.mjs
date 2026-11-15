import { expect } from "@playwright/test";

const pages = new Map([["/", "Sua estante de livros físicos"], ["/manifesto", "O Fim do Caos Literário"]]);
export class LighthousePreflightError extends Error {
  constructor(reason, route, status = null) {
    super(`Lighthouse preflight: ${reason}`);
    this.diagnostic = { reason, route, status };
  }
}

/** Only expected routes and coarse failure codes may leave the isolated runner. */
export async function checkPublicPage(page, base, route, timeout = 15000) {
  if (!pages.has(route)) throw new Error("Unsupported preflight route");
  const target = new URL(route, base).href;
  let response;
  try { response = await page.goto(target, { waitUntil: "domcontentloaded", timeout: 30000 }); }
  catch (error) { throw new LighthousePreflightError(error?.name === "TimeoutError" ? "navigation-timeout" : "navigation-failed", route); }
  const status = response?.status() ?? null;
  if (status !== 200) throw new LighthousePreflightError("http-status", route, status);
  if (page.url() !== target) throw new LighthousePreflightError("unexpected-destination", route, status);
  try {
    const heading = page.locator("h1");
    await expect(heading).toHaveCount(1, { timeout });
    await expect(heading).toContainText(pages.get(route), { timeout });
    await expect(heading).toBeVisible({ timeout });
  } catch { throw new LighthousePreflightError("heading-not-ready-or-invalid", route, status); }
  if (page.url() !== target) throw new LighthousePreflightError("unexpected-destination", route, status);
  return { route, status, headingVerified: true };
}
