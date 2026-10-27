import { clerk, clerkSetup, setupClerkTestingToken } from "@clerk/testing/playwright";
import { expect, test } from "./fixtures";

// Mesmo worker: o token fica disponível sem arquivo de sessão ou projeto auxiliar.
test.beforeAll(async () => { await clerkSetup(); });

test("conta temporária publica e remove somente o registro do teste", async ({ page, identity }) => {
  await setupClerkTestingToken({ page });
  await page.goto("/sign-in");
  await expect(page.locator('input[name="identifier"]')).toBeVisible();
  try {
    await clerk.signIn({ page, emailAddress: identity.email });
  } catch (error) {
    // A atualização de sessão do Next pode substituir o documento durante setActive.
    // Só aceitamos esse caso específico e exigimos a identidade exata logo abaixo.
    if (!(error instanceof Error) || !error.message.includes("Execution context was destroyed")) throw error;
  }
  await page.waitForFunction(userId => {
    const clerk = (window as unknown as { Clerk?: { user?: { id: string } } }).Clerk;
    return clerk?.user?.id === userId;
  }, identity.userId);
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
