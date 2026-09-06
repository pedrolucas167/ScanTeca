import type { Metadata } from "next";
import Link from "next/link";
import { ListFilter, ScanLine, Sparkles, TrendingUp } from "lucide-react";

export const metadata: Metadata = {
  title: "Manifesto",
  description:
    "Manifesto Scanteca: o fim do caos literário — menos tempo digitando planilhas, mais tempo conversando com o seu próprio conhecimento.",
};

const features = [
  {
    icon: ScanLine,
    title: "Entrada Ágil",
    text: "Basta apontar a câmera do celular para o código de barras (ISBN/EAN-13) para que o sistema resgate automaticamente capa, sinopse, gênero, ano de publicação e número de páginas.",
  },
  {
    icon: TrendingUp,
    title: "Visão Panorâmica",
    text: "A Ficha da Coleção traz métricas instantâneas sobre volumes, progresso de leitura, altura da pilha de livros e ritmo estimado.",
  },
  {
    icon: ListFilter,
    title: "Organização Total",
    text: "Filtros avançados por status, coleções, gêneros, anos e avaliações, além de exportação em CSV e compartilhamento da vitrine pessoal.",
  },
];

export default function ManifestoPage() {
  return (
    <main className="mx-auto w-full max-w-3xl flex-1 px-4 py-16 sm:py-24">
      <header className="text-center">
        <p className="text-[11px] font-medium uppercase tracking-[0.3em] text-indigo-600 dark:text-indigo-400">
          Manifesto Scanteca
        </p>
        <h1 className="mt-3 font-serif text-4xl font-semibold tracking-tight text-foreground sm:text-5xl">
          O Fim do Caos Literário
        </h1>
        <div className="mx-auto mt-6 flex max-w-xs items-center gap-3">
          <span className="h-px flex-1 bg-zinc-300 dark:bg-zinc-700" />
          <span className="font-serif text-sm italic text-zinc-400 dark:text-zinc-500">
            ❧
          </span>
          <span className="h-px flex-1 bg-zinc-300 dark:bg-zinc-700" />
        </div>
      </header>

      <section className="mt-14">
        <h2 className="font-serif text-2xl font-semibold text-foreground">
          A Dor do Acervo Analógico
        </h2>
        <p className="mt-4 leading-relaxed text-zinc-600 dark:text-zinc-400">
          Quem ama ler e acumula muitos livros físicos invariavelmente esbarra no
          mesmo problema: o controle do acervo se perde. Planilhas no Excel viram
          um fardo de atualizar, aplicativos genéricos exigem digitação manual
          exaustiva, e a biblioteca física acaba virando uma incógnita — você
          sabe que tem o livro, mas não lembra onde ele está, qual é a sinopse
          exata ou se ele já foi lido.
        </p>
      </section>

      <section className="mt-14">
        <h2 className="font-serif text-2xl font-semibold text-foreground">
          A Solução
        </h2>
        <p className="mt-4 leading-relaxed text-zinc-600 dark:text-zinc-400">
          O Scanteca nasceu para eliminar todo o atrito entre o livro físico e o
          ambiente digital. Através de um ecossistema rápido e inteligente, a
          aplicação resolve a gestão do acervo em segundos:
        </p>
        <ul className="mt-8 space-y-4">
          {features.map((f) => (
            <li
              key={f.title}
              className="flex gap-4 rounded-xl border border-zinc-200 bg-white p-5 dark:border-zinc-800 dark:bg-zinc-900"
            >
              <f.icon className="mt-0.5 h-5 w-5 shrink-0 text-indigo-600 dark:text-indigo-400" />
              <div>
                <h3 className="font-serif text-lg font-semibold text-foreground">
                  {f.title}
                </h3>
                <p className="mt-1 text-sm leading-relaxed text-zinc-600 dark:text-zinc-400">
                  {f.text}
                </p>
              </div>
            </li>
          ))}
        </ul>
      </section>

      <section className="mt-14 rounded-2xl border border-indigo-100 bg-indigo-50/50 p-6 sm:p-8 dark:border-indigo-900/40 dark:bg-indigo-950/20">
        <div className="flex items-center gap-2.5">
          <Sparkles className="h-5 w-5 text-indigo-600 dark:text-indigo-400" />
          <h2 className="font-serif text-2xl font-semibold text-foreground">
            O Oráculo de Bolso
          </h2>
        </div>
        <p className="mt-1 text-[11px] font-medium uppercase tracking-[0.2em] text-indigo-500 dark:text-indigo-400">
          IA e Busca Semântica
        </p>
        <p className="mt-4 leading-relaxed text-zinc-600 dark:text-zinc-400">
          Mais do que uma estante digital passiva, o Scanteca transforma o seu
          acervo em um ambiente conversacional vivo. Utilizando inteligência
          artificial e um banco de dados vetorial (pgvector), a plataforma conta
          com o Oráculo de Bolso — um sistema RAG onde você pode conversar
          diretamente com o seu acervo físico.
        </p>
        <p className="mt-4 leading-relaxed text-zinc-600 dark:text-zinc-400">
          Com ele, é possível fazer perguntas complexas, cruzar referências entre
          diferentes áreas do conhecimento e descobrir conexões profundas entre
          os autores e as obras que estão fisicamente na sua prateleira.
        </p>
      </section>

      <footer className="mt-16 text-center">
        <div className="mx-auto flex max-w-xs items-center gap-3">
          <span className="h-px flex-1 bg-zinc-300 dark:bg-zinc-700" />
          <span className="font-serif text-sm italic text-zinc-400 dark:text-zinc-500">
            ❧
          </span>
          <span className="h-px flex-1 bg-zinc-300 dark:bg-zinc-700" />
        </div>
        <p className="mt-8 font-serif text-xl italic leading-relaxed text-foreground sm:text-2xl">
          Menos tempo digitando planilhas, mais tempo conversando com o seu
          próprio conhecimento.
        </p>
        <Link
          href="/scanner"
          className="mt-8 inline-flex items-center gap-2 rounded-full bg-indigo-600 px-6 py-2.5 text-sm font-medium text-white transition-colors hover:bg-indigo-700"
        >
          <ScanLine className="h-4 w-4" />
          Começar a catalogar
        </Link>
      </footer>
    </main>
  );
}
