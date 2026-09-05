"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { BrowserMultiFormatReader, type IScannerControls } from "@zxing/browser";
import { playBeep } from "@/lib/beep";

interface ScanResult {
  type: "success" | "error" | "info";
  message: string;
}

// BarcodeDetector may not be in TS lib types
interface BarcodeDetectorResult {
  rawValue: string;
}
interface BarcodeDetectorInstance {
  detect(source: CanvasImageSource): Promise<BarcodeDetectorResult[]>;
}
interface BarcodeDetectorConstructor {
  new (options?: { formats?: string[] }): BarcodeDetectorInstance;
}

export default function Scanner() {
  const router = useRouter();
  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const intervalRef = useRef<number | null>(null);
  const zxingControlsRef = useRef<IScannerControls | null>(null);
  const [scanning, setScanning] = useState(false);
  const [result, setResult] = useState<ScanResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [manualIsbn, setManualIsbn] = useState("");
  const [showManualInput, setShowManualInput] = useState(false);
  const processingRef = useRef(false);
  const lastReadingsRef = useRef<string[]>([]);

  const handleScan = useCallback(async (isbn: string) => {
    if (processingRef.current) return;
    processingRef.current = true;

    playBeep();
    setLoading(true);
    setResult({ type: "info", message: `ISBN detectado: ${isbn}. Buscando...` });

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
          message: `✓ ${data.book.title} — redirecionando para o catálogo...`,
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
      }
    } catch {
      setResult({ type: "error", message: "Erro de rede ao enviar ISBN" });
    } finally {
      setLoading(false);
      setTimeout(() => {
        processingRef.current = false;
      }, 3000);
    }
  }, []);

  const onBarcodeRead = useCallback(
    (raw: string) => {
      const buffer = lastReadingsRef.current;
      buffer.push(raw);
      if (buffer.length > 3) buffer.shift();

      // Require 3 consecutive identical readings before accepting
      if (buffer.length === 3 && buffer.every((r) => r === raw)) {
        handleScan(raw);
      }
    },
    [handleScan]
  );

  const stopScanner = useCallback(() => {
    if (intervalRef.current) {
      window.clearInterval(intervalRef.current);
      intervalRef.current = null;
    }

    if (zxingControlsRef.current) {
      zxingControlsRef.current.stop();
      zxingControlsRef.current = null;
    }

    if (streamRef.current) {
      streamRef.current.getTracks().forEach((track) => track.stop());
      streamRef.current = null;
    }

    if (videoRef.current) {
      videoRef.current.srcObject = null;
    }

    setScanning(false);
  }, []);

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

      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: "environment" },
      });

      streamRef.current = stream;

      const video = videoRef.current;
      if (!video) {
        setResult({ type: "error", message: "Elemento de vídeo não encontrado." });
        return;
      }

      video.srcObject = stream;
      await video.play();

      setScanning(true);
      setResult({ type: "info", message: "Aponte para o código de barras..." });

      const BarcodeDetectorCtor = (
        window as unknown as { BarcodeDetector?: BarcodeDetectorConstructor }
      ).BarcodeDetector;

      if (BarcodeDetectorCtor) {
        // Native BarcodeDetector (Chrome, Edge, Safari 15.4+)
        const detector = new BarcodeDetectorCtor({
          formats: ["ean_13", "ean_8", "code_128", "upc_a", "upc_e"],
        });

        intervalRef.current = window.setInterval(async () => {
          if (processingRef.current) return;
          try {
            const barcodes = await detector.detect(video);
            if (barcodes.length > 0) {
              onBarcodeRead(barcodes[0].rawValue);
            }
          } catch {
            // Ignore per-frame detection errors
          }
        }, 250);
      } else {
        // Fallback: ZXing
        const reader = new BrowserMultiFormatReader();
        zxingControlsRef.current = await reader.decodeFromVideoElement(
          video,
          (res) => {
            if (res) {
              onBarcodeRead(res.getText());
            }
          }
        );
      }
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
    <div className="flex flex-1 flex-col items-center px-4 py-8">
      <h1 className="mb-6 text-2xl font-bold text-foreground">
        📷 Scanner de Código de Barras
      </h1>

      <p className="mb-6 max-w-md text-center text-sm text-zinc-500 dark:text-zinc-400">
        Aponte a câmera para o código de barras (ISBN) do livro. O livro será
        automaticamente cadastrado no catálogo.
      </p>

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
          className={`h-auto w-full rounded-xl ${scanning ? "block" : "hidden"}`}
          playsInline
          muted
        />

        {scanning && (
          <>
            {/* Scan frame overlay */}
            <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
              <div className="relative h-32 w-4/5 max-w-sm">
                {/* Corner brackets */}
                <span className="absolute left-0 top-0 h-6 w-6 border-l-4 border-t-4 border-indigo-500" />
                <span className="absolute right-0 top-0 h-6 w-6 border-r-4 border-t-4 border-indigo-500" />
                <span className="absolute bottom-0 left-0 h-6 w-6 border-b-4 border-l-4 border-indigo-500" />
                <span className="absolute bottom-0 right-0 h-6 w-6 border-b-4 border-r-4 border-indigo-500" />
                {/* Animated scan line */}
                <span className="absolute left-0 right-0 top-1/2 h-0.5 -translate-y-1/2 animate-pulse bg-indigo-500/80" />
              </div>
            </div>

            {/* Status badge */}
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

      {loading && (
        <div className="mt-6 flex items-center gap-2 text-indigo-600">
          <svg
            className="h-5 w-5 animate-spin"
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
          <span className="text-sm font-medium">Processando...</span>
        </div>
      )}

      {result && (
        <div
          className={`mt-6 w-full max-w-md rounded-lg p-4 text-sm font-medium ${
            result.type === "success"
              ? "bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400"
              : result.type === "error"
                ? "bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400"
                : "bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-400"
          }`}
        >
          {result.message}
        </div>
      )}

      {/* Manual ISBN Input Modal */}
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
