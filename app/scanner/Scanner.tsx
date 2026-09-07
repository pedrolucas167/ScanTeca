"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { BrowserMultiFormatReader } from "@zxing/browser";
import type { IScannerControls } from "@zxing/browser";
import { BarcodeFormat, DecodeHintType } from "@zxing/library";
import { playBeep } from "@/lib/beep";

interface ScanResult {
  type: "success" | "error" | "info";
  message: string;
}

interface ScannedBook {
  id: string;
  title: string;
  author: string;
  publishedDate?: string | null;
  coverUrl?: string | null;
  genre?: string | null;
  pages?: number | null;
  collection?: string;
}

function Icon({
  name,
  className = "",
  fill = false,
}: {
  name: string;
  className?: string;
  fill?: boolean;
}) {
  return (
    <span
      className={`material-symbols-outlined ${className}`}
      style={fill ? { fontVariationSettings: "'FILL' 1" } : undefined}
    >
      {name}
    </span>
  );
}

export default function Scanner() {
  const router = useRouter();
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const controlsRef = useRef<IScannerControls | null>(null);
  const [scanning, setScanning] = useState(false);
  const [result, setResult] = useState<ScanResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [manualIsbn, setManualIsbn] = useState("");
  const [showManualInput, setShowManualInput] = useState(false);
  const [scannedBook, setScannedBook] = useState<ScannedBook | null>(null);
  const [statusChip, setStatusChip] = useState("Na Fila");
  const processingRef = useRef(false);

  const stopScanner = useCallback(() => {
    try {
      controlsRef.current?.stop();
    } catch (err) {
      console.error("Erro ao parar scanner:", err);
    }
    controlsRef.current = null;
    setScanning(false);
  }, []);

  const handleScan = useCallback(
    async (isbn: string) => {
      if (processingRef.current) return;
      processingRef.current = true;

      playBeep();
      setLoading(true);
      setResult({
        type: "info",
        message: `ISBN ${isbn} detectado — buscando dados do livro...`,
      });

      try {
        const res = await fetch("/api/scan", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ isbn }),
        });

        const data = await res.json();

        if (res.ok) {
          setResult({
            type: "success",
            message: `${data.book.title} — reconhecido com sucesso`,
          });
          setScannedBook({
            id: data.book.id,
            title: data.book.title,
            author: data.book.author,
            publishedDate: data.book.publishedDate,
            coverUrl: data.book.coverUrl,
            genre: data.book.genre,
            pages: data.book.pages,
            collection: data.book.collection,
          });
          stopScanner();
        } else {
          setResult({
            type: "error",
            message: data.error || "Erro desconhecido",
          });
          setTimeout(() => {
            processingRef.current = false;
          }, 1500);
        }
      } catch {
        setResult({ type: "error", message: "Erro de rede ao enviar ISBN" });
        setTimeout(() => {
          processingRef.current = false;
        }, 1500);
      } finally {
        setLoading(false);
      }
    },
    [stopScanner]
  );

  const startScanner = useCallback(async () => {
    try {
      if (
        typeof navigator === "undefined" ||
        !navigator.mediaDevices?.getUserMedia
      ) {
        setResult({
          type: "error",
          message: "Seu navegador não suporta acesso à câmera.",
        });
        return;
      }

      setResult({ type: "info", message: "Solicitando permissão da câmera..." });
      setScannedBook(null);
      setScanning(true);
      await new Promise((r) =>
        requestAnimationFrame(() => requestAnimationFrame(r))
      );

      if (!videoRef.current) {
        throw new Error("Elemento de vídeo não disponível");
      }

      const hints = new Map();
      hints.set(DecodeHintType.POSSIBLE_FORMATS, [BarcodeFormat.EAN_13]);
      hints.set(DecodeHintType.TRY_HARDER, true);

      const reader = new BrowserMultiFormatReader(hints, {
        delayBetweenScanAttempts: 100,
      });

      const controls = await reader.decodeFromConstraints(
        {
          audio: false,
          video: {
            facingMode: { ideal: "environment" },
            width: { ideal: 1280 },
            height: { ideal: 720 },
            advanced: [{ focusMode: "continuous" }],
          } as unknown as MediaTrackConstraints,
        },
        videoRef.current,
        (scanResult) => {
          if (scanResult && !processingRef.current) {
            handleScan(scanResult.getText());
          }
        }
      );

      controlsRef.current = controls;
      setResult({ type: "info", message: "Aponte para o código de barras..." });
    } catch (err) {
      console.error("Erro ao iniciar scanner:", err);
      const message = err instanceof Error ? err.message : String(err);
      setResult({
        type: "error",
        message: `Erro ao iniciar câmera: ${message}`,
      });
      stopScanner();
    }
  }, [handleScan, stopScanner]);

  const handleManualSubmit = useCallback(() => {
    const isbn = manualIsbn.trim();
    if (!isbn) {
      setResult({ type: "error", message: "Digite um ISBN válido" });
      return;
    }
    setShowManualInput(false);
    setManualIsbn("");
    handleScan(isbn);
  }, [manualIsbn, handleScan]);

  useEffect(() => {
    return () => {
      stopScanner();
    };
  }, [stopScanner]);

  return (
    <div className="relative flex flex-1 flex-col bg-surface text-on-surface">
      {/* Scanner controls */}
      <div className="z-30 flex items-center justify-end gap-1.5 bg-gradient-to-b from-surface/90 via-surface/40 to-transparent px-4 pb-3 pt-3">
        <button
          type="button"
          title="Lanterna"
          className="flex h-8 w-8 items-center justify-center rounded-full border border-primary/40 bg-primary-container/30 text-primary shadow-[0_0_12px_rgba(91,80,230,0.4)] transition-transform active:scale-95"
        >
          <Icon name="flash_on" className="text-[18px]" fill />
        </button>
        <button
          type="button"
          title="Som"
          className="flex h-8 w-8 items-center justify-center rounded-full border border-outline-variant/30 bg-surface-container-high/80 text-on-surface-variant transition-colors hover:text-on-surface active:scale-95"
        >
          <Icon name="volume_up" className="text-[18px]" />
        </button>
      </div>

      {/* Viewfinder */}
      <div className="relative h-[320px] w-full overflow-hidden">
        {/* Camera feed */}
        <video
          ref={videoRef}
          className={`absolute inset-0 h-full w-full object-cover ${scanning ? "block" : "hidden"}`}
          muted
          playsInline
          autoPlay
        />
        {!scanning && (
          <div
            className="absolute inset-0 scale-105 bg-cover bg-center brightness-75 contrast-125"
            style={{
              backgroundImage: "url('/landing/scanner-bg.jpg')",
            }}
          />
        )}

        <div className="pointer-events-none absolute inset-0 bg-gradient-to-t from-surface via-transparent to-surface/80" />
        <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle,transparent_30%,rgba(17,19,25,0.65)_100%)]" />

        {/* Reticle */}
        <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
          <div className="relative h-[170px] w-[280px] rounded-lg">
            <div className="scanner-laser absolute left-1 right-1 z-20 h-[2px] bg-gradient-to-r from-transparent via-primary-container to-transparent" />
            <div className="absolute -left-[2px] -top-[2px] h-6 w-6 rounded-tl-md border-l-2 border-t-2 border-primary" />
            <div className="absolute -right-[2px] -top-[2px] h-6 w-6 rounded-tr-md border-r-2 border-t-2 border-primary" />
            <div className="absolute -bottom-[2px] -left-[2px] h-6 w-6 rounded-bl-md border-b-2 border-l-2 border-primary" />
            <div className="absolute -bottom-[2px] -right-[2px] h-6 w-6 rounded-br-md border-b-2 border-r-2 border-primary" />
            <div className="absolute inset-0 flex items-center justify-center rounded-lg border border-outline-variant/30">
              <div className="flex w-full justify-between px-3 text-outline-variant/40">
                <div className="h-1.5 w-1.5 border-l border-t border-primary/50" />
                <div className="h-1.5 w-1.5 border-r border-t border-primary/50" />
              </div>
            </div>
            <div className="absolute inset-0 rounded-lg bg-primary-container/5 backdrop-brightness-110" />
          </div>
        </div>

        {/* Helper labels */}
        <div className="absolute inset-x-0 bottom-4 z-20 flex flex-col items-center gap-2">
          <p className="flex items-center gap-1.5 rounded-full border border-outline-variant/20 bg-surface-container-lowest/85 px-3 py-1 font-caption text-caption text-on-surface-variant backdrop-blur-md shadow-sm">
            <span className="h-1.5 w-1.5 animate-ping rounded-full bg-primary" />
            <span>Alinhe o código de barras EAN-13 ou ISBN da contracapa</span>
          </p>
          <button
            onClick={() => setShowManualInput(true)}
            className="flex items-center gap-1.5 rounded-full border border-outline-variant/40 bg-surface-container-high/90 px-3 py-1 font-caption text-caption text-on-surface-variant backdrop-blur-md transition-colors hover:bg-surface-container-highest hover:text-on-surface active:scale-95"
          >
            <Icon name="keyboard" className="text-[14px]" />
            <span>Digitar código manualmente</span>
          </button>
        </div>
      </div>

      {/* Result toast */}
      {result && (
        <div
          className={`mx-4 mt-4 flex items-center justify-center gap-2.5 rounded-lg p-3 text-sm font-medium ${
            result.type === "success"
              ? "bg-emerald-950/40 text-emerald-300"
              : result.type === "error"
                ? "bg-error-container/20 text-error"
                : "bg-primary-container/20 text-primary"
          }`}
        >
          {loading && (
            <svg
              className="h-4 w-4 shrink-0 animate-spin"
              xmlns="http://www.w3.org/2000/svg"
              fill="none"
              viewBox="0 0 24 24"
            >
              <circle
                className="opacity-25"
                cx="12"
                cy="12"
                r="10"
                stroke="currentColor"
                strokeWidth="4"
              />
              <path
                className="opacity-75"
                fill="currentColor"
                d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"
              />
            </svg>
          )}
          <span className="font-body-sm text-body-sm">{result.message}</span>
        </div>
      )}

      {!scanning && !scannedBook && (
        <div className="mx-4 mt-6 flex flex-col items-center gap-3">
          <button
            onClick={startScanner}
            className="flex w-full max-w-md items-center justify-center gap-2 rounded-full bg-primary-container px-6 py-3.5 font-label-md text-label-md text-white shadow-lg shadow-primary-container/35 transition-all hover:bg-inverse-primary active:scale-[0.98]"
          >
            <Icon name="qr_code_scanner" className="text-xl" />
            <span>Iniciar Scanner</span>
          </button>
        </div>
      )}

      {scanning && (
        <div className="mx-4 mt-6 flex flex-col items-center gap-3">
          <button
            onClick={stopScanner}
            className="flex w-full max-w-md items-center justify-center gap-2 rounded-full bg-error-container px-6 py-3.5 font-label-md text-label-md text-error transition-all active:scale-[0.98]"
          >
            <Icon name="stop_circle" className="text-xl" />
            <span>Parar Scanner</span>
          </button>
        </div>
      )}

      {/* Capture / bottom sheet */}
      {scannedBook && (
        <main className="relative z-30 -mt-2 px-4 pb-28 pt-4">
          <div className="w-full rounded-b-lg rounded-t-xl border border-white/10 bg-surface-container-high/90 p-4 shadow-2xl backdrop-blur-xl">
            <div className="mx-auto mb-2 h-1 w-10 rounded-full bg-outline-variant/50" />

            <div className="mb-4 flex items-center justify-between">
              <div className="inline-flex items-center gap-1.5 rounded-full border border-emerald-500/40 bg-emerald-950/60 px-2.5 py-1 font-label-sm text-label-sm text-emerald-300">
                <Icon name="check_circle" className="text-[14px] text-emerald-400" fill />
                <span>ISBN Reconhecido • EAN-13 Válido</span>
              </div>
              <span className="font-caption text-caption text-outline tracking-wider">
                #{scannedBook.id.slice(0, 8)}
              </span>
            </div>

            <div className="mb-4 flex items-start gap-4 rounded-lg border border-outline-variant/25 bg-surface-container-lowest/60 p-3">
              <div
                className="group relative h-28 w-20 flex-shrink-0 overflow-hidden rounded-md border border-outline-variant/30 shadow-lg"
                style={{
                  backgroundImage: scannedBook.coverUrl
                    ? `url(${scannedBook.coverUrl})`
                    : "url('/landing/scanner-book.jpg')",
                  backgroundSize: "cover",
                  backgroundPosition: "center",
                }}
              >
                <div className="absolute bottom-0 left-0 top-0 w-2 bg-gradient-to-r from-black/60 to-transparent" />
              </div>
              <div className="flex h-28 flex-1 flex-col justify-between overflow-hidden">
                <div>
                  <span className="block font-label-sm text-label-sm uppercase tracking-widest text-secondary">
                    {scannedBook.genre || "Ficção"}
                  </span>
                  <h1 className="truncate font-quote-md text-quote-md font-semibold leading-snug tracking-tight text-on-surface">
                    {scannedBook.title}
                  </h1>
                  <p className="truncate font-body-sm text-body-sm font-medium text-on-surface-variant">
                    {scannedBook.author}
                  </p>
                  <p className="truncate font-caption text-caption text-outline">
                    {scannedBook.publishedDate || "Ed. não informada"}
                  </p>
                </div>
                <div className="flex items-center gap-2 border-t border-outline-variant/20 pt-1 font-caption text-caption text-on-surface-variant/80">
                  <span className="flex items-center gap-0.5">
                    <Icon name="menu_book" className="text-[13px] text-secondary" />
                    {scannedBook.pages || "—"} págs
                  </span>
                  <span>•</span>
                  <span>Lombada —</span>
                </div>
              </div>
            </div>

            <div className="space-y-3 pt-1">
              <div className="flex flex-col gap-1">
                <label className="flex items-center justify-between font-caption text-caption text-on-surface-variant">
                  <span>Localização Física no Acervo</span>
                  <span className="cursor-pointer text-[11px] text-primary hover:underline">
                    Alterar mapa
                  </span>
                </label>
                <div className="flex items-center justify-between rounded-2xl border border-outline-variant/40 bg-surface-container px-3 py-2 text-on-surface">
                  <div className="flex min-w-0 items-center gap-2">
                    <Icon name="local_library" className="text-[18px] text-primary" />
                    <span className="truncate font-body-sm text-body-sm font-medium">
                      {scannedBook.collection || "Estante Principal"} &gt; Prateleira 2
                      (Ficção)
                    </span>
                  </div>
                  <Icon name="expand_more" className="text-[16px] text-outline-variant" />
                </div>
              </div>

              <div className="flex flex-col gap-1.5 pt-1">
                <label className="font-caption text-caption text-on-surface-variant">
                  Estado de Leitura
                </label>
                <div className="flex items-center gap-2 overflow-x-auto pb-1 no-scrollbar">
                  {["Na Fila", "Lendo", "Lido", "Consulta"].map((s) => (
                    <button
                      key={s}
                      type="button"
                      onClick={() => setStatusChip(s)}
                      className={`flex items-center gap-1 rounded-full border px-3 py-1 font-label-sm text-label-sm transition-colors ${
                        statusChip === s
                          ? "border-primary bg-primary-container text-on-primary-container shadow-[0_0_12px_rgba(91,80,230,0.35)]"
                          : "border-outline-variant/30 bg-surface-container text-on-surface-variant hover:border-outline-variant"
                      }`}
                    >
                      {statusChip === s && (
                        <span className="h-1.5 w-1.5 rounded-full bg-emerald-400" />
                      )}
                      <span>{s}</span>
                    </button>
                  ))}
                </div>
              </div>
            </div>

            <div className="flex flex-col gap-3 pt-4">
              <button
                onClick={() => router.push("/")}
                className="flex w-full items-center justify-center gap-2 rounded-full bg-primary-container px-6 py-3.5 font-label-md text-label-md text-on-primary-container shadow-[0_12px_32px_-8px_rgba(91,80,230,0.4)] transition-all hover:bg-inverse-primary active:scale-[0.98]"
              >
                <Icon name="add_circle" className="text-[20px]" />
                <span>Salvar e Próximo</span>
              </button>
              <button
                onClick={() => router.push(`/books/${scannedBook.id}`)}
                className="flex w-full items-center justify-center gap-2 rounded-full border border-outline-variant/30 bg-surface-container px-6 py-2.5 font-label-md text-label-md text-on-surface transition-colors hover:bg-surface-bright active:scale-[0.98]"
              >
                <Icon name="psychology" className="text-[18px] text-tertiary" />
                <span>Ver Ficha Completa & Oráculo</span>
              </button>
            </div>
          </div>
        </main>
      )}

      {/* Manual input modal */}
      {showManualInput && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
          <div className="w-full max-w-sm rounded-xl border border-outline-variant/30 bg-surface-container p-6 shadow-xl">
            <h2 className="mb-4 font-headline-md text-headline-md text-on-surface">
              Digitar ISBN
            </h2>
            <input
              type="text"
              value={manualIsbn}
              onChange={(e) => setManualIsbn(e.target.value)}
              placeholder="Ex: 9788535902778"
              autoFocus
              onKeyDown={(e) => {
                if (e.key === "Enter") handleManualSubmit();
              }}
              className="mb-4 w-full rounded-lg border border-outline-variant/40 bg-surface-container-low px-4 py-3 font-body-sm text-body-sm text-on-surface placeholder:text-outline/70 focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
            />
            <div className="flex gap-3">
              <button
                onClick={() => {
                  setShowManualInput(false);
                  setManualIsbn("");
                }}
                className="flex-1 rounded-lg border border-outline-variant/30 bg-surface-container px-4 py-2.5 font-body-sm text-body-sm font-medium text-on-surface transition-colors hover:bg-surface-bright"
              >
                Cancelar
              </button>
              <button
                onClick={handleManualSubmit}
                className="flex-1 rounded-lg bg-primary-container px-4 py-2.5 font-body-sm text-body-sm font-medium text-on-primary-container transition-colors hover:bg-inverse-primary"
              >
                Buscar
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
