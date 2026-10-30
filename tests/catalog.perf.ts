import { execFileSync } from "node:child_process";
import { mkdirSync, writeFileSync } from "node:fs";
import { gzipSync } from "node:zlib";
import * as React from "react";
import * as jsxRuntime from "react/jsx-runtime";
import { renderToString } from "react-dom/server";
import ts from "typescript";
import { expect, it, vi } from "vitest";
import { catalogBooks } from "./catalog-fixtures";
import { toCatalogBook } from "../lib/catalog-book";
import { Icon } from "../components/ui/Icon";
import * as statuses from "../lib/constants/book-status";
import * as quotes from "../lib/constants/literary-quotes";

vi.mock("next/navigation", () => ({ useRouter: () => ({ push() {} }) }));
vi.mock("next/link", () => ({ default: (props: React.AnchorHTMLAttributes<HTMLAnchorElement>) => React.createElement("a", props) }));
vi.mock("next/image", () => ({ default: () => null }));
import Catalog from "../app/Catalog";

it("compara o componente anterior e o atual com acervos sintéticos iguais", () => {
  const baseline = process.env.SCANTECA_CATALOG_BASELINE || "20246c508e228d4efe97598926811b961026d17f";
  const source = execFileSync("git", ["show", `${baseline}:app/Catalog.tsx`], { encoding: "utf8" });
  const compiled = ts.transpileModule(source, { compilerOptions: {
    module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, jsx: ts.JsxEmit.ReactJSX, esModuleInterop: true,
  } });
  const legacy: { default?: typeof Catalog } = {};
  const dependencies: Record<string, unknown> = {
    react: React, "react/jsx-runtime": jsxRuntime,
    "next/navigation": { useRouter: () => ({ push() {} }) },
    "next/link": (props: React.AnchorHTMLAttributes<HTMLAnchorElement>) => React.createElement("a", props),
    "next/image": () => null,
    "@/components/ui/Icon": { Icon }, "@/lib/constants/book-status": statuses,
    "@/lib/constants/literary-quotes": quotes,
  };
  new Function("require", "exports", compiled.outputText)((id: string) => {
    if (!(id in dependencies)) throw new Error(`Unexpected baseline dependency: ${id}`);
    return dependencies[id];
  }, legacy);
  const rows = [24, 200, 1000].map(count => {
    const full = catalogBooks(count);
    const summary = full.map(toCatalogBook);
    const sharedProps = { libraryName: "Estante", shareEnabled: false, shareId: null };
    const beforeSamples: number[] = [];
    const afterSamples: number[] = [];
    let beforeHtml = "";
    let afterHtml = "";
    // Warm up both implementations before the five measured pairs.
    renderToString(React.createElement(legacy.default!, { ...sharedProps, books: full }));
    renderToString(React.createElement(Catalog, { ...sharedProps, books: summary }));
    for (let i = 0; i < 5; i++) {
      let started = performance.now();
      beforeHtml = renderToString(React.createElement(legacy.default!, { ...sharedProps, books: full }));
      beforeSamples.push(performance.now() - started);
      started = performance.now();
      afterHtml = renderToString(React.createElement(Catalog, { ...sharedProps, books: summary }));
      afterSamples.push(performance.now() - started);
    }
    const median = (samples: number[]) => Math.round(samples.sort((a, b) => a - b)[2]! * 100) / 100;
    const beforePayload = JSON.stringify(full);
    const afterPayload = JSON.stringify(summary);
    const beforeLinks = (beforeHtml.match(/href="\/books\/book-/g) || []).length;
    const afterLinks = (afterHtml.match(/href="\/books\/book-/g) || []).length;
    expect(beforeLinks).toBe(count);
    expect(afterLinks).toBe(Math.min(24, count));
    expect(afterPayload).not.toContain("Notas privadas");
    expect(afterPayload).not.toContain("Sinopse fictícia");
    expect(Buffer.byteLength(afterPayload)).toBeLessThan(Buffer.byteLength(beforePayload));
    return {
      books: count, beforeRenderMs: median(beforeSamples), afterRenderMs: median(afterSamples),
      beforeRenderedBooks: beforeLinks, afterRenderedBooks: afterLinks,
      beforeBooksPayloadBytes: Buffer.byteLength(beforePayload), afterBooksPayloadBytes: Buffer.byteLength(afterPayload),
      beforeBooksPayloadGzipBytes: gzipSync(beforePayload).length, afterBooksPayloadGzipBytes: gzipSync(afterPayload).length,
      beforeHtmlBytes: Buffer.byteLength(beforeHtml), afterHtmlBytes: Buffer.byteLength(afterHtml),
      beforeHtmlGzipBytes: gzipSync(beforeHtml).length, afterHtmlGzipBytes: gzipSync(afterHtml).length,
    };
  });
  mkdirSync("reports", { recursive: true });
  writeFileSync("reports/catalog-performance.json", JSON.stringify({
    baseline, samples: 5, scope: "Synthetic book payload and actual Catalog SSR only; excludes database, layout, network, hydration and images.", rows,
  }, null, 2) + "\n");
  for (const row of rows.filter(row => row.books >= 200)) expect(row.afterRenderMs).toBeLessThan(row.beforeRenderMs);
}, 30000);
