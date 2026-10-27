import { clerkSetup } from "@clerk/testing/playwright";
import { test as setup } from "@playwright/test";

setup.describe.configure({ mode: "serial" });
setup("preparar instância Clerk de desenvolvimento", async () => {
  await clerkSetup();
});
