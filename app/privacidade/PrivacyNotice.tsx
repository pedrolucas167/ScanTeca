import Link from "next/link";

export default function PrivacyNotice() {
  return (
    <div className="mt-4 space-y-5">
      <p className="text-sm font-medium">Minuta para revisão. A confirmação dos prazos de retenção e do tratamento pelos fornecedores está pendente.</p>
      <section>
        <h2 className="font-semibold">Responsável e contato</h2>
        <p>Pedro Lucas Marques é o responsável pela ScanTeca. Para assuntos de privacidade, escreva para{" "}
          <a className="underline" href="mailto:pedro_marques_dev@hotmail.com">pedro_marques_dev@hotmail.com</a>.
        </p>
      </section>
      <section>
        <h2 className="font-semibold">Dados e finalidades</h2>
        <ul className="mt-2 list-disc space-y-2 pl-5">
          <li><strong>Conta e segurança.</strong> Usamos os dados de cadastro e a sessão do Clerk para identificar a conta e proteger o acesso. A ScanTeca registra a versão e a data do aceite dos termos.</li>
          <li><strong>Biblioteca e comunidade.</strong> Guardamos registros de leitura, anotações, preferências e conteúdo que você publica para oferecer esses recursos. Perfis, publicações e links podem disponibilizar conteúdo a outras pessoas conforme a visibilidade do recurso. Consultas por título, autor ou ISBN podem usar Google Books e Open Library.</li>
          <li><strong>Oráculo.</strong> Perguntas, áudio quando você usa voz e o contexto usado para responder podem ser enviados ao OpenRouter e ao provedor do modelo selecionado. O app também usa serviços de IA em recursos como recomendações e moderação. Você pode gerenciar a memória do Oráculo na interface.</li>
          <li><strong>Cidade e notificações.</strong> A cidade é uma preferência privada e opcional, exibida nas configurações e na exportação da conta. Você pode removê-la ao limpar o campo e salvar. Se habilitar notificações, usamos a inscrição do navegador para entregá-las.</li>
        </ul>
      </section>
      <section>
        <h2 className="font-semibold">Preferências do navegador e métricas</h2>
        <p>O navegador pode guardar escolhas como tema e preferência de métricas. Se você permitir as métricas opcionais, contamos visitas e faixas de desempenho na inicial, no Manifesto e no Feed. A ScanTeca guarda esses totais diários por até 30 dias e sua escolha por até 180 dias no navegador. Você pode recusar ou revogar pelo botão Preferências de métricas no rodapé.</p>
      </section>
      <section>
        <h2 className="font-semibold">Hospedagem e compartilhamento</h2>
        <p>A operação usa Vercel para hospedagem, PostgreSQL no Neon, Redis para funções como limites de requisições e métricas, e AWS para armazenar e entregar imagens de publicações. O navegador também pode carregar fontes do Google. Os prazos de retenção, regiões de processamento e condições de transferência dos fornecedores estão em verificação nesta minuta.</p>
      </section>
      <section>
        <h2 className="font-semibold">Seus direitos</h2>
        <p>Em <Link href="/configuracoes" className="underline">Configurações → Privacidade</Link>, você pode baixar os dados disponíveis da conta. O arquivo inclui referências de imagens. Pelo e-mail de privacidade, você pode pedir confirmação de tratamento, acesso complementar, correção, informações sobre compartilhamento, portabilidade quando aplicável, eliminação, bloqueio ou anonimização nas hipóteses legais. Você também pode revogar consentimento e peticionar à{" "}
          <a className="underline" href="https://www.gov.br/anpd/pt-br/canais_atendimento/cidadao-titular-de-dados/denuncia-peticao-de-titular-referente-lgpd">ANPD</a>.
          Podemos confirmar sua identidade antes de entregar dados ou alterar a conta.
        </p>
      </section>
    </div>
  );
}
