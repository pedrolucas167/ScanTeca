"use client";

import { useEffect, useId, type RefObject } from "react";
import { Icon } from "@/components/ui/Icon";

interface Props {
  inputRef: RefObject<HTMLTextAreaElement | null>;
  value: string;
  onChange: (value: string) => void;
  onSend: (value: string) => void;
  loading: boolean;
  recording: boolean;
  transcribing: boolean;
  micSupported: boolean;
  onMic: () => void;
  onStop: () => void;
}

export function OracleComposer({ inputRef, value, onChange, onSend, loading, recording, transcribing, micSupported, onMic, onStop }: Props) {
  const statusId = useId();
  const disabled = loading || recording || transcribing;
  const send = () => {
    if (!disabled && value.trim()) onSend(value.trim());
  };

  useEffect(() => {
    const input = inputRef.current;
    if (!input) return;
    input.style.height = "auto";
    input.style.height = `${Math.min(Math.max(input.scrollHeight, 44), 128)}px`;
  }, [value, inputRef]);

  return (
    <>
      <p id={statusId} role="status" className={recording || transcribing ? "pb-2 text-xs text-on-surface-variant" : "sr-only"}>
        {transcribing ? "Transcrevendo áudio…" : recording ? "Gravando áudio. Pare a gravação para revisar o texto." : "Escreva sua pergunta. No celular, Enter cria uma nova linha; use Enviar para enviar."}
      </p>
      <form aria-label="Mensagem para o Oráculo" aria-busy={loading || transcribing} onSubmit={event => { event.preventDefault(); send(); }} className="flex min-w-0 items-end gap-1 rounded-[26px] border border-outline-variant/50 bg-surface-container p-1.5 shadow-lg focus-within:border-primary/70">
        <textarea
          ref={inputRef}
          aria-label="Sua mensagem"
          aria-describedby={statusId}
          rows={1}
          value={value}
          onChange={event => onChange(event.target.value)}
          onKeyDown={event => {
            if (event.key !== "Enter" || event.shiftKey || event.nativeEvent.isComposing || event.keyCode === 229) return;
            const mobile = window.matchMedia("(max-width: 767px), (pointer: coarse)").matches;
            if (!mobile || event.ctrlKey || event.metaKey) {
              event.preventDefault();
              send();
            }
          }}
          placeholder={recording ? "Gravando áudio…" : "Pergunte à sua estante…"}
          disabled={disabled}
          className="min-h-11 min-w-0 max-h-32 flex-1 resize-none self-center rounded-2xl border-0 bg-transparent px-3 py-2.5 text-base leading-6 text-on-surface placeholder:text-outline focus:outline-none focus:ring-0 disabled:opacity-60"
        />
        {micSupported && (
          <button type="button" onClick={onMic} disabled={loading || transcribing} aria-label={recording ? "Parar e transcrever" : "Gravar áudio para revisar"} aria-pressed={recording} className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-full disabled:opacity-50 ${recording ? "bg-error-container text-error" : "text-on-surface-variant hover:bg-surface-container-high"}`}>
            <Icon decorative name={recording ? "stop" : "mic"} className="text-xl" />
          </button>
        )}
        {loading ? (
          <button type="button" onClick={onStop} aria-label="Parar geração" className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-error-container text-error"><Icon decorative name="stop" className="text-xl" /></button>
        ) : (
          <button type="submit" disabled={!value.trim() || recording || transcribing} aria-label="Enviar mensagem" className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-primary-container text-on-primary-container transition-opacity disabled:opacity-40"><Icon decorative name="arrow_upward" className="text-xl" /></button>
        )}
      </form>
    </>
  );
}
