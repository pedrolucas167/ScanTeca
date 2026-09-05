import Link from "next/link";
import { BookOpen, Quote } from "lucide-react";

export default function LandingPage() {
  return (
    <div className="flex flex-1 flex-col">
      <section className="flex flex-1 items-center justify-center px-4 py-16 text-center">
        <div className="mx-auto max-w-3xl">
          <div className="mb-6 inline-flex items-center justify-center rounded-2xl bg-indigo-100 p-4 dark:bg-indigo-900/30">
            <BookOpen className="h-10 w-10 text-indigo-600 dark:text-indigo-400" />
          </div>

          <p className="text-[11px] font-medium uppercase tracking-[0.3em] text-zinc-400 dark:text-zinc-500">
            Bibliotheca Personalis
          </p>
          <h1 className="mt-3 font-serif text-5xl font-semibold tracking-tight text-foreground sm:text-6xl">
            Scanteca
          </h1>
          <p className="mx-auto mt-4 max-w-lg font-serif text-lg italic text-zinc-600 dark:text-zinc-400">
            Organize, descubra e celebre a sua biblioteca pessoal.
          </p>

          <div className="mx-auto mt-10 max-w-2xl rounded-xl border border-zinc-200 bg-white p-6 shadow-sm dark:border-zinc-800 dark:bg-zinc-900 sm:p-8">
            <Quote className="mx-auto mb-4 h-6 w-6 text-indigo-400" />
            <blockquote className="font-serif text-lg italic leading-relaxed text-foreground sm:text-xl">
              "Comecei minha vida como hei de acabá-la, sem dúvida: no meio dos
              livros. [...] Mas os livros foram meus passarinhos e meus ninhos,
              meus animais domésticos, meu estábulo e minha biblioteca; a
              biblioteca, num recanto, realizava o mundo em espessura e em
              fito, o feitiço enciclopédico."
            </blockquote>
            <p className="mt-4 font-serif text-sm not-italic text-zinc-500 dark:text-zinc-400">
              — Jean-Paul Sartre,{" "}
              <em className="text-indigo-600 dark:text-indigo-400">As Palavras</em>
            </p>
          </div>

          <p className="mx-auto mt-8 max-w-lg font-serif text-base italic text-zinc-600 dark:text-zinc-400">
            Os livros eram meus móveis e meus encargos.
          </p>

          <div className="mt-8 flex flex-col items-center justify-center gap-3 sm:flex-row">
            <Link
              href="/sign-in"
              className="inline-flex w-full items-center justify-center gap-2 rounded-full bg-indigo-600 px-8 py-3 text-base font-semibold text-white shadow-md transition-colors hover:bg-indigo-700 sm:w-auto"
            >
              Entrar
            </Link>
            <Link
              href="/sign-up"
              className="inline-flex w-full items-center justify-center gap-2 rounded-full border border-zinc-300 bg-white px-8 py-3 text-base font-semibold text-zinc-700 transition-colors hover:bg-zinc-50 dark:border-zinc-600 dark:bg-zinc-800 dark:text-zinc-300 dark:hover:bg-zinc-700 sm:w-auto"
            >
              Criar conta
            </Link>
          </div>
        </div>
      </section>
    </div>
  );
}
