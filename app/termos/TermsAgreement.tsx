"use client";

import { useActionState } from "react";
import { acceptTerms } from "./actions";
import { termsVersion } from "./version";

export default function TermsAgreement() {
  const [state, action, pending] = useActionState(acceptTerms, { error: "" });

  return (
    <form action={action} className="mt-6 space-y-3 border-t border-outline-variant pt-5">
      <input type="hidden" name="version" value={termsVersion} />
      <label className="flex items-start gap-2">
        <input className="mt-1" type="checkbox" name="agreement" value="accepted" required />
        <span>Li e aceito os termos de uso desta versão.</span>
      </label>
      <button type="submit" disabled={pending} className="rounded-md bg-indigo-700 px-4 py-2 font-medium text-white disabled:opacity-60">
        {pending ? "Registrando aceite…" : "Aceitar termos e continuar"}
      </button>
      {state.error && <p role="alert" className="text-sm text-red-700 dark:text-red-300">{state.error}</p>}
    </form>
  );
}
