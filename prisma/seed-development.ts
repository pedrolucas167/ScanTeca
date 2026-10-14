import nextEnv from "@next/env";
import { PrismaClient } from "@prisma/client";
import { developmentBooks, developmentSeedConfig, seedDevelopment } from "./development-fixtures";

nextEnv.loadEnvConfig(process.cwd(), true);

async function main() {
  const config = developmentSeedConfig(process.env);
  const apply = process.argv.includes("--apply");
  process.stdout.write(`[seed:dev] ${apply ? "Aplicação" : "Prévia"}: banco local de desenvolvimento, usuário explicitamente selecionado.\n`);
  for (const book of developmentBooks) process.stdout.write(`  ${book.title}: ${book.status}, ${book.pages} páginas\n`);
  if (!apply) {
    process.stdout.write("[seed:dev] Nenhuma conexão ou gravação. Use --apply para criar os dados.\n");
    return;
  }
  const prisma = new PrismaClient({ datasourceUrl: config.databaseUrl });
  try {
    await seedDevelopment(prisma, config.userId);
    process.stdout.write("[seed:dev] Concluído: biblioteca, coleções, livros, sessão, atividade, diário e anotação. Registros existentes preservados.\n");
  } finally { await prisma.$disconnect(); }
}

main().catch(error => {
  // Prisma errors can embed connection details; don't print raw diagnostics.
  console.error("[seed:dev] Falhou:", error instanceof Error && error.name === "Error" ? error.message : "Verifique a conexão e o schema do PostgreSQL local.");
  process.exitCode = 1;
});
