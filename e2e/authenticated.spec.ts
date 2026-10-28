import { clerk, clerkSetup } from "@clerk/testing/playwright";
import { expect, signInAs, test } from "./fixtures";

// Mesmo worker: o token fica disponível sem arquivo de sessão ou projeto auxiliar.
test.beforeAll(async () => { await clerkSetup(); });

test("conta temporária publica e remove somente o registro do teste", async ({ page, identity }) => {
  await signInAs(page, identity);
  let postId: string | undefined;
  try {
    await page.goto("/feed");
    await expect(page.getByRole("heading", { name: "Feed de leitores", exact: true })).toBeVisible();
    const text = `Validação E2E isolada ${Date.now()}`;
    await page.getByRole("textbox", { name: "O que você está lendo ou pensando? 📖", exact: true }).fill(text);
    const response = page.waitForResponse(item => new URL(item.url()).pathname === "/api/feed" && item.request().method() === "POST");
    await page.getByRole("button", { name: "Publicar", exact: true }).click();
    const created = await response;
    expect(created.status()).toBe(201);
    const data = await created.json();
    postId = data.post.id;
    await expect(page.getByText(text, { exact: true })).toBeVisible();
    await expect(page.getByRole("status").filter({ hasText: "Publicação enviada." })).toBeVisible();
  } finally {
    if (postId) expect((await page.request.delete(`/api/feed/${postId}`)).ok()).toBe(true);
    await clerk.signOut({ page });
  }
});

test("cadastro manual e progresso de leitura persistem após recarregar", async ({ page, identity }) => {
  await signInAs(page, identity);
  const title = `Livro E2E ${crypto.randomUUID()}`;
  let bookId: string | undefined;
  try {
    await page.goto("/manual-add");
    await page.getByLabel("Título *", { exact: true }).fill(title);
    await page.getByLabel("Autor", { exact: true }).fill("Autor de teste");
    await page.getByLabel("Páginas", { exact: true }).fill("120");
    await page.getByLabel("Sinopse", { exact: true }).fill("Livro fictício para validar o fluxo de leitura.");
    await page.getByLabel("Status", { exact: true }).selectOption("READING");
    await page.getByLabel("URL da imagem da capa", { exact: true }).fill("/favicon.svg");
    const creation = page.waitForResponse(response => new URL(response.url()).pathname === "/api/books" && response.request().method() === "POST");
    await page.getByRole("button", { name: "Salvar Livro", exact: true }).click();
    const created = await creation;
    expect(created.status()).toBe(201);
    bookId = (await created.json()).book.id;
    await page.goto(`/books/${bookId}`);
    await expect(page.getByRole("heading", { name: title, exact: true })).toBeVisible();
    await page.goto(`/diario?bookId=${bookId}`);
    await page.getByRole("button", { name: "Iniciar sessão", exact: true }).click();
    await expect(page.getByRole("button", { name: "Pausar e registrar", exact: true })).toBeEnabled();
    await page.getByLabel("Pág.", { exact: true }).fill("12");
    const paused = page.waitForResponse(response => new URL(response.url()).pathname === "/api/diary" && response.request().method() === "POST");
    await page.getByRole("button", { name: "Pausar e registrar", exact: true }).click();
    expect((await paused).status()).toBe(200);
    await page.reload();
    await expect(page.getByLabel("Pág.", { exact: true })).toHaveValue("12");
    await expect(page.getByRole("progressbar", { name: "Progresso do livro" })).toHaveAttribute("aria-valuenow", "10");
    await expect(page.getByRole("button", { name: "Iniciar sessão", exact: true })).toBeEnabled();
  } finally {
    if (bookId) expect((await page.request.delete(`/api/books?id=${bookId}`)).ok()).toBe(true);
  }
});

test("outra conta não lê nem altera livro e anotação privados", async ({ page, browser, baseURL, identity, identityFactory }) => {
  await signInAs(page, identity);
  const title = `Acervo privado ${crypto.randomUUID()}`;
  const note = `Reflexão privada ${crypto.randomUUID()}`;
  const created = await page.request.post("/api/books", { data: { title, author: "Autor de teste", pages: 100, status: "READING", synopsis: "Acervo fictício privado.", coverUrl: "/favicon.svg" } });
  expect(created.status()).toBe(201);
  const bookId = (await created.json()).book.id as string;
  const otherContext = await browser.newContext({ baseURL });
  try {
    const entry = await page.request.post("/api/diary", { data: { action: "entry", bookId, type: "REFLECTION", content: note, tags: [] } });
    expect(entry.status()).toBe(201);
    const entryId = (await entry.json()).entry.id as string;
    await page.goto(`/diario?bookId=${bookId}`);
    await expect(page.getByText(note, { exact: true })).toBeVisible();
    const otherPage = await otherContext.newPage();
    await signInAs(otherPage, await identityFactory());
    await otherPage.goto(`/books/${bookId}`);
    await expect(otherPage.getByRole("heading", { name: "404", exact: true })).toBeVisible();
    await expect(otherPage.getByText(title, { exact: true })).toHaveCount(0);
    await otherPage.goto(`/diario?bookId=${bookId}`);
    await expect(otherPage.getByText(note, { exact: true })).toHaveCount(0);
    await expect(otherPage.getByText(title, { exact: true })).toHaveCount(0);
    expect((await otherPage.request.patch("/api/books", { data: { id: bookId, title: "Alteração indevida" } })).status()).toBe(404);
    expect((await otherPage.request.delete(`/api/books?id=${bookId}`)).status()).toBe(404);
    expect((await otherPage.request.post("/api/diary", { data: { action: "updateEntry", entryId, type: "REFLECTION", content: "Alteração indevida", tags: [] } })).status()).toBe(404);
    await page.reload();
    await expect(page.getByText(note, { exact: true })).toBeVisible();
  } finally {
    await otherContext.close();
    expect((await page.request.delete(`/api/books?id=${bookId}`)).ok()).toBe(true);
  }
});
