"use client";

import { useRef, useState } from "react";
import { Send, Smile } from "lucide-react";

const EMOJIS = ["📚", "❤️", "✨", "😍", "🤔", "😂", "👏", "☕", "🌙", "🔥"];

export interface TextComposerProps {
  placeholder: string;
  submitLabel: string;
  onSubmit: (content: string) => void | Promise<void>;
  disabled?: boolean;
  compact?: boolean;
}

export function TextComposer({
  placeholder,
  submitLabel,
  onSubmit,
  disabled = false,
  compact = false,
}: TextComposerProps) {
  const [value, setValue] = useState("");
  const [emojiOpen, setEmojiOpen] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const addEmoji = (emoji: string) => {
    const textarea = textareaRef.current;
    const start = textarea?.selectionStart ?? value.length;
    const nextValue = `${value.slice(0, start)}${emoji}${value.slice(start)}`;
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
    if (!content || disabled || submitting) return;
    setError(null);
    setSubmitting(true);
    try {
      await onSubmit(content);
      setValue("");
      setEmojiOpen(false);
    } catch (reason: unknown) {
      setError(reason instanceof Error ? reason.message : "Não foi possível publicar.");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="relative">
      <textarea
        ref={textareaRef}
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
        className="w-full resize-none rounded-2xl border border-outline-variant/30 bg-surface-container-lowest px-4 py-3 pr-12 text-sm text-on-surface outline-none transition focus:border-primary placeholder:text-outline"
      />
      <div className="mt-2 flex items-center justify-between">
        <div className="flex items-center gap-1">
          <div className="relative">
            <button
              type="button"
              onClick={() => setEmojiOpen((open) => !open)}
              aria-label="Adicionar emoji"
              className="rounded-full p-2 text-on-surface-variant transition hover:bg-surface-container-high hover:text-primary"
            >
              <Smile className="h-4 w-4" />
            </button>
            {emojiOpen && (
              <div className="absolute bottom-full left-0 z-10 mb-2 flex w-52 flex-wrap gap-1 rounded-2xl border border-outline-variant/30 bg-surface-container-high p-2 shadow-xl">
                {EMOJIS.map((emoji) => (
                  <button
                    key={emoji}
                    type="button"
                    onClick={() => addEmoji(emoji)}
                    className="rounded-lg p-2 text-lg transition hover:bg-surface-bright"
                    aria-label={`Adicionar ${emoji}`}
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
          className="inline-flex items-center gap-2 rounded-full bg-primary-container px-4 py-2 text-xs font-semibold text-on-primary-container transition hover:brightness-110 disabled:cursor-not-allowed disabled:opacity-40"
        >
          <Send className="h-3.5 w-3.5" />
          {submitLabel}
        </button>
      </div>
      {error && <p className="mt-2 text-xs text-error">{error}</p>}
    </div>
  );
}
