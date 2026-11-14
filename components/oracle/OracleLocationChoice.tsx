"use client";

import { useEffect, useRef, useState } from "react";

type Center = { latitude: number; longitude: number };

export function OracleLocationChoice({ category, disabled, onSearch }: {
  category: string;
  disabled: boolean;
  onSearch: (question: string, center?: Center) => void;
}) {
  const [area, setArea] = useState("");
  const [status, setStatus] = useState("");
  const [pending, setPending] = useState(false);
  const [used, setUsed] = useState(false);
  const active = useRef(false);
  useEffect(() => {
    active.current = true;
    return () => { active.current = false; };
  }, []);

  function requestLocation() {
    if (!navigator.geolocation) {
      setStatus("A localização não está disponível neste navegador. Informe a cidade ou o bairro.");
      return;
    }
    setStatus("");
    setPending(true);
    navigator.geolocation.getCurrentPosition(({ coords }) => {
      if (!active.current) return;
      setPending(false);
      setUsed(true);
      onSearch(`Encontre ${category} perto de mim`, { latitude: coords.latitude, longitude: coords.longitude });
    }, error => {
      if (!active.current) return;
      setPending(false);
      setStatus(error.code === 1 ? "Permissão negada. Informe a cidade ou o bairro."
        : "Não consegui obter sua localização. Informe a cidade ou o bairro.");
    }, { enableHighAccuracy: false, timeout: 10000, maximumAge: 0 });
  }

  if (used) return null;
  return (
    <div className="grid gap-2 text-sm">
      <button type="button" disabled={disabled || pending} onClick={requestLocation}
        className="w-fit rounded-lg border border-primary px-3 py-2 text-primary disabled:opacity-50">
        {pending ? "Obtendo localização…" : "Usar minha localização"}
      </button>
      <p className="text-on-surface-variant">A localização é enviada ao Brave somente para esta busca.</p>
      <form className="flex flex-wrap items-end gap-2" onSubmit={event => {
        event.preventDefault();
        if (!area.trim()) return;
        setUsed(true);
        onSearch(`Encontre ${category} em "${area.trim()}"`);
      }}>
        <label className="grid gap-1">Cidade ou bairro
          <input required maxLength={100} value={area} onChange={event => setArea(event.target.value)}
            className="min-w-0 rounded-lg border border-outline-variant bg-surface px-3 py-2" />
        </label>
        <button type="submit" disabled={disabled || pending} className="rounded-lg border border-outline-variant px-3 py-2">Buscar</button>
      </form>
      {status && <p role="status">{status}</p>}
    </div>
  );
}
