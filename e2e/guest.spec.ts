import { clerk } from "@clerk/testing/playwright";
import { expect, test } from "@playwright/test";

test("apresentação responde e o teclado pula para o conteúdo", async ({ page }) => {
  await page.goto("/");
  await expect(page.getByRole("heading", { level: 1 })).toContainText("Sua estante de livros físicos");
  await page.keyboard.press("Tab");
  await expect(page.getByRole("link", { name: "Pular para o conteúdo" })).toBeFocused();
  await page.keyboard.press("Enter");
  await expect(page.locator("#main-content")).toBeFocused();
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
});

test("tema alterna e persiste após recarregar", async ({ page }) => {
  await page.goto("/");
  const toggle = page.getByRole("button", { name: "Modo escuro", exact: true });
  await expect(toggle).toHaveAttribute("aria-pressed", "false");
  await toggle.click();
  await expect(toggle).toHaveAttribute("aria-pressed", "true");
  await page.reload();
  await expect(toggle).toHaveAttribute("aria-pressed", "true");
});

test("feed de visitante oferece entrada sem falso erro ou compositor", async ({ page }) => {
  test.setTimeout(90000);
  await page.goto("/feed");
  await clerk.loaded({ page });
  await expect(page.getByRole("heading", { name: "Entre para participar do feed" })).toBeVisible();
  await expect(page.getByRole("textbox")).toHaveCount(0);
  await expect(page.getByRole("main").getByRole("alert")).toHaveCount(0);
  await page.getByRole("button", { name: "Entrar no feed", exact: true }).click();
  const close = page.getByRole("button", { name: /Close modal|Fechar modal/i });
  await expect(close).toBeVisible({ timeout: 15000 });
  await close.click();
  await expect(close).toHaveCount(0);
});

test("cadastro mantém campos legíveis e área de toque", async ({ page }) => {
  await page.goto("/sign-up");
  await expect(page.getByRole("heading", { name: "Criar sua conta", exact: true })).toBeVisible();
  await expect(page.getByPlaceholder("Crie uma senha", { exact: true })).toBeVisible();
  const inputs = page.locator(".cl-formFieldInput");
  expect(await inputs.count()).toBeGreaterThan(0);
  for (const input of await inputs.all()) {
    if (await input.isVisible()) {
      const dimensions = await input.boundingBox();
      expect(dimensions?.height).toBeGreaterThanOrEqual(44);
      expect(await input.evaluate(element => Number.parseFloat(getComputedStyle(element).fontSize))).toBeGreaterThanOrEqual(16);
    }
  }
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
});

test("preferência por movimento reduzido limita a animação", async ({ page }) => {
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.goto("/");
  const animated = page.locator(".scanner-line, .scanner-laser, .pulse-laser-beam").first();
  await expect(animated).toBeAttached();
  expect(await animated.evaluate(element => Number.parseFloat(getComputedStyle(element).animationDuration))).toBeLessThanOrEqual(0.001);
});
