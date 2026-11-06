import Link from "next/link";

export default function PrivacySettings() {
  return (
    <section aria-labelledby="privacy-heading" className="my-8 space-y-4 rounded-xl border border-outline-variant p-4">
      <h2 id="privacy-heading" className="text-lg font-semibold">Privacidade</h2>
      <p className="text-sm">Baixe um arquivo JSON com os dados disponíveis da sua conta. Guarde-o em um local seguro.</p>
      <a href="/api/privacy/export" className="inline-block rounded-md bg-indigo-700 px-4 py-2 font-medium text-white">Baixar meus dados</a>
      <p className="text-sm">
        Consulte o <Link href="/privacidade" className="underline">Aviso de Privacidade</Link> ou escreva para{" "}
        <a className="underline" href="mailto:pedro_marques_dev@hotmail.com">pedro_marques_dev@hotmail.com</a>.
      </p>
    </section>
  );
}
