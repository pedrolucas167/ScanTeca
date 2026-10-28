import { PrismaClient } from "@prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";

export function createPrismaClient(connectionString: string | undefined = process.env.DATABASE_URL) {
  if (!connectionString) throw new Error("DATABASE_URL é obrigatória para conectar ao banco.");
  const adapter = new PrismaPg({
    connectionString,
    max: 5,
    connectionTimeoutMillis: 5000,
    idleTimeoutMillis: 30000,
  });
  return new PrismaClient({ adapter });
}
