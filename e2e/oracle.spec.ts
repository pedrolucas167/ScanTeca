import { expect, test, type Page } from "@playwright/test";
import { clerk } from "@clerk/testing/playwright";
import { createServer } from "node:http";
import type { Source } from "../lib/types/oracle";

// These cases control API responses; service-worker activation must not reload
// the document in the middle of a draft or bypass Playwright's request routes.
test.use({ serviceWorkers: "block" });

const answer = "Uma conexão entre memória e cidade, a partir dos livros do seu acervo.";
const sources = [{ id: "oracle-ui-fixture", title: "Livro de demonstração", author: "Autoria de teste", status: "TO_READ", genre: null }];
const stream = `data: ${JSON.stringify({ sources })}\n\ndata: ${JSON.stringify({ text: answer })}\n\ndata: [DONE]\n\n`;

async function bootstrap(page: Page, messages: { role: string; content: string; sources?: Source[] }[] = []) {
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

test("andamento chega antes da resposta e permite acompanhar a busca", async ({ page }) => {
  const gate = Promise.withResolvers<void>();
  const fixture = createServer(async (request, response) => {
    response.setHeader("Access-Control-Allow-Origin", "*");
    response.setHeader("Access-Control-Allow-Headers", "content-type");
    response.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
    if (request.method === "OPTIONS") { response.writeHead(204).end(); return; }
    response.writeHead(200, { "Content-Type": "text/event-stream", "Cache-Control": "no-cache" });
    response.write('data: {"stage":"search"}\n\n');
    await gate.promise;
    if (!response.destroyed) response.end(stream);
  });
  await new Promise<void>(resolve => fixture.listen(0, "127.0.0.1", resolve));
  const address = fixture.address();
  if (!address || typeof address === "string") throw new Error("Fixture local não iniciou.");
  try {
    await page.route("**/api/oracle", async route => {
      if (route.request().method() !== "POST") return route.fallback();
      await route.continue({ url: `http://127.0.0.1:${address.port}/api/oracle` });
    });
    await bootstrap(page);
    await openOracle(page);
    await page.getByRole("textbox", { name: "Sua mensagem" }).fill("Encontre uma conexão entre memória e cidade");
    await page.getByRole("button", { name: "Enviar mensagem" }).click();
    await expect(page.getByRole("status", { name: "Andamento da consulta" })).toContainText("Buscando livros na sua estante...");
    await expect(page.getByText(answer, { exact: true })).toHaveCount(0);
    await expect(page.getByRole("button", { name: "Parar geração" })).toBeVisible();
    gate.resolve();
    await expect(page.getByRole("main", { name: "Conversa com o Oráculo" }).getByText(answer, { exact: true })).toBeVisible();
  } finally {
    gate.resolve();
    fixture.closeAllConnections();
    await new Promise<void>((resolve, reject) => fixture.close(error => error ? reject(error) : resolve()));
  }
});

test("memória do leitor permite corrigir, pausar e apagar preferências", async ({ page }) => {
  let memory: { oracleProfile: string | null; oracleMemoryEnabled: boolean; oracleProfileVersion: number } = {
    oracleProfile: "Prefiro poesia", oracleMemoryEnabled: true, oracleProfileVersion: 2,
  };
  await bootstrap(page);
  await page.route("**/api/library-settings", async route => {
    if (route.request().method() === "POST") {
      const body = route.request().postDataJSON();
      expect(body.oracleProfileVersion).toBe(memory.oracleProfileVersion);
      memory = { ...body, oracleProfileVersion: memory.oracleProfileVersion + 1 };
    }
    await route.fulfill({ json: { setting: memory } });
  });
  await openOracle(page);
  const settings = page.getByRole("button", { name: "Ajustes da conversa" });
  await settings.click();
  await page.getByRole("button", { name: "Minha memória" }).click();
  const dialog = page.getByRole("dialog", { name: "Memória do leitor" });
  const field = dialog.getByRole("textbox", { name: "Preferências e objetivos" });
  await expect(field).toHaveValue("Prefiro poesia");
  await field.fill("Prefiro contos curtos");
  await dialog.getByRole("checkbox", { name: "Aprender com as próximas conversas" }).uncheck();
  await dialog.getByRole("button", { name: "Salvar memória" }).click();
  await expect(dialog.getByRole("status")).toHaveText("Memória salva.");
  await page.keyboard.press("Escape");
  await expect(dialog).toHaveCount(0);
  await expect(settings).toBeFocused();
  await settings.click();
  await page.getByRole("button", { name: "Minha memória" }).click();
  await expect(field).toHaveValue("Prefiro contos curtos");
  expect(await dialog.evaluate(element => element.scrollWidth <= element.clientWidth)).toBe(true);
  await dialog.getByRole("button", { name: "Apagar memória e pausar" }).click();
  await expect(dialog.getByRole("status")).toHaveText("Memória apagada. Aprendizado pausado.");
  await expect(field).toHaveValue("");
  await expect(dialog.getByRole("checkbox")).not.toBeChecked();
});

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

test("fontes longas ficam inteiras dentro da conversa em telas pequenas", async ({ page }) => {
  const title = "The De Monarchia of Dante Alighieri — a critical edition with historical commentary and introduction";
  const evidence = `A Latin treatise on secular and religious power by Dante Alighieri. ${"TrechoSemEspacos".repeat(24)}`;
  const longSources: Source[] = [
    { id: "source-primary", title, author: "Dante Alighieri", status: "READ", relevance: 79.95, matchedBy: "similaridade semântica", evidence },
    { id: "source-external", title: `Catálogo externo: ${title}`, author: "AutoriaSemEspacos".repeat(10), external: true, evidence },
    { id: "source-diary", title: `Diário: ${title}`, author: "Dante Alighieri", sourceType: "diary", evidence },
    { id: "source-review", title: `Avaliação: ${title}`, author: "Dante Alighieri", sourceType: "review", evidence },
  ];
  await bootstrap(page, [{ role: "assistant", content: "Estas são as fontes usadas na resposta.", sources: longSources }]);
  await openOracle(page);
  const main = page.getByRole("main", { name: "Conversa com o Oráculo" });
  const disclosure = main.locator("details").filter({ has: page.locator("summary", { hasText: "Fontes usadas" }) });
  await disclosure.locator(":scope > summary").click();
  const primary = disclosure.getByRole("heading", { name: title, exact: true });

  const checkBounds = async () => {
    expect(await main.evaluate(element => element.scrollWidth - element.clientWidth)).toBeLessThanOrEqual(1);
    const bounds = await main.boundingBox();
    for (const heading of await disclosure.getByRole("heading").all()) {
      const card = heading.locator("xpath=ancestor::div[contains(concat(' ', normalize-space(@class), ' '), ' relative ')][1]");
      const box = await card.boundingBox();
      expect(box!.x).toBeGreaterThanOrEqual(bounds!.x);
      expect(box!.x + box!.width).toBeLessThanOrEqual(bounds!.x + bounds!.width + 1);
      expect(await card.evaluate(element => element.scrollWidth - element.clientWidth)).toBeLessThanOrEqual(1);
      expect(await heading.evaluate(element => ({
        whiteSpace: getComputedStyle(element).whiteSpace,
        overflow: element.scrollWidth - element.clientWidth,
      }))).toEqual({ whiteSpace: "normal", overflow: 0 });
    }
  };

  for (const width of [320, 375, 390, 430, 768, 1440]) {
    await page.setViewportSize({ width, height: 900 });
    await checkBounds();
  }
  await page.setViewportSize({ width: 375, height: 900 });
  await page.addStyleTag({ content: "html { font-size: 20px; }" });
  await checkBounds();
  const card = primary.locator("xpath=ancestor::div[contains(concat(' ', normalize-space(@class), ' '), ' relative ')][1]");
  await card.locator("details > summary").click();
  await expect(card.getByText("Ocultar evidência", { exact: true })).toBeVisible();
  await checkBounds();
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

test("segunda falha após aceitar a pergunta mantém a opção de tentar novamente", async ({ page }) => {
  const requests: { regenerate?: boolean; sessionId?: string }[] = [];
  const acceptedSession = "cm123456789012345678901234";
  await page.route("**/api/oracle", async route => {
    if (route.request().method() !== "POST") return route.fallback();
    requests.push(route.request().postDataJSON());
    if (requests.length === 1) {
      await route.fulfill({ contentType: "text/event-stream", body:
        `data: ${JSON.stringify({ sessionId: acceptedSession })}\n\ndata: ${JSON.stringify({ error: "Falha após receber a pergunta" })}\n\n` });
    } else if (requests.length === 2) {
      await route.fulfill({ status: 503, json: { error: "Segunda falha temporária" } });
    } else {
      await route.fulfill({ contentType: "text/event-stream", body: stream });
    }
  });
  await bootstrap(page);
  await openOracle(page);
  await page.getByRole("textbox", { name: "Sua mensagem" }).fill("Pergunta confirmada que deve ser preservada");
  await page.getByRole("button", { name: "Enviar mensagem" }).click();
  const retry = page.getByRole("button", { name: "Tentar novamente", exact: true });
  await expect(retry).toBeVisible();
  await retry.click();
  await expect.poll(() => requests.length).toBe(2);
  await expect(page.getByRole("button", { name: "Parar geração" })).toHaveCount(0);
  await expect(retry).toBeVisible();
  await retry.click();
  await expect(page.getByText(answer, { exact: true })).toBeVisible();
  await expect(page.getByText("Pergunta confirmada que deve ser preservada", { exact: true })).toHaveCount(1);
  await expect(retry).toHaveCount(0);
  expect(requests).toHaveLength(3);
  expect(requests.slice(1)).toEqual([
    expect.objectContaining({ regenerate: true, sessionId: acceptedSession }),
    expect.objectContaining({ regenerate: true, sessionId: acceptedSession }),
  ]);
});
