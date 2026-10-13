import { auth } from "@clerk/nextjs/server";
import { getReadingPage } from "@/modules/reading";
import { notFound } from "next/navigation";

import { addAnnotation } from "./actions";

export default async function LeituraPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const { userId } = await auth();
  if (!userId) notFound();
  const result = await getReadingPage(userId, id);
  if (!result) notFound();
  const { book, passage, annotations } = result;

  return (
    <main className="min-h-screen bg-[#111319] text-[#e2e2eb] font-[Inter]">
      <header className="border-b border-[#33343b] p-6 flex items-center justify-between">
        <div>
          <h1 className="font-[Playfair_Display] text-3xl font-semibold">{book.title}</h1>
          <p className="text-sm text-[#c8c4d7]">{book.author}</p>
        </div>
        <span className="material-symbols-outlined text-2xl text-[#ccbeff]">menu_book</span>
      </header>

      <section className="max-w-5xl mx-auto grid lg:grid-cols-[1fr_380px] gap-8 p-6">
        {/* Coluna de texto / leitura */}
        <article className="bg-[#1e1f26] rounded-3xl p-8 leading-loose text-lg shadow-xl">
          <h2 className="font-[Playfair_Display] text-2xl mb-6">Leitura social & marginalia</h2>
          <div className="prose prose-invert text-[#e2e2eb]/90">
            <p className="first-letter:font-[Playfair_Display] first-letter:text-5xl first-letter:mr-2">
              {passage ? "Aqui começa o trecho do livro..." : "Sem trecho cadastrado. Cadastre o texto do livro para ativar a marginalia."}
            </p>
          </div>

          {passage && (
            <div className="mt-6 pt-6 border-t border-[#33343b]">
              <h3 className="font-[Playfair_Display] text-xl mb-4">Marginalia coletiva</h3>
              <ul className="space-y-4">
                {annotations.map((a) => (
                  <li key={a.id} className="bg-[#0c0e14] rounded-2xl p-4 border-l-4 border-[#5b50e6]">
                    <div className="flex items-center gap-2 mb-2 text-sm text-[#c8c4d7]">
                      <span className="font-medium text-[#ccbeff]">Leitor</span>
                      <span>• {a.type}</span>
                    </div>
                    <p className="text-base">{a.content}</p>
                  </li>
                ))}
                {annotations.length === 0 && (
                  <li className="text-[#c8c4d7] italic">Nenhuma anotação neste trecho ainda.</li>
                )}
              </ul>
            </div>
          )}
        </article>

        {/* Coluna lateral — comentários / anotação */}
        <aside className="bg-[#1e1f26] rounded-3xl p-6 h-fit shadow-xl">
          <h3 className="font-[Playfair_Display] text-xl mb-4">Deixe sua marginalia</h3>
          <form
            action={async (formData: FormData) => {
              "use server";
              await addAnnotation(formData, id, passage?.id ?? "");
            }}
            className="space-y-3"
          >
            <textarea
              name="content"
              rows={4}
              className="w-full bg-[#0c0e14] border border-[#33343b] rounded-2xl p-4 text-sm focus:outline-none focus:border-[#5b50e6] resize-none"
              placeholder="Comentário, destaque ou reação..."
              required
            />
            <button
              type="submit"
              className="w-full bg-[#5b50e6] hover:bg-[#5145dc] text-white font-medium rounded-2xl py-3 transition-colors"
            >
              Publicar marginalia
            </button>
          </form>
        </aside>
      </section>
    </main>
  );
}
