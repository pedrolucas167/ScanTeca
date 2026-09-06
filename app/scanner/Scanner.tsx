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

export default function Scanner() {
  const router = useRouter();
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const controlsRef = useRef<IScannerControls | null>(null);
  const [scanning, setScanning] = useState(false);
  const [result, setResult] = useState<ScanResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [manualIsbn, setManualIsbn] = useState("");
  const [showManualInput, setShowManualInput] = useState(false);
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
            message: `${data.book.title} — redirecionando para o catálogo...`,
          });
          stopScanner();
          setTimeout(() => {
            router.push("/");
          }, 1200);
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
    [router, stopScanner]
  );

  const startScanner = useCallback(async () => {
    try {
      if (typeof navigator === "undefined" || !navigator.mediaDevices?.getUserMedia) {
        setResult({
          type: "error",
          message: "Seu navegador não suporta acesso à câmera.",
        });
        return;
      }

      setResult({ type: "info", message: "Solicitando permissão da câmera..." });

      // Show the video element BEFORE starting so it has real dimensions.
      setScanning(true);
      await new Promise((r) =>
        requestAnimationFrame(() => requestAnimationFrame(r))
      );

      if (!videoRef.current) {
        throw new Error("Elemento de vídeo não disponível");
      }

      // ISBN-13 only — every ISBN-10 is also encoded as EAN-13 (978 prefix).
      // TRY_HARDER improves detection of low-contrast/small barcodes.
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
            // Continuous autofocus where supported (Chrome/Android);
            // ignored gracefully on iOS/Safari. focusMode is non-standard
            // in TS's DOM types, hence the cast.
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
    <div className="flex flex-1 flex-col items-center">
      <p className="mb-6 max-w-md text-center text-sm text-zinc-500 dark:text-zinc-400">
        Aponte a câmera para o código de barras (ISBN) do livro. O livro será
        automaticamente cadastrado no catálogo.
      </p>

      <div className="mb-6 max-w-md rounded-lg border border-amber-200 bg-amber-50 p-3 text-xs text-amber-800 dark:border-amber-900/50 dark:bg-amber-900/20 dark:text-amber-300">
        <p className="font-semibold">Atenção:</p>
        <p>
          Algumas obras podem não ser encontradas pelo ISBN (especialmente
          livros nacionais, independentes ou sem ISBN registrado). Se isso
          acontecer, tente a aba &ldquo;Buscar livro&rdquo; para pesquisar por
          título ou autor — ou adicione manualmente pelo catálogo.
        </p>
      </div>

      <div className="mb-6 flex flex-wrap justify-center gap-3">
        {!scanning ? (
          <button
            onClick={startScanner}
            className="rounded-full bg-indigo-600 px-6 py-3 text-sm font-semibold text-white shadow-md transition-colors hover:bg-indigo-700"
          >
            Iniciar Scanner
          </button>
        ) : (
          <button
            onClick={stopScanner}
            className="rounded-full bg-red-600 px-6 py-3 text-sm font-semibold text-white shadow-md transition-colors hover:bg-red-700"
          >
            Parar Scanner
          </button>
        )}
        <button
          onClick={() => setShowManualInput(true)}
          className="rounded-full border border-zinc-300 bg-white px-6 py-3 text-sm font-semibold text-zinc-700 shadow-sm transition-colors hover:bg-zinc-50 dark:border-zinc-600 dark:bg-zinc-800 dark:text-zinc-300 dark:hover:bg-zinc-700"
        >
          Digitar ISBN
        </button>
      </div>

      <div
        className="relative w-full max-w-md overflow-hidden rounded-xl border-2 border-dashed border-zinc-300 bg-zinc-100 sm:max-w-lg lg:max-w-2xl dark:border-zinc-700 dark:bg-zinc-900"
        style={{ minHeight: scanning ? 320 : 200 }}
      >
        <video
          ref={videoRef}
          className={`h-full w-full object-cover ${scanning ? "block" : "hidden"}`}
          muted
          playsInline
          autoPlay
        />

        {scanning && (
          <>
            <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
              <div className="relative h-[100px] w-[250px]">
                <span className="absolute left-0 top-0 h-6 w-6 border-l-4 border-t-4 border-indigo-500" />
                <span className="absolute right-0 top-0 h-6 w-6 border-r-4 border-t-4 border-indigo-500" />
                <span className="absolute bottom-0 left-0 h-6 w-6 border-b-4 border-l-4 border-indigo-500" />
                <span className="absolute bottom-0 right-0 h-6 w-6 border-b-4 border-r-4 border-indigo-500" />
                <span className="absolute left-0 right-0 top-1/2 h-0.5 -translate-y-1/2 animate-pulse bg-indigo-500/80" />
              </div>
            </div>

            <div className="absolute left-1/2 top-3 -translate-x-1/2 rounded-full bg-black/60 px-3 py-1 text-xs font-medium text-white backdrop-blur-sm">
              <span className="mr-1.5 inline-block h-2 w-2 animate-pulse rounded-full bg-green-400 align-middle" />
              Escaneando...
            </div>
          </>
        )}

        {!scanning && (
          <div className="flex h-[200px] items-center justify-center text-zinc-400">
            <svg
              xmlns="http://www.w3.org/2000/svg"
              width="48"
              height="48"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.5"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <path d="M3 7V5a2 2 0 0 1 2-2h2" />
              <path d="M17 3h2a2 2 0 0 1 2 2v2" />
              <path d="M21 17v2a2 2 0 0 1-2 2h-2" />
              <path d="M7 21H5a2 2 0 0 1-2-2v-2" />
              <line x1="7" y1="12" x2="17" y2="12" />
            </svg>
          </div>
        )}
      </div>

      {result && (
        <div
          className={`mt-6 flex w-full max-w-md items-center justify-center gap-2.5 rounded-lg p-4 text-sm font-medium ${
            result.type === "success"
              ? "bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400"
              : result.type === "error"
                ? "bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400"
                : "bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-400"
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
          <span>{result.message}</span>
        </div>
      )}

      {showManualInput && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="w-full max-w-sm rounded-xl bg-white p-6 shadow-xl dark:bg-zinc-900">
            <h2 className="mb-4 text-lg font-semibold text-foreground">
              Digitar ISBN
            </h2>
            <input
              type="text"
              value={manualIsbn}
              onChange={(e) => setManualIsbn(e.target.value)}
              placeholder="Ex: 9788535902778"
              className="mb-4 w-full rounded-lg border border-zinc-300 bg-white px-4 py-3 text-sm text-foreground placeholder-zinc-400 focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500 dark:border-zinc-600 dark:bg-zinc-800 dark:placeholder-zinc-500"
              autoFocus
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  handleManualSubmit();
                }
              }}
            />
            <div className="flex gap-3">
              <button
                onClick={() => {
                  setShowManualInput(false);
                  setManualIsbn("");
                }}
                className="flex-1 rounded-lg border border-zinc-300 bg-white px-4 py-2.5 text-sm font-medium text-zinc-700 transition-colors hover:bg-zinc-50 dark:border-zinc-600 dark:bg-zinc-800 dark:text-zinc-300 dark:hover:bg-zinc-700"
              >
                Cancelar
              </button>
              <button
                onClick={handleManualSubmit}
                className="flex-1 rounded-lg bg-indigo-600 px-4 py-2.5 text-sm font-medium text-white transition-colors hover:bg-indigo-700"
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
