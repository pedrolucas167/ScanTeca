"use client";

import { useEffect, useState } from "react";
import {
  analyticsChoices,
  analyticsCookie,
  analyticsPreferenceAge,
  browserAnalyticsPreference,
  type AnalyticsPreference,
} from "@/lib/analytics-preference";
import WebVitals from "./WebVitals";

const choiceClass = "rounded-md border border-current px-3 py-2 font-medium hover:bg-black/5 dark:hover:bg-white/10";

export default function AnalyticsConsent({ initialPreference }: { initialPreference: AnalyticsPreference }) {
  const [preference, setPreference] = useState(initialPreference);
  const [editing, setEditing] = useState(false);
  const [canMeasureLoad, setCanMeasureLoad] = useState(initialPreference === "accepted");
  const [saveFailed, setSaveFailed] = useState(false);
  const open = editing || preference === null;

  useEffect(() => {
    function syncPreference() {
      const current = browserAnalyticsPreference();
      setPreference(current);
      if (current !== "accepted") setCanMeasureLoad(false);
    }
    window.addEventListener("focus", syncPreference);
    return () => window.removeEventListener("focus", syncPreference);
  }, []);

  function choose(choice: Exclude<AnalyticsPreference, null>) {
    const secure = window.location.protocol === "https:" ? "; Secure" : "";
    document.cookie = `${analyticsCookie}=${analyticsChoices[choice]}; Path=/; Max-Age=${analyticsPreferenceAge}; SameSite=Strict${secure}`;
    const saved = browserAnalyticsPreference();
    setSaveFailed(saved !== choice);
    setPreference(saved === choice ? saved : null);
    setEditing(saved !== choice);
    if (choice === "rejected" || saved !== choice) setCanMeasureLoad(false);
  }

  return (
    <>
      <button type="button" onClick={() => setEditing(true)} aria-expanded={open} aria-controls={open ? "analytics-preferences" : undefined} className="underline underline-offset-4">
        Preferências de métricas
      </button>
      {open && (
        <section id="analytics-preferences" aria-label="Métricas opcionais" className="fixed inset-x-3 bottom-20 z-[60] mx-auto max-w-xl rounded-xl border border-outline-variant bg-surface p-4 text-sm text-on-surface shadow-lg">
          <p className="font-semibold">Métricas opcionais da ScanTeca</p>
          <p className="mt-1">
            Se você permitir, contamos visitas e faixas de desempenho na inicial, no Manifesto e no Feed. Guardamos somente totais diários por até 30 dias, sem conteúdo, identificadores ou caminhos pessoais. Sua escolha vale por até 180 dias neste navegador e pode ser alterada pelo rodapé.
          </p>
          <div className="mt-3 flex flex-wrap gap-2">
            <button type="button" className={choiceClass} onClick={() => choose("rejected")}>Recusar métricas</button>
            <button type="button" className={choiceClass} onClick={() => choose("accepted")}>Permitir métricas</button>
          </div>
          {saveFailed && <p role="alert" className="mt-2">Não foi possível salvar a preferência neste navegador.</p>}
        </section>
      )}
      {preference === "accepted" && <WebVitals measureLoad={canMeasureLoad} />}
    </>
  );
}
