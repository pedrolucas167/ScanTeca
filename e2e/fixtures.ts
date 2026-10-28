import { createClerkClient } from "@clerk/backend";
import { clerk, setupClerkTestingToken } from "@clerk/testing/playwright";
import { expect, test as base, type Page } from "@playwright/test";
import { randomBytes, randomUUID } from "node:crypto";

type TestIdentity = { email: string; userId: string };
type IdentityFactory = () => Promise<TestIdentity>;

export const test = base.extend<{ identity: TestIdentity; identityFactory: IdentityFactory }>({
  identityFactory: async ({}, provideFactory) => {
    const secretKey = process.env.CLERK_SECRET_KEY;
    if (!secretKey?.startsWith("sk_test_")) throw new Error("Contas temporárias exigem Clerk de desenvolvimento.");
    const client = createClerkClient({ secretKey });
    const createdIds: string[] = [];
    const createIdentity = async () => {
      const run = randomUUID();
      const email = `scanteca-e2e-${run}+clerk_test@example.com`;
      const user = await client.users.createUser({
        emailAddress: [email],
        username: `e2e${run.replaceAll("-", "").slice(0, 20)}`,
        // Satisfaz a política da instância; não é armazenada nem usada no login.
        password: `${randomBytes(32).toString("base64url")}aA9!`,
        externalId: `scanteca-e2e-${run}`,
        privateMetadata: { scantecaE2E: true, run },
      });
      createdIds.push(user.id);
      return { email, userId: user.id };
    };
    try {
      await provideFactory(createIdentity);
    } finally {
      // Apenas IDs retornados pelas criações desta execução podem ser removidos.
      const cleanup = await Promise.allSettled(createdIds.map(id => client.users.deleteUser(id)));
      if (cleanup.some(result => result.status === "rejected")) throw new Error("Não foi possível remover todas as contas temporárias desta execução.");
    }
  },
  identity: async ({ identityFactory }, provideIdentity) => { await provideIdentity(await identityFactory()); },
});

export async function signInAs(page: Page, identity: TestIdentity) {
  await setupClerkTestingToken({ page });
  await page.goto("/sign-in");
  await expect(page.locator('input[name="identifier"]')).toBeVisible();
  try {
    await clerk.signIn({ page, emailAddress: identity.email });
  } catch (error) {
    if (!(error instanceof Error) || !error.message.includes("Execution context was destroyed")) throw error;
  }
  await page.waitForFunction(userId => {
    const clerk = (window as unknown as { Clerk?: { user?: { id: string } } }).Clerk;
    return clerk?.user?.id === userId;
  }, identity.userId);
}

export { expect } from "@playwright/test";
