import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { ReadingError } from "./transitions";

export async function readingTransaction<T>(run: (tx: Prisma.TransactionClient) => Promise<T>): Promise<T> {
  for (let attempt = 0; attempt < 3; attempt++) {
    try {
      return await prisma.$transaction(run, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable });
    } catch (error) {
      if (!(error instanceof Prisma.PrismaClientKnownRequestError) || error.code !== "P2034") throw error;
    }
  }
  throw new ReadingError("Alteração simultânea. Tente novamente.", "CONFLICT");
}
