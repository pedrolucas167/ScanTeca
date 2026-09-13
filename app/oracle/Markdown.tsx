import type { ReactNode } from "react";

/**
 * Renderer de Markdown leve para as respostas do Oráculo.
 * Suporta: parágrafos, títulos (#/##/###), listas (-/* e 1.), citações (>),
 * separadores (---), blocos de código (```), e inline: **negrito**, *itálico*,
 * `código`. Tolerante a markdown incompleto durante o streaming.
 */

type Block =
  | { type: "code"; content: string }
  | { type: "heading"; level: number; text: string }
  | { type: "quote"; lines: string[] }
  | { type: "list"; ordered: boolean; items: string[] }
  | { type: "hr" }
  | { type: "paragraph"; text: string };

function parseBlocks(content: string): Block[] {
  const lines = content.split("\n");
  const blocks: Block[] = [];
  let i = 0;

  while (i < lines.length) {
    const line = lines[i];

    // Bloco de código fenced
    if (line.trimStart().startsWith("```")) {
      const buf: string[] = [];
      i++;
      while (i < lines.length && !lines[i].trimStart().startsWith("```")) {
        buf.push(lines[i]);
        i++;
      }
      i++; // fecha o fence (ou EOF durante stream)
      blocks.push({ type: "code", content: buf.join("\n") });
      continue;
    }

    // Título
    const heading = /^(#{1,3})\s+(.+)$/.exec(line);
    if (heading) {
      blocks.push({
        type: "heading",
        level: heading[1].length,
        text: heading[2],
      });
      i++;
      continue;
    }

    // Separador
    if (/^\s*(-{3,}|\*{3,}|_{3,})\s*$/.test(line)) {
      blocks.push({ type: "hr" });
      i++;
      continue;
    }

    // Citação (linhas consecutivas com >)
    if (/^\s*>\s?/.test(line)) {
      const buf: string[] = [];
      while (i < lines.length && /^\s*>\s?/.test(lines[i])) {
        buf.push(lines[i].replace(/^\s*>\s?/, ""));
        i++;
      }
      blocks.push({ type: "quote", lines: buf });
      continue;
    }

    // Lista não ordenada
    if (/^\s*[-*]\s+/.test(line)) {
      const items: string[] = [];
      while (i < lines.length && /^\s*[-*]\s+/.test(lines[i])) {
        items.push(lines[i].replace(/^\s*[-*]\s+/, ""));
        i++;
      }
      blocks.push({ type: "list", ordered: false, items });
      continue;
    }

    // Lista ordenada
    if (/^\s*\d+[.)]\s+/.test(line)) {
      const items: string[] = [];
      while (i < lines.length && /^\s*\d+[.)]\s+/.test(lines[i])) {
        items.push(lines[i].replace(/^\s*\d+[.)]\s+/, ""));
        i++;
      }
      blocks.push({ type: "list", ordered: true, items });
      continue;
    }

    // Linha em branco
    if (!line.trim()) {
      i++;
      continue;
    }

    // Parágrafo (linhas consecutivas de texto)
    const buf: string[] = [];
    while (
      i < lines.length &&
      lines[i].trim() &&
      !/^(#{1,3}\s|```|\s*[-*]\s|\s*\d+[.)]\s|\s*>\s?|\s*(-{3,}|\*{3,}|_{3,})\s*$)/.test(
        lines[i]
      )
    ) {
      buf.push(lines[i]);
      i++;
    }
    blocks.push({ type: "paragraph", text: buf.join("\n") });
  }

  return blocks;
}

const INLINE_RE = /(\*\*[^*]+\*\*|\*[^*\n]+\*|`[^`]+`)/g;

function renderInline(text: string): ReactNode[] {
  const parts = text.split(INLINE_RE);
  return parts.map((part, i) => {
    if (part.startsWith("**") && part.endsWith("**") && part.length > 4) {
      return (
        <strong key={i} className="font-semibold text-on-surface">
          {part.slice(2, -2)}
        </strong>
      );
    }
    if (part.startsWith("*") && part.endsWith("*") && part.length > 2) {
      return <em key={i}>{part.slice(1, -1)}</em>;
    }
    if (part.startsWith("`") && part.endsWith("`") && part.length > 2) {
      return (
        <code
          key={i}
          className="rounded bg-surface-container-high px-1 py-0.5 font-mono text-[0.85em] text-primary"
        >
          {part.slice(1, -1)}
        </code>
      );
    }
    return part;
  });
}

const HEADING_CLASS: Record<number, string> = {
  1: "mt-4 mb-2 font-headline-md text-lg font-semibold text-on-surface first:mt-0",
  2: "mt-4 mb-2 font-headline-md text-base font-semibold text-on-surface first:mt-0",
  3: "mt-3 mb-1.5 text-sm font-semibold uppercase tracking-wide text-primary first:mt-0",
};

export default function Markdown({ content }: { content: string }) {
  const blocks = parseBlocks(content);

  return (
    <div className="font-body-md text-body-md leading-relaxed text-on-surface">
      {blocks.map((block, i) => {
        switch (block.type) {
          case "code":
            return (
              <pre
                key={i}
                className="my-2 overflow-x-auto rounded-lg bg-surface-container-high p-3 font-mono text-xs text-on-surface"
              >
                {block.content}
              </pre>
            );
          case "heading": {
            const Tag = `h${Math.min(block.level + 2, 6)}` as "h3" | "h4" | "h5";
            return (
              <Tag key={i} className={HEADING_CLASS[block.level]}>
                {renderInline(block.text)}
              </Tag>
            );
          }
          case "quote":
            return (
              <blockquote
                key={i}
                className="my-2 border-l-2 border-primary/50 pl-3 italic text-on-surface-variant"
              >
                {block.lines.map((l, j) => (
                  <p key={j}>{renderInline(l)}</p>
                ))}
              </blockquote>
            );
          case "list": {
            const items = block.items.map((item, j) => (
              <li key={j}>{renderInline(item)}</li>
            ));
            return block.ordered ? (
              <ol key={i} className="my-2 list-decimal space-y-1 pl-5">
                {items}
              </ol>
            ) : (
              <ul key={i} className="my-2 list-disc space-y-1 pl-5 marker:text-primary">
                {items}
              </ul>
            );
          }
          case "hr":
            return (
              <hr key={i} className="my-3 border-outline-variant/40" />
            );
          case "paragraph":
            return (
              <p key={i} className="my-2 whitespace-pre-wrap first:mt-0 last:mb-0">
                {renderInline(block.text)}
              </p>
            );
        }
      })}
    </div>
  );
}
