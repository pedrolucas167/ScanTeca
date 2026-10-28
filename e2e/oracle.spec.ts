import { expect, test, type Page } from "@playwright/test";
import { clerk } from "@clerk/testing/playwright";

// These cases control API responses; service-worker activation must not reload
// the document in the middle of a draft or bypass Playwright's request routes.
test.use({ serviceWorkers: "block" });

const answer = "Uma conexão entre memória e cidade, a partir dos livros do seu acervo.";
const sources = [{ id: "oracle-ui-fixture", title: "Livro de demonstração", author: "Autoria de teste", status: "TO_READ", genre: null }];
const stream = `data: ${JSON.stringify({ sources })}\n\ndata: ${JSON.stringify({ text: answer })}\n\ndata: [DONE]\n\n`;

async function bootstrap(page: Page, messages: { role: string; content: string }[] = []) {
  await page.route("**/api/vitals", route => route.fulfill({ status: 204 }));
  await page.route("**/api/oracle", async route => {
    if (route.request().method() === "GET") {
      await route.fulfill({ json: { messages, stats: { total: 5, indexed: 5 }, suggestions: ["Compare dois livros"] } });
    } else {
      await route.fallback();
    }
  });
}

async function openOracle(page: Page) {
  await page.goto("/oracle", { waitUntil: "domcontentloaded" });
  await clerk.loaded({ page });
}

test("chat reserva espaço às mensagens e mantém o compositor no viewport", async ({ page }) => {
  let sends = 0;
  await page.route("**/api/oracle", async route => {
    if (route.request().method() !== "POST") return route.fallback();
    sends++;
    await route.fulfill({ contentType: "text/event-stream", body: stream });
  });
  await bootstrap(page);
  await openOracle(page);
  const mobile = page.viewportSize()!.width < 768;
  const height = page.viewportSize()!.height;
  const main = page.getByRole("main", { name: "Conversa com o Oráculo" });
  const field = page.getByRole("textbox", { name: "Sua mensagem" });
  const settings = page.getByRole("button", { name: "Ajustes da conversa" });
  await expect(field).toBeVisible();
  await expect(page.getByRole("button", { name: "Compare dois livros", exact: true })).toBeVisible();
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  if (mobile) {
    await expect(page.locator("body > header")).toBeHidden();
    expect((await main.boundingBox())!.height).toBeGreaterThan(height * 0.65);
    expect((await page.getByRole("form", { name: "Mensagem para o Oráculo" }).boundingBox())!.y).toBeLessThan(height);
    for (const button of await page.locator("[data-oracle-chat] > header button, [data-oracle-chat] form button").all()) {
      const box = await button.boundingBox();
      expect(box!.height).toBeGreaterThanOrEqual(44);
      expect(box!.width).toBeGreaterThanOrEqual(44);
    }
  } else {
    await expect(page.locator("body > header")).toBeVisible();
  }
  await settings.click();
  await page.getByRole("button", { name: "Comparar", exact: true }).click();
  await page.keyboard.press("Escape");
  await expect(settings).toBeFocused();
  await expect(page.getByRole("region", { name: "Ajustes da conversa" })).toHaveCount(0);
  await field.fill("Primeira linha");
  if (mobile) {
    await field.press("Enter");
    await field.press("End");
    await field.type("Segunda linha");
    expect(sends).toBe(0);
    await expect(field).toHaveValue("Primeira linha\nSegunda linha");
    await page.setViewportSize({ width: page.viewportSize()!.width, height: 430 });
    await expect(page.locator("[data-oracle-chat]")).toHaveAttribute("data-keyboard-open", "true");
    const send = await page.getByRole("button", { name: "Enviar mensagem" }).boundingBox();
    expect(send!.y + send!.height).toBeLessThanOrEqual(430);
    expect(await field.evaluate(element => Number.parseFloat(getComputedStyle(element).fontSize))).toBeGreaterThanOrEqual(16);
    await page.setViewportSize({ width: page.viewportSize()!.width, height });
    await expect(page.locator("[data-oracle-chat]")).toHaveAttribute("data-keyboard-open", "false");
  }
  await page.getByRole("button", { name: "Enviar mensagem" }).click();
  await expect(main.getByText(answer, { exact: true })).toBeVisible();
  expect(sends).toBe(1);
  await expect(page.getByRole("heading", { name: "Que conexão vamos descobrir?" })).toHaveCount(0);
  const sourceDisclosure = main.locator("details").filter({ has: page.locator("summary", { hasText: "Fontes usadas" }) });
  await expect(sourceDisclosure).not.toHaveAttribute("open", "");
  await sourceDisclosure.locator("summary").click();
  await expect(main.getByRole("heading", { name: "Livro de demonstração" })).toBeVisible();
  if (mobile) {
    await page.getByRole("link", { name: "Voltar ao catálogo" }).click();
    await expect(page.locator("[data-oracle-chat]")).toHaveCount(0);
    await expect(page.locator("body > header")).toBeVisible();
    expect(await page.evaluate(() => getComputedStyle(document.body).overflow)).not.toBe("hidden");
  }
});

test("resposta nova respeita quem está lendo acima e permite voltar ao fim", async ({ page }) => {
  let release!: () => void;
  const waiting = new Promise<void>(resolve => { release = resolve; });
  await page.route("**/api/oracle", async route => {
    if (route.request().method() !== "POST") return route.fallback();
    await waiting;
    await route.fulfill({ contentType: "text/event-stream", body: stream });
  });
  await bootstrap(page, Array.from({ length: 12 }, (_, index) => ({
    role: "assistant", content: `Resposta anterior ${index + 1}.\n\n${"Uma reflexão sobre livros e memória. ".repeat(18)}`,
  })));
  await openOracle(page);
  const main = page.getByRole("main", { name: "Conversa com o Oráculo" });
  await expect(page.getByText("Resposta anterior 12.", { exact: true })).toBeVisible();
  await page.getByRole("textbox", { name: "Sua mensagem" }).fill("Continue a conversa");
  await page.getByRole("button", { name: "Enviar mensagem" }).click();
  await expect(page.getByRole("button", { name: "Parar geração" })).toBeVisible();
  await main.evaluate(element => { element.scrollTop = 0; });
  const jump = page.getByRole("button", { name: "Voltar ao fim da conversa" });
  await expect(jump).toBeVisible();
  release();
  await expect(main.getByText(answer, { exact: true })).toBeAttached();
  await expect(page.getByRole("button", { name: "Enviar mensagem" })).toBeVisible();
  expect(await main.evaluate(element => element.scrollTop)).toBeLessThan(50);
  await jump.click();
  await expect(main.getByText(answer, { exact: true })).toBeVisible();
  await expect(jump).toHaveCount(0);
});

test("falha de envio mantém a pergunta e permite tentar novamente", async ({ page }) => {
  let attempts = 0;
  await page.route("**/api/oracle", async route => {
    if (route.request().method() !== "POST") return route.fallback();
    attempts++;
    await route.fulfill(attempts === 1
      ? { status: 503, json: { error: "Falha de teste no envio" } }
      : { contentType: "text/event-stream", body: stream });
  });
  await bootstrap(page);
  await openOracle(page);
  await expect(page.getByRole("button", { name: "Compare dois livros", exact: true })).toBeVisible();
  await page.getByRole("textbox", { name: "Sua mensagem" }).fill("Uma pergunta preservada");
  await page.getByRole("button", { name: "Enviar mensagem" }).click();
  await expect(page.getByText("Falha de teste no envio", { exact: true })).toBeVisible();
  await expect(page.getByText("Uma pergunta preservada", { exact: true })).toBeVisible();
  await page.getByRole("button", { name: "Tentar novamente", exact: true }).click();
  await expect(page.getByText(answer, { exact: true })).toBeVisible();
  expect(attempts).toBe(2);
});
