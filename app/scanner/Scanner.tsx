"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { Html5Qrcode } from "html5-qrcode";
import { playBeep } from "@/lib/beep";

interface ScanResult {
  type: "success" | "error" | "info";
  message: string;
}

export default function Scanner() {
  const scannerRef = useRef<Html5Qrcode | null>(null);
  const scannerContainerRef = useRef<HTMLDivElement>(null);
  const [scanning, setScanning] = useState(false);
  const [result, setResult] = useState<ScanResult | null>(null);
  const [loading, setLoading] = useState(false);
  const processingRef = useRef(false);

  const getQrBox = useCallback(() => {
    const width = scannerContainerRef.current?.clientWidth ?? 320;
    const qrWidth = Math.min(Math.round(width * 0.75), 560);
    const qrHeight = Math.round(qrWidth / 2);
    return { width: qrWidth, height: qrHeight };
  }, []);

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
          message: `✓ ${data.book.title} — ${data.message}`,
        });
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

  const startScanner = useCallback(async () => {
    try {
      if (typeof navigator === "undefined" || !navigator.mediaDevices?.getUserMedia) {
        setResult({
          type: "error",
          message: "Seu navegador não suporta acesso à câmera.",
        });
        return;
      }

      const container = scannerContainerRef.current;
      if (!container || container.clientWidth === 0) {
        setResult({
          type: "error",
          message: "Área do scanner não está pronta. Tente recarregar a página.",
        });
        return;
      }

      const scanner = new Html5Qrcode("scanner-region");
      scannerRef.current = scanner;

      const { width, height } = getQrBox();
      await scanner.start(
        { facingMode: "environment" },
        {
          fps: 10,
          qrbox: { width, height },
        },
        (decodedText) => {
          handleScan(decodedText);
        },
        () => {
          // Ignore scan errors (no code found yet)
        }
      );

      setScanning(true);
    } catch (err) {
      console.error("Erro ao iniciar scanner:", err);
      const message = err instanceof Error ? err.message : String(err);
      setResult({
        type: "error",
        message: `Erro ao iniciar câmera: ${message}`,
      });
    }
  }, [handleScan, getQrBox]);

  const stopScanner = useCallback(async () => {
    if (scannerRef.current) {
      try {
        await scannerRef.current.stop();
        scannerRef.current.clear();
      } catch {
        // Scanner already stopped
      }
      scannerRef.current = null;
      setScanning(false);
    }
  }, []);

  useEffect(() => {
    return () => {
      if (scannerRef.current) {
        scannerRef.current.stop().catch(() => {});
      }
    };
  }, []);

  return (
    <div className="flex flex-1 flex-col items-center px-4 py-8">
      <h1 className="mb-6 text-2xl font-bold text-foreground">
        📷 Scanner de Código de Barras
      </h1>

      <p className="mb-6 max-w-md text-center text-sm text-zinc-500 dark:text-zinc-400">
        Aponte a câmera para o código de barras (ISBN) do livro. O livro será
        automaticamente cadastrado no catálogo.
      </p>

      <div className="mb-6 flex gap-3">
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
      </div>

      <div
        ref={scannerContainerRef}
        id="scanner-region"
        className="w-full max-w-md overflow-hidden rounded-xl border-2 border-dashed border-zinc-300 bg-zinc-100 sm:max-w-lg lg:max-w-2xl dark:border-zinc-700 dark:bg-zinc-900"
        style={{ minHeight: scanning ? 320 : 200 }}
      >
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
    </div>
  );
}
