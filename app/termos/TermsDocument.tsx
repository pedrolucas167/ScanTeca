import { termsVersion } from "./version";

export default function TermsDocument() {
  return (
    <>
      <h1 className="text-2xl font-semibold">Termos de uso da ScanTeca</h1>
      <p className="mt-1 text-sm text-on-surface-variant">Versão {termsVersion}</p>
      <div className="mt-6 space-y-5">
        <section>
          <h2 className="font-semibold">Conta e biblioteca</h2>
          <p>A ScanTeca permite organizar livros, registrar leituras e consultar metadados e capas por título ou ISBN. A autenticação é fornecida pelo Clerk. Use sua própria conta e mantenha seus meios de acesso protegidos.</p>
        </section>
        <section>
          <h2 className="font-semibold">Comunidade e compartilhamento</h2>
          <p>O Feed, os clubes, os perfis e os links de compartilhamento permitem mostrar conteúdo a outras pessoas. Confira a visibilidade antes de publicar ou compartilhar. Respeite os direitos de terceiros e evite publicar informações pessoais de outras pessoas, conteúdo ilegal ou abusivo.</p>
        </section>
        <section>
          <h2 className="font-semibold">Oráculo</h2>
          <p>O Oráculo usa inteligência artificial para responder a perguntas e sugerir leituras. O pedido e o contexto necessário para respondê-lo podem ser enviados ao provedor de IA. Evite incluir informações sigilosas ou dados de outras pessoas. Confira as respostas antes de usá-las, pois podem conter erros.</p>
        </section>
        <section>
          <h2 className="font-semibold">Aceite e preferências</h2>
          <p>Ao aceitar, sua conta registra a versão deste texto e a data e hora do aceite. Se os termos forem atualizados, a ScanTeca poderá pedir um novo aceite. Você controla a coleta de métricas opcionais em Preferências de métricas, no rodapé.</p>
        </section>
      </div>
    </>
  );
}
