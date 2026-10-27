import { createClerkClient } from "@clerk/backend";
import { test as base } from "@playwright/test";
import { randomBytes, randomUUID } from "node:crypto";

type TestIdentity = { email: string; userId: string };

export const test = base.extend<{ identity: TestIdentity }>({
  identity: async ({}, provideIdentity) => {
    const secretKey = process.env.CLERK_SECRET_KEY;
    if (!secretKey?.startsWith("sk_test_")) throw new Error("Contas temporárias exigem Clerk de desenvolvimento.");
    const client = createClerkClient({ secretKey });
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
    try {
      await provideIdentity({ email, userId: user.id });
    } finally {
      // Somente o ID retornado pela criação desta execução pode ser removido.
      await client.users.deleteUser(user.id);
    }
  },
});

export { expect } from "@playwright/test";
