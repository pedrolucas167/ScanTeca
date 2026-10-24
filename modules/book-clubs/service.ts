import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";

export class BookClubError extends Error {
  constructor(message: string, readonly status = 400) { super(message); }
}

// Entradas, saídas e mudanças de capacidade disputam a mesma linha do clube.
// A escrita antes das leituras também faz snapshots Serializable obsoletos
// abortarem com P2034 em vez de decidir com uma contagem antiga.
async function clubTransaction<T>(id: string, run: (tx: Prisma.TransactionClient) => Promise<T>): Promise<T> {
  for (let attempt = 0; attempt < 3; attempt++) {
    try {
      return await prisma.$transaction(async tx => {
        const { count: found } = await tx.bookClub.updateMany({ where: { id }, data: { updatedAt: new Date() } });
        if (!found) throw new BookClubError("Clube não encontrado", 404);
        return run(tx);
      }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable });
    } catch (error) {
      if (!(error instanceof Prisma.PrismaClientKnownRequestError) || error.code !== "P2034") throw error;
    }
  }
  throw new BookClubError("Alteração simultânea. Tente novamente.", 409);
}

export function changeMembership(id: string, userId: string, action: "join" | "leave") {
  return clubTransaction(id, async tx => {
    const club = await tx.bookClub.findUniqueOrThrow({ where: { id } });
    const where = { clubId_userId: { clubId: id, userId } };
    const member = await tx.bookClubMember.findUnique({ where });
    if (action === "leave") {
      if (!member) throw new BookClubError("Não é membro");
      if (member.role === "OWNER") throw new BookClubError("Dono não pode sair");
      await tx.bookClubMember.delete({ where });
      return "Saiu do clube com sucesso";
    }
    if (member) throw new BookClubError("Já é membro");
    if (club.maxMembers !== null && await tx.bookClubMember.count({ where: { clubId: id } }) >= club.maxMembers) {
      throw new BookClubError("Clube cheio");
    }
    if (club.isPrivate) throw new BookClubError("Clube privado - requer convite", 403);
    await tx.bookClubMember.create({ data: { clubId: id, userId, role: "MEMBER" } });
    return "Entrou no clube com sucesso";
  });
}

type ClubUpdate = {
  name?: string;
  description?: string;
  imageUrl?: string;
  maxMembers?: number;
  isPrivate?: boolean;
};

export function updateBookClub(id: string, userId: string, data: ClubUpdate) {
  return clubTransaction(id, async tx => {
    const member = await tx.bookClubMember.findUnique({ where: { clubId_userId: { clubId: id, userId } } });
    if (!member || (member.role !== "OWNER" && member.role !== "ADMIN")) throw new BookClubError("Sem permissão", 403);
    if (data.maxMembers !== undefined && data.maxMembers < await tx.bookClubMember.count({ where: { clubId: id } })) {
      throw new BookClubError("Capacidade não pode ser menor que o número de membros");
    }
    return tx.bookClub.update({ where: { id }, data });
  });
}
