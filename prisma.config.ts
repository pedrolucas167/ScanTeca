import "dotenv/config";
import { defineConfig } from "prisma/config";

export default defineConfig({
  schema: "prisma/schema.prisma",
  migrations: { path: "prisma/migrations" },
  // generate não exige conexão; comandos de banco exigem DATABASE_URL explícita.
  datasource: process.env.DATABASE_URL ? { url: process.env.DATABASE_URL } : undefined,
});
