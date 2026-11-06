import { auth, currentUser } from "@clerk/nextjs/server";
import { NextRequest } from "next/server";
import { exportAccountData } from "@/lib/privacy-export";
import { rateLimitGuard } from "@/lib/rate-limit";

const headers = { "Cache-Control": "private, no-store", "X-Content-Type-Options": "nosniff" };

export async function GET(request: NextRequest) {
  let stage = "session";
  try {
    const { userId } = await auth();
    if (!userId) return Response.json({ error: "Entre na sua conta." }, { status: 401, headers });

    if (request.nextUrl.searchParams.size > 0) {
      return Response.json({ error: "O download usa a conta da sessão." }, { status: 400, headers });
    }
    const limited = await rateLimitGuard(request, { route: "privacy-export", userId, userLimit: 5, ipLimit: 30 });
    if (limited) {
      limited.headers.set("Cache-Control", headers["Cache-Control"]);
      return limited;
    }

    stage = "account";
    const user = await currentUser();
    if (!user || user.id !== userId) return Response.json({ error: "Sessão inválida." }, { status: 401, headers });
    stage = "database";
    const dados = await exportAccountData(userId);

    stage = "response";
    return Response.json({
      versao: 1,
      geradoEm: new Date().toISOString(),
      origens: {
        conta: "Cadastro e autenticação no Clerk.",
        dados: "Preferências, biblioteca, leitura, Oráculo, comunidade e notificações registradas na ScanTeca.",
      },
      conta: {
        id: user.id,
        nome: user.firstName,
        sobrenome: user.lastName,
        nomeDeUsuario: user.username,
        emails: user.emailAddresses.map(email => email.emailAddress),
        telefones: user.phoneNumbers.map(phone => phone.phoneNumber),
        imagemUrl: user.hasImage ? user.imageUrl : null,
        criadaEm: new Date(user.createdAt).toISOString(),
        ultimoAcessoEm: user.lastSignInAt ? new Date(user.lastSignInAt).toISOString() : null,
      },
      dados,
      observacoes: [
        "O arquivo reúne os dados disponíveis para download direto. Publicações com imagem incluem sua referência, quando disponível.",
        "Dados de outras contas, segredos de autenticação e registros operacionais internos não integram este arquivo.",
        "Para pedir informações complementares ou cópias de anexos, entre em contato pelo canal de privacidade.",
      ],
      contatoPrivacidade: "pedro_marques_dev@hotmail.com",
    }, {
      headers: { ...headers, "Content-Disposition": 'attachment; filename="scanteca-meus-dados.json"' },
    });
  } catch {
    console.warn("[privacy-export] unavailable", { stage });
    return Response.json({ error: "Não foi possível gerar o arquivo. Tente novamente." }, { status: 503, headers });
  }
}
