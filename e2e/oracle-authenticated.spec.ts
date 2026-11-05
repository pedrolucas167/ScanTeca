import { clerkSetup } from "@clerk/testing/playwright";
import type { Page } from "@playwright/test";
import { expect, signInAs, test } from "./fixtures";

test.beforeAll(async () => { await clerkSetup(); });

const answer = (attempt: number) => `A obra recuperada aborda memória e cidade, conforme a sinopse fornecida [1]. Resposta de teste ${attempt}.`;
type Message = { role: string; content: string; sources: { id: string }[] };
type Session = { id: string; title: string; messages: Message[] };

async function seedBook(page: Page) {
  const response = await page.request.post("/api/books", { data: {
    title: "Memórias da cidade", author: "Autora fictícia", pages: 120,
    status: "TO_READ", synopsis: "Contos sobre memória e cidade.", coverUrl: "/favicon.svg",
  } });
  expect(response.status()).toBe(201);
  return (await response.json()).book.id as string;
}

async function send(page: Page, question: string) {
  await page.getByRole("textbox", { name: "Sua mensagem" }).fill(question);
  await page.getByRole("button", { name: "Enviar mensagem", exact: true }).click();
}

async function currentSession(page: Page): Promise<Session> {
  const listing = await page.request.get("/api/oracle/sessions");
  expect(listing.status()).toBe(200);
  const sessions = (await listing.json()).sessions;
  expect(sessions).toHaveLength(1);
  const detail = await page.request.get(`/api/oracle/sessions/${sessions[0].id}`);
  expect(detail.status()).toBe(200);
  return (await detail.json()).session;
}

async function openMemory(page: Page) {
  await page.getByRole("button", { name: "Ajustes da conversa" }).click();
  await page.getByRole("button", { name: "Minha memória" }).click();
  const dialog = page.getByRole("dialog", { name: "Memória do leitor" });
  await expect(dialog.getByRole("textbox")).toBeEnabled();
  return dialog;
}

test("Oráculo autenticado persiste fontes, regenera e preserva artefato ao excluir conversa", async ({ page, identity }) => {
  await signInAs(page, identity);
  const bookId = await seedBook(page);
  await page.goto("/oracle");
  await send(page, `Compare os temas de "Memórias da cidade" ${crypto.randomUUID()}`);
  await expect(page.getByRole("button", { name: "Regenerar", exact: true })).toBeVisible();
  let session = await currentSession(page);
  expect(session.messages.map(message => message.role)).toEqual(["user", "assistant"]);
  expect(session.messages[1]?.content).toBe(answer(1));
  expect(session.messages[1]?.sources.map(source => source.id)).toContain(bookId);

  await page.getByRole("button", { name: "Regenerar", exact: true }).click();
  await expect(page.getByRole("main").getByText(/Resposta de teste 2\./)).toBeVisible();
  await expect(page.getByRole("button", { name: "Regenerar", exact: true })).toBeEnabled();
  session = await currentSession(page);
  expect(session.messages).toHaveLength(2);
  expect(session.messages[1]?.content).toBe(answer(2));
  const saved = page.waitForResponse(response => new URL(response.url()).pathname === "/api/oracle/artifacts" && response.request().method() === "POST");
  await page.getByRole("button", { name: "Salvar resultado", exact: true }).click();
  expect((await saved).status()).toBe(201);
  await page.reload();
  const home = await (await page.request.get("/api/oracle")).json();
  expect(home.artifacts).toHaveLength(1);
  expect(home.artifacts[0].content).toBe(answer(2));
  // Reload then reopen from the real persisted session list.
  await page.getByRole("button", { name: "Conversas salvas" }).click();
  await page.getByRole("button", { name: session.title, exact: true }).click();
  await expect(page.getByRole("main").getByText(/Resposta de teste 2\./)).toBeVisible();
  expect((await page.request.delete(`/api/oracle/sessions/${session.id}`)).status()).toBe(200);
  const artifacts = await (await page.request.get("/api/oracle/artifacts")).json();
  expect(artifacts.artifacts).toHaveLength(1);
  expect(artifacts.artifacts[0]).toMatchObject({ content: answer(2), sessionId: null });
});

test("Oráculo autenticado recupera duas falhas sem duplicar pergunta ou apagar resposta anterior", async ({ page, identity }) => {
  await signInAs(page, identity);
  await seedBook(page);
  await page.goto("/oracle");
  await send(page, `Compare os temas de "Memórias da cidade" ${crypto.randomUUID()}`);
  await expect(page.getByRole("button", { name: "Regenerar", exact: true })).toBeVisible();
  await send(page, `Compare "Memórias da cidade" [falha-dupla] ${crypto.randomUUID()}`);
  const retry = page.getByRole("button", { name: "Tentar novamente", exact: true });
  await expect(retry).toBeVisible();
  const failedAgain = page.waitForResponse(response => new URL(response.url()).pathname === "/api/oracle" && response.request().method() === "POST");
  await retry.click();
  await failedAgain;
  await expect(retry).toBeVisible();
  expect((await currentSession(page)).messages.map(message => message.role)).toEqual(["user", "assistant", "user"]);
  await retry.click();
  await expect(page.getByRole("main").getByText(/Resposta de teste 3\./)).toBeVisible();
  await expect(retry).toHaveCount(0);
  const session = await currentSession(page);
  expect(session.messages.map(message => message.role)).toEqual(["user", "assistant", "user", "assistant"]);
  expect(session.messages[1]?.content).toBe(answer(1));
  expect(session.messages[3]?.content).toBe(answer(3));
});

test("cancelamento autenticado não persiste resposta parcial", async ({ page, identity }) => {
  await signInAs(page, identity);
  await seedBook(page);
  await page.goto("/oracle");
  await send(page, `Compare "Memórias da cidade" [cancelar] ${crypto.randomUUID()}`);
  await expect(page.getByRole("status", { name: "Andamento da consulta" })).toContainText("Preparando a resposta");
  await page.getByRole("button", { name: "Parar geração" }).click();
  await expect(page.getByRole("button", { name: "Enviar mensagem", exact: true })).toBeVisible();
  // Wait beyond the provider's delayed completion to catch late saves after abort.
  expect((await currentSession(page)).messages.map(message => message.role)).toEqual(["user"]);
  await page.waitForTimeout(11000);
  expect((await currentSession(page)).messages.map(message => message.role)).toEqual(["user"]);
});

test("cancelar regeneração restaura resposta e fontes na tela e no histórico", async ({ page, identity }) => {
  await signInAs(page, identity);
  await seedBook(page);
  await page.goto("/oracle");
  await send(page, `Compare "Memórias da cidade" [cancelar-regeneracao] ${crypto.randomUUID()}`);
  const regenerate = page.getByRole("button", { name: "Regenerar", exact: true });
  await expect(regenerate).toBeVisible();
  const original = await currentSession(page);
  await regenerate.click();
  await expect(page.getByRole("status", { name: "Andamento da consulta" })).toContainText("Preparando a resposta");
  await page.getByRole("button", { name: "Parar geração" }).click();
  await expect(page.getByRole("main").getByText(/Resposta de teste 1\./)).toBeVisible();
  await expect(regenerate).toBeEnabled();
  expect((await currentSession(page)).messages).toEqual(original.messages);
  await page.waitForTimeout(11000);
  expect((await currentSession(page)).messages).toEqual(original.messages);
  await page.reload();
  await page.getByRole("button", { name: "Conversas salvas" }).click();
  await page.getByRole("button", { name: original.title, exact: true }).click();
  await expect(page.getByRole("main").getByText(/Resposta de teste 1\./)).toBeVisible();
});

test("memória autenticada preserva rascunho em conflito e persiste edição, pausa e exclusão", async ({ page, identity }) => {
  await signInAs(page, identity);
  await page.goto("/oracle");
  let dialog = await openMemory(page);
  const draft = "Prefiro contos curtos sobre cidades.";
  await dialog.getByRole("textbox").fill(draft);
  const setting = (await (await page.request.get("/api/library-settings")).json()).setting;
  const concurrent = await page.request.post("/api/library-settings", { data: {
    oracleProfile: "Prefiro poesia.", oracleProfileVersion: setting.oracleProfileVersion,
  } });
  expect(concurrent.status()).toBe(200);
  await dialog.getByRole("button", { name: "Salvar memória", exact: true }).click();
  await expect(dialog.getByRole("alert")).toContainText("rascunho foi preservado");
  await expect(dialog.getByRole("textbox")).toHaveValue(draft);
  await dialog.getByRole("button", { name: "Recarregar memória" }).click();
  await expect(dialog.getByRole("status")).toContainText("Versão atual carregada");
  await expect(dialog.getByRole("textbox")).toHaveValue(draft);
  await dialog.getByRole("checkbox").uncheck();
  await dialog.getByRole("button", { name: "Salvar memória", exact: true }).click();
  await expect(dialog.getByRole("status")).toHaveText("Memória salva.");
  await page.reload();
  dialog = await openMemory(page);
  await expect(dialog.getByRole("textbox")).toHaveValue(draft);
  await expect(dialog.getByRole("checkbox")).not.toBeChecked();
  await dialog.getByRole("button", { name: "Apagar memória e pausar" }).click();
  await expect(dialog.getByRole("status")).toHaveText("Memória apagada. Aprendizado pausado.");
  await page.reload();
  dialog = await openMemory(page);
  await expect(dialog.getByRole("textbox")).toHaveValue("");
  await expect(dialog.getByRole("checkbox")).not.toBeChecked();
});

test("segunda conta não acessa conversas, memória ou artefatos do dono", async ({ page, browser, baseURL, identity, identityFactory }) => {
  test.setTimeout(120000);
  await signInAs(page, identity);
  const bookId = await seedBook(page);
  await page.goto("/oracle");
  await send(page, `Compare os temas de "Memórias da cidade" ${crypto.randomUUID()}`);
  await expect(page.getByRole("button", { name: "Regenerar", exact: true })).toBeVisible();
  const session = await currentSession(page);
  const privateMemory = "Preferência privada: contos sobre cidades.";
  expect((await page.request.post("/api/library-settings", { data: { oracleProfile: privateMemory, oracleProfileVersion: 0 } })).status()).toBe(200);
  expect((await page.request.post("/api/oracle/artifacts", { data: { sessionId: session.id, type: "NOTE", title: "Nota privada", content: "Conteúdo privado do dono." } })).status()).toBe(201);
  const otherContext = await browser.newContext({ baseURL, serviceWorkers: "block" });
  try {
    const other = await otherContext.newPage();
    await signInAs(other, await identityFactory());
    for (const path of [`/api/oracle/sessions/${session.id}`, `/api/oracle?sessionId=${session.id}`]) {
      expect((await other.request.get(path)).status()).toBe(404);
    }
    expect((await other.request.patch(`/api/oracle/sessions/${session.id}`, { data: { title: "Invasão" } })).status()).toBe(404);
    expect((await other.request.delete(`/api/oracle/sessions/${session.id}`)).status()).toBe(404);
    expect((await other.request.post("/api/oracle", { data: { sessionId: session.id, question: "Compare os livros privados" } })).status()).toBe(404);
    expect((await other.request.post("/api/oracle", { data: {
      sessionId: session.id, question: "Compare os livros privados", regenerate: true, userId: identity.userId,
    } })).status()).toBe(404);
    expect((await other.request.post("/api/oracle/artifacts", { data: { sessionId: session.id, type: "NOTE", title: "Invasão", content: "Não deve ser salvo." } })).status()).toBe(404);
    for (const path of ["/api/oracle", "/api/oracle/sessions", "/api/oracle/artifacts", "/api/library-settings"]) {
      const response = await other.request.get(path);
      expect(response.status()).toBe(200);
      const text = await response.text();
      expect(text).not.toContain(session.id);
      expect(text).not.toContain(bookId);
      expect(text).not.toContain(privateMemory);
      expect(text).not.toContain("Conteúdo privado do dono.");
    }
    // Mesmo título nas duas estantes: a recuperação deve citar só o livro da conta ativa.
    const otherBookId = await seedBook(other);
    await other.goto("/oracle");
    await send(other, `Compare "Memórias da cidade" ${crypto.randomUUID()}`);
    await expect(other.getByRole("button", { name: "Regenerar", exact: true })).toBeVisible();
    const otherSession = await currentSession(other);
    expect(otherSession.messages[1]?.sources.map(source => source.id)).toContain(otherBookId);
    expect(otherSession.messages[1]?.sources.map(source => source.id)).not.toContain(bookId);
    expect((await other.request.post("/api/library-settings", { data: { oracleProfile: "Preferência da segunda conta", oracleProfileVersion: 0 } })).status()).toBe(200);
    expect((await other.request.delete("/api/oracle")).status()).toBe(200);
    // Limpar histórico remove mensagens; a sessão vazia continua disponível.
    expect((await currentSession(other)).messages).toEqual([]);
    expect((await currentSession(page)).messages).toEqual(session.messages);
    expect((await (await page.request.get("/api/library-settings")).json()).setting.oracleProfile).toBe(privateMemory);
    expect((await (await page.request.get("/api/oracle/artifacts")).json()).artifacts).toHaveLength(1);
  } finally { await otherContext.close(); }
});

test("APIs do Oráculo recusam acesso direto sem sessão Clerk", async ({ request }) => {
  const sessionId = "cm00000000000000000000000";
  const endpoints = [
    ["GET", "/api/oracle"], ["POST", "/api/oracle"], ["DELETE", "/api/oracle"],
    ["GET", "/api/oracle/sessions"], ["POST", "/api/oracle/sessions"],
    ["GET", `/api/oracle/sessions/${sessionId}`], ["PATCH", `/api/oracle/sessions/${sessionId}`],
    ["DELETE", `/api/oracle/sessions/${sessionId}`],
    ["GET", "/api/oracle/artifacts"], ["POST", "/api/oracle/artifacts"],
    ["GET", "/api/library-settings"], ["POST", "/api/library-settings"],
  ] as const;
  for (const [method, path] of endpoints) {
    const response = await request.fetch(path, { method, data: method === "POST" || method === "PATCH" ? {} : undefined });
    expect(response.status(), `${method} ${path}`).toBe(401);
  }
});
