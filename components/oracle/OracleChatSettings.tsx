"use client";

import { useEffect, useRef, useState } from "react";
import { Icon } from "@/components/ui/Icon";
import { ORACLE_MODES, type OracleMode } from "@/lib/constants/oracle";

interface Props {
  mode: OracleMode;
  onModeChange: (mode: OracleMode) => void;
  scope: "library" | "all";
  onScopeChange: (scope: "library" | "all") => void;
  temperature: number;
  onTemperatureChange: (value: number) => void;
  voiceOn: boolean;
  onVoiceChange: () => void;
  playbackRate: number;
  onPlaybackRateChange: () => void;
  onOpenMemory: () => void;
  onClear: () => void;
  canClear: boolean;
}

const control = "flex min-h-11 items-center gap-2 rounded-lg border border-outline-variant/40 px-3 py-2 text-left text-sm transition-colors hover:border-primary/60";

export function OracleChatSettings(props: Props) {
  const [open, setOpen] = useState(false);
  const container = useRef<HTMLDivElement>(null);
  const trigger = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (!open) return;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setOpen(false);
        trigger.current?.focus();
      }
    };
    const onPointerDown = (event: PointerEvent) => {
      if (event.target instanceof Node && !container.current?.contains(event.target)) setOpen(false);
    };
    document.addEventListener("keydown", onKeyDown);
    document.addEventListener("pointerdown", onPointerDown);
    return () => {
      document.removeEventListener("keydown", onKeyDown);
      document.removeEventListener("pointerdown", onPointerDown);
    };
  }, [open]);

  const finish = (action: () => void) => {
    setOpen(false);
    trigger.current?.focus();
    action();
  };

  return (
    <div ref={container} className="relative shrink-0">
      <button ref={trigger} type="button" aria-label="Ajustes da conversa" aria-expanded={open} aria-controls="oracle-chat-settings" onClick={() => setOpen(value => !value)} className="flex h-11 w-11 items-center justify-center rounded-full text-on-surface-variant hover:bg-surface-container-high">
        <Icon decorative name="tune" className="text-xl" />
      </button>
      {open && (
        <section id="oracle-chat-settings" aria-label="Ajustes da conversa" className="absolute right-0 top-full z-[60] mt-2 max-h-[min(36rem,calc(var(--oracle-viewport-height,100dvh)-6rem))] w-80 max-w-[calc(100vw-1.5rem)] space-y-4 overflow-y-auto overscroll-contain rounded-2xl border border-outline-variant/40 bg-surface-container p-4 shadow-xl">
          <h2 className="text-base font-semibold">Ajustes da conversa</h2>
          <fieldset>
            <legend className="mb-2 text-sm text-on-surface-variant">Como posso ajudar?</legend>
            <div className="grid grid-cols-2 gap-2">
              {ORACLE_MODES.map(item => (
                <button key={item.id} type="button" aria-pressed={props.mode === item.id} onClick={() => props.onModeChange(item.id)} className={`${control} ${props.mode === item.id ? "border-primary bg-primary-container/15 text-primary" : "text-on-surface-variant"}`}>
                  <Icon decorative name={item.icon} className="text-base" />{item.label}
                </button>
              ))}
            </div>
          </fieldset>
          <fieldset>
            <legend className="mb-2 text-sm text-on-surface-variant">Onde buscar livros?</legend>
            <div className="grid grid-cols-2 gap-2">
              <button type="button" aria-pressed={props.scope === "library"} onClick={() => props.onScopeChange("library")} className={`${control} ${props.scope === "library" ? "border-primary text-primary" : ""}`}>Meu acervo</button>
              <button type="button" aria-pressed={props.scope === "all"} onClick={() => props.onScopeChange("all")} className={`${control} ${props.scope === "all" ? "border-primary text-primary" : ""}`}>Acervo + catálogo</button>
            </div>
          </fieldset>
          <label className="block text-sm">
            Criatividade da resposta <span className="text-primary">{props.temperature.toFixed(1)}</span>
            <input aria-label="Criatividade da resposta" type="range" min={0} max={2} step={0.1} value={props.temperature} onChange={event => props.onTemperatureChange(Number(event.target.value))} className="mt-1 block h-11 w-full accent-primary" />
          </label>
          <div className="grid gap-2 border-t border-outline-variant/30 pt-3">
            <button type="button" onClick={() => finish(props.onOpenMemory)} className={control}><Icon decorative name="psychology" />Minha memória</button>
            <button type="button" aria-pressed={props.voiceOn} onClick={props.onVoiceChange} className={control}><Icon decorative name="voice_chat" />{props.voiceOn ? "Desativar voz" : "Ativar voz"}</button>
            <button type="button" onClick={props.onPlaybackRateChange} className={control}>Velocidade da voz: {props.playbackRate.toLocaleString("pt-BR")}x</button>
            {props.canClear && <button type="button" onClick={() => finish(props.onClear)} className={`${control} text-error`}><Icon decorative name="delete" />Limpar conversa</button>}
          </div>
        </section>
      )}
    </div>
  );
}
