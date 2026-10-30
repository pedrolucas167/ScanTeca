"use client";

import { useEffect, useRef, useState } from "react";
import { Icon } from "@/components/ui/Icon";

interface Memory {
  oracleProfile: string | null;
  oracleMemoryEnabled: boolean;
  oracleProfileVersion: number;
}

function readMemory(data: { setting?: Partial<Memory> }): Memory {
  const memory = data.setting;
  if (!memory || (memory.oracleProfile !== null && typeof memory.oracleProfile !== "string") ||
      typeof memory.oracleMemoryEnabled !== "boolean" || !Number.isInteger(memory.oracleProfileVersion) ||
      (memory.oracleProfileVersion ?? -1) < 0) throw new Error("Não foi possível carregar a memória.");
  return memory as Memory;
}

export function OracleMemoryDialog({ onClose }: { onClose: () => void }) {
  const dialog = useRef<HTMLDialogElement>(null);
  const keepDraft = useRef(false);
  const [memory, setMemory] = useState<Memory | null>(null);
  const [draft, setDraft] = useState("");
  const [enabled, setEnabled] = useState(true);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [conflict, setConflict] = useState(false);
  const [status, setStatus] = useState("");
  const [reload, setReload] = useState(0);
  const [showCurrent, setShowCurrent] = useState(false);

  useEffect(() => {
    const previous = document.activeElement;
    const element = dialog.current!;
    element.showModal();
    return () => {
      element.close();
      if (previous instanceof HTMLElement && previous.isConnected) previous.focus();
    };
  }, []);

  useEffect(() => {
    const controller = new AbortController();
    fetch("/api/library-settings", { cache: "no-store", signal: controller.signal })
      .then(async response => {
        if (!response.ok) throw new Error("Não foi possível carregar a memória.");
        return readMemory(await response.json());
      }).then(value => {
        if (controller.signal.aborted) return;
        setMemory(value);
        if (keepDraft.current) {
          setShowCurrent(true);
          setStatus("Versão atual carregada. Confira seu rascunho antes de salvar.");
        } else {
          setDraft(value.oracleProfile ?? "");
          setEnabled(value.oracleMemoryEnabled);
        }
      }).catch(() => {
        if (!controller.signal.aborted) setError("Não foi possível carregar a memória. Tente novamente.");
      }).finally(() => {
        if (!controller.signal.aborted) setLoading(false);
      });
    return () => controller.abort();
  }, [reload]);

  const reloadMemory = () => {
    keepDraft.current = Boolean(memory) || keepDraft.current;
    setMemory(null);
    setShowCurrent(false);
    setLoading(true);
    setError(null);
    setConflict(false);
    setStatus("");
    setReload(value => value + 1);
  };

  const save = async (forget = false) => {
    if (!memory || loading || saving || conflict) return;
    setSaving(true);
    setError(null);
    setStatus("");
    try {
      const response = await fetch("/api/library-settings", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ oracleProfile: forget ? null : draft.trim() || null,
          oracleMemoryEnabled: forget ? false : enabled, oracleProfileVersion: memory.oracleProfileVersion }),
      });
      if (response.status === 409) {
        setConflict(true);
        throw new Error("A memória mudou em outra conversa. Seu rascunho foi preservado; recarregue para ver a versão atual.");
      }
      if (!response.ok) throw new Error("Não foi possível salvar a memória. Seu rascunho foi preservado.");
      const value = readMemory(await response.json());
      setMemory(value);
      setDraft(value.oracleProfile ?? "");
      setEnabled(value.oracleMemoryEnabled);
      keepDraft.current = false;
      setShowCurrent(false);
      setStatus(forget ? "Memória apagada. Aprendizado pausado." : "Memória salva.");
    } catch (failure) {
      setError(failure instanceof Error ? failure.message : "Não foi possível salvar a memória.");
    } finally { setSaving(false); }
  };

  return (
    <dialog ref={dialog} aria-labelledby="oracle-memory-title" aria-describedby="oracle-memory-description"
      onCancel={event => { event.preventDefault(); if (!saving) onClose(); }}
      className="m-auto max-h-[calc(100dvh-2rem)] w-[calc(100%-2rem)] max-w-lg overflow-y-auto rounded-2xl border border-outline-variant/30 bg-surface-container p-5 text-on-surface shadow-2xl backdrop:bg-black/60 backdrop:backdrop-blur-sm">
      <div className="mb-4 flex items-start justify-between gap-3">
        <div>
          <h2 id="oracle-memory-title" className="font-headline-sm text-headline-sm font-semibold">Memória do leitor</h2>
          <p id="oracle-memory-description" className="mt-1 text-sm text-on-surface-variant">Confira e corrija as preferências e os objetivos usados pelo Oráculo.</p>
        </div>
        <button type="button" onClick={onClose} disabled={saving} aria-label="Fechar memória" className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full hover:bg-surface-container-high disabled:opacity-50"><Icon decorative name="close" /></button>
      </div>
      {loading ? <p role="status">Carregando memória...</p> : (
        <form onSubmit={event => { event.preventDefault(); void save(); }} className="space-y-4">
          <label className="block text-sm font-medium" htmlFor="oracle-memory-profile">Preferências e objetivos</label>
          <textarea id="oracle-memory-profile" value={draft} onChange={event => setDraft(event.target.value)} maxLength={2000} rows={6} disabled={!memory || saving}
            placeholder="Autores, gêneros, temas e objetivos de leitura..." className="w-full resize-y rounded-xl border border-outline-variant/40 bg-surface-container-lowest p-3 text-base outline-none focus:border-primary disabled:opacity-50" />
          {showCurrent && memory && <details className="rounded-xl border border-outline-variant/40 p-3 text-sm">
            <summary className="cursor-pointer font-medium">Ver memória atualmente salva</summary>
            <p className="mt-2 whitespace-pre-wrap">{memory.oracleProfile || "Nenhuma preferência salva."}</p>
            <p className="mt-2 text-on-surface-variant">{memory.oracleMemoryEnabled ? "Aprendizado ativo na versão salva." : "Aprendizado pausado na versão salva."}</p>
          </details>}
          <label className="flex min-h-11 items-center gap-3 text-sm">
            <input type="checkbox" checked={enabled} onChange={event => setEnabled(event.target.checked)} disabled={!memory || saving} className="h-5 w-5 accent-primary" />
            Aprender com as próximas conversas
          </label>
          <p className="text-sm text-on-surface-variant">Ao pausar, as preferências salvas continuam sendo usadas. Apagar a memória também pausa o aprendizado; as mensagens do histórico continuam na conversa.</p>
          <div className="flex flex-wrap justify-between gap-3">
            <button type="button" onClick={() => void save(true)} disabled={!memory || saving || conflict || (!memory.oracleProfile && !memory.oracleMemoryEnabled)} className="min-h-11 rounded-full border border-error/30 px-4 py-2 text-sm text-error disabled:opacity-40">Apagar memória e pausar</button>
            <button type="submit" disabled={!memory || saving || conflict} className="min-h-11 rounded-full bg-primary-container px-4 py-2 text-sm font-semibold text-on-primary-container disabled:opacity-50">{saving ? "Salvando..." : "Salvar memória"}</button>
          </div>
        </form>
      )}
      {error && <div className="mt-4 space-y-2"><p role="alert" className="text-sm text-error">{error}</p>{(!memory || conflict) && <button type="button" disabled={loading} onClick={reloadMemory} className="min-h-11 rounded-full border border-outline-variant/40 px-4 py-2 text-sm">Recarregar memória</button>}</div>}
      {status && <p role="status" className="mt-4 text-sm text-primary">{status}</p>}
    </dialog>
  );
}
