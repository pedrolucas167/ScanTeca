import { clerk, setupClerkTestingToken } from "@clerk/testing/playwright";
import { expect, test } from "@playwright/test";

test("conta exclusiva publica e remove somente o registro do teste", async ({ page }) => {
  await setupClerkTestingToken({ page });
  await page.goto("/");
  await clerk.signIn({ page, emailAddress: process.env.E2E_CLERK_USER_EMAIL! });
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
