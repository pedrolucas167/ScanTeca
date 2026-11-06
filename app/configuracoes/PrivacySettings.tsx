"use client";

import { useActionState, useState } from "react";
import { saveCity } from "./privacy-actions";

export default function PrivacySettings({ initialCity }: { initialCity: string }) {
  const [city, setCity] = useState(initialCity);
  const [message, action, pending] = useActionState(saveCity, "");

  return (
    <section aria-labelledby="privacy-heading" className="my-8 space-y-4 rounded-xl border border-outline-variant p-4">
      <h2 id="privacy-heading" className="text-lg font-semibold">Privacidade</h2>
      <form action={action} className="space-y-2">
        <label htmlFor="privacy-city" className="block font-medium">Cidade (opcional)</label>
        <p id="city-help" className="text-sm">Visível só nas configurações da sua conta e na sua exportação. Para remover, limpe o campo e salve.</p>
        <input id="privacy-city" name="city" maxLength={100} aria-describedby="city-help" value={city}
          onChange={event => setCity(event.target.value)} className="block w-full rounded-md border border-outline-variant bg-surface px-3 py-2" />
        <button type="submit" disabled={pending} className="rounded-md border border-outline-variant px-3 py-2">
          {pending ? "Salvando…" : "Salvar cidade"}
        </button>
        {message && <p role="status" className="text-sm">{message}</p>}
      </form>
      <div className="space-y-2 border-t border-outline-variant pt-4">
        <a href="/api/privacy/export" className="inline-block rounded-md bg-indigo-700 px-4 py-2 font-medium text-white">Baixar meus dados</a>
        <p className="text-sm">Baixe um arquivo JSON com os dados disponíveis da sua conta. Ele pode conter informações privadas. Guarde-o em um local seguro.</p>
        <p className="text-sm">Para outros pedidos de privacidade, escreva para{" "}
          <a className="underline" href="mailto:pedro_marques_dev@hotmail.com">pedro_marques_dev@hotmail.com</a>.
        </p>
      </div>
    </section>
  );
}
