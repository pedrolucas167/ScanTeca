"use client";

import { useState } from "react";
import Image from "next/image";
import type { Source } from "@/lib/types/oracle";

function ImageResult({ source }: { source: Source }) {
  const [failed, setFailed] = useState(false);
  if (!source.thumbnail || !source.url) return null;
  return (
    <a href={source.url} target="_blank" rel="noopener noreferrer"
      className="block overflow-hidden rounded-xl border border-outline-variant/40 focus-visible:outline-2 focus-visible:outline-offset-2">
      <div className="relative flex aspect-[4/3] items-center justify-center bg-surface-container-low">
        {failed ? (
          <span className="p-3 text-center text-sm text-on-surface-variant">Miniatura indisponível</span>
        ) : (
          <Image src={source.thumbnail.url} alt={source.thumbnail.alt} fill unoptimized
            referrerPolicy="no-referrer" className="object-contain" onError={() => setFailed(true)} />
        )}
      </div>
      <div className="break-words p-3 text-sm">
        <span className="block font-medium">{source.title}</span>
        {source.author !== source.title && <span className="block text-on-surface-variant">{source.author}</span>}
      </div>
    </a>
  );
}

export function OracleImageResults({ sources }: { sources: Source[] }) {
  const images = sources.filter(source => source.sourceType === "image" && source.thumbnail && source.url);
  if (!images.length) return null;
  return (
    <ul aria-label="Imagens encontradas" className="grid min-w-0 grid-cols-2 gap-3 sm:grid-cols-3">
      {images.map(source => (
        <li key={source.thumbnail?.url} className="min-w-0">
          <ImageResult source={source} />
        </li>
      ))}
    </ul>
  );
}
