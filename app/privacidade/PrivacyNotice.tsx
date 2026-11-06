import Link from "next/link";

export default function PrivacyNotice() {
  return (
    <div className="mt-4 space-y-5">
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
          <li>
            <strong>Inteligência artificial.</strong> A ScanTeca usa o OpenRouter para processar solicitações de IA, que podem incluir texto, áudio e contexto. Saiba mais nos{" "}
            <a className="underline" href="https://openrouter.ai/terms">Termos do OpenRouter</a> e na{" "}
            <a className="underline" href="https://openrouter.ai/privacy">Política de Privacidade do OpenRouter</a>.
          </li>
          <li><strong>Notificações.</strong> Se você habilitar notificações, usamos a inscrição do navegador para entregá-las.</li>
        </ul>
      </section>
      <section>
        <h2 className="font-semibold">Preferências do navegador</h2>
        <p>O navegador pode guardar escolhas como tema e aparência, para preservá-las entre visitas.</p>
      </section>
      <section>
        <h2 className="font-semibold">Bases legais e retenção</h2>
        <p>Os dados necessários para prestar os recursos que você solicita são tratados para executar o serviço. O cumprimento de uma obrigação legal ou o exercício regular de direitos pode exigir o tratamento de dados específicos.</p>
        <p className="mt-2">A regra de retenção é guardar cada dado somente enquanto ele for necessário à finalidade informada. Depois, ele deve ser eliminado, salvo se houver fundamento legal para conservar uma parte por mais tempo. Na operação atual, como pessoa física, a ScanTeca não está sujeita à guarda de rotina de seis meses prevista no art. 15 do Marco Civil da Internet. Uma determinação específica de preservação pode exigir guarda pelo período aplicável.</p>
      </section>
      <section>
        <h2 className="font-semibold">Hospedagem e compartilhamento</h2>
        <p>A operação usa Vercel para hospedagem, PostgreSQL no Neon, Redis para funções como limites de requisições e cache, e AWS para armazenar e entregar imagens de publicações. O navegador também pode carregar fontes do Google.</p>
        <p className="mt-2">Os logs de execução nativos do plano atual da Vercel têm retenção de uma hora. O projeto Neon em São Paulo tem uma janela de restauração de seis horas. Cópias mantidas separadamente e as condições de tratamento e transferência dos demais fornecedores seguem em revisão.</p>
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
