"use client";

import { useEffect, useId, useRef, useState } from "react";
import { Send, Smile, Quote, X } from "lucide-react";

const EMOJIS = [
  ["📚", "livros"], ["❤️", "coração"], ["✨", "brilhos"], ["😍", "encantado"],
  ["🤔", "pensativo"], ["😂", "risada"], ["👏", "palmas"], ["☕", "café"],
  ["🌙", "lua"], ["🔥", "fogo"],
] as const;

export interface TextComposerProps {
  placeholder: string;
  submitLabel: string;
  onSubmit: (content: string) => void | Promise<void>;
  disabled?: boolean;
  compact?: boolean;
  quotedPost?: {
    author: string;
    text: string;
  } | null;
  onCancelQuote?: () => void;
}

export function TextComposer({
  placeholder,
  submitLabel,
  onSubmit,
  disabled = false,
  compact = false,
  quotedPost,
  onCancelQuote,
}: TextComposerProps) {
  const [value, setValue] = useState("");
  const [emojiOpen, setEmojiOpen] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [status, setStatus] = useState("");
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const emojiRoot = useRef<HTMLDivElement>(null);
  const emojiTrigger = useRef<HTMLButtonElement>(null);
  const submittingRef = useRef(false);
  const id = useId();

  useEffect(() => {
    if (!emojiOpen) return;
    const outside = (event: PointerEvent) => {
      if (!emojiRoot.current?.contains(event.target as Node)) setEmojiOpen(false);
    };
    document.addEventListener("pointerdown", outside);
    return () => document.removeEventListener("pointerdown", outside);
  }, [emojiOpen]);

  const addEmoji = (emoji: string) => {
    const textarea = textareaRef.current;
    const start = textarea?.selectionStart ?? value.length;
    const end = textarea?.selectionEnd ?? start;
    const nextValue = `${value.slice(0, start)}${emoji}${value.slice(end)}`;
    if (nextValue.length > 1000) return;
    setValue(nextValue);
    setEmojiOpen(false);
    requestAnimationFrame(() => {
      textarea?.focus();
      const cursor = start + emoji.length;
      textarea?.setSelectionRange(cursor, cursor);
    });
  };

  const submit = async () => {
    const content = value.trim();
    if (!content || disabled || submittingRef.current) return;
    submittingRef.current = true;
    setError(null);
    setStatus("");
    setSubmitting(true);
    try {
      await onSubmit(content);
      setValue("");
      setEmojiOpen(false);
      setStatus(compact ? "Comentário enviado." : "Publicação enviada.");
    } catch (reason: unknown) {
      setError(reason instanceof Error ? reason.message : "Não foi possível publicar.");
    } finally {
      submittingRef.current = false;
      setSubmitting(false);
    }
  };

  return (
    <div className="relative">
      {quotedPost && (
        <div className="mb-2 flex items-center justify-between rounded-xl border border-outline-variant/30 bg-surface-container-low px-3 py-2">
          <div className="flex items-center gap-2 text-xs">
            <Quote className="h-3 w-3 text-primary" />
            <span className="font-semibold text-primary">{quotedPost.author}</span>
            <span className="text-on-surface-variant line-clamp-1">{quotedPost.text}</span>
          </div>
          {onCancelQuote && (
            <button
              type="button"
              onClick={onCancelQuote}
              disabled={disabled || submitting}
              className="flex min-h-11 min-w-11 shrink-0 items-center justify-center rounded-full p-1 text-on-surface-variant hover:bg-surface-container-high disabled:opacity-50"
              aria-label="Cancelar citação"
            >
              <X className="h-3 w-3" />
            </button>
          )}
        </div>
      )}
      <textarea
        ref={textareaRef}
        disabled={disabled || submitting}
        value={value}
        maxLength={1000}
        rows={compact ? 2 : 3}
        onChange={(event) => setValue(event.target.value)}
        onKeyDown={(event) => {
          if ((event.metaKey || event.ctrlKey) && event.key === "Enter") {
            event.preventDefault();
            void submit();
          }
        }}
        placeholder={placeholder}
        aria-label={placeholder}
        aria-describedby={error ? `${id}-error` : undefined}
        className="w-full resize-none rounded-2xl border border-outline-variant/30 bg-surface-container-lowest px-4 py-3 pr-12 text-sm text-on-surface outline-none transition focus:border-primary placeholder:text-outline"
      />
      <div className="mt-2 flex items-center justify-between">
        <div className="flex items-center gap-1">
          <div ref={emojiRoot} className="relative"
            onKeyDown={event => {
              if (event.key === "Escape" && emojiOpen) {
                event.preventDefault(); setEmojiOpen(false); emojiTrigger.current?.focus();
              }
            }}
            onBlur={event => {
              if (!event.currentTarget.contains(event.relatedTarget as Node | null)) setEmojiOpen(false);
            }}
          >
            <button
              ref={emojiTrigger}
              type="button"
              onClick={() => setEmojiOpen((open) => !open)}
              aria-label="Adicionar emoji"
              aria-expanded={emojiOpen}
              aria-controls={`${id}-emojis`}
              disabled={disabled || submitting}
              className="flex min-h-11 min-w-11 items-center justify-center rounded-full p-2 text-on-surface-variant transition hover:bg-surface-container-high hover:text-primary disabled:opacity-50"
            >
              <Smile className="h-4 w-4" />
            </button>
            {emojiOpen && (
              <div id={`${id}-emojis`} role="group" aria-label="Emojis" className="absolute bottom-full left-0 z-10 mb-2 flex w-64 max-w-[calc(100vw-3rem)] flex-wrap gap-1 rounded-2xl border border-outline-variant/30 bg-surface-container-high p-2 shadow-xl">
                {EMOJIS.map(([emoji, label]) => (
                  <button
                    key={emoji}
                    type="button"
                    onClick={() => addEmoji(emoji)}
                    className="flex min-h-11 min-w-11 items-center justify-center rounded-lg p-2 text-lg transition hover:bg-surface-bright"
                    aria-label={`Adicionar ${label}`}
                  >
                    {emoji}
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>
        <button
          type="button"
          onClick={() => void submit()}
          disabled={!value.trim() || disabled || submitting}
          aria-busy={submitting}
          className="inline-flex min-h-11 items-center gap-2 rounded-full bg-primary-container px-4 py-2 text-xs font-semibold text-on-primary-container transition hover:brightness-110 disabled:cursor-not-allowed disabled:opacity-40"
        >
          <Send className="h-3.5 w-3.5" />
          {submitting ? "Enviando..." : submitLabel}
        </button>
      </div>
      <p role="status" className={status || submitting ? "mt-2 text-xs text-on-surface-variant" : "sr-only"}>{submitting ? "Enviando conteúdo..." : status}</p>
      {error && <p id={`${id}-error`} role="alert" className="mt-2 text-xs text-error">{error}</p>}
    </div>
  );
}
