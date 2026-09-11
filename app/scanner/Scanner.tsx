"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { BrowserMultiFormatReader } from "@zxing/browser";
import type { IScannerControls } from "@zxing/browser";
import { BarcodeFormat, DecodeHintType } from "@zxing/library";
import { playBeep } from "@/lib/beep";
import BookPreviewSheet, { type BookDraft } from "./BookPreviewSheet";

interface ScanResult {
  type: "success" | "error" | "info";
  message: string;
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
  const [scannedBook, setScannedBook] = useState<BookDraft | null>(null);
  const [existing, setExisting] = useState(false);
  const [saving, setSaving] = useState(false);
  const [soundEnabled, setSoundEnabled] = useState(true);
  const [flashlightOn, setFlashlightOn] = useState(false);
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

      playBeep(soundEnabled);
      setLoading(true);
      setResult({
        type: "info",
        message: `ISBN ${isbn} detectado — buscando dados do livro...`,
      });

      try {
        const res = await fetch("/api/scan", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ isbn, preview: true }),
        });

        const data = await res.json();

        if (res.ok) {
          setResult({
            type: "success",
            message: data.existing
              ? "Livro já cadastrado"
              : `${data.book.title} — reconhecido com sucesso`,
          });
          setScannedBook(data.book);
          setExisting(!!data.existing);
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
    [stopScanner, soundEnabled]
  );

  const toggleSound = useCallback(() => {
    setSoundEnabled((prev) => !prev);
  }, []);

  const toggleFlashlight = useCallback(async () => {
    if (!videoRef.current?.srcObject) {
      setResult({
        type: "info",
        message: "Inicie o scanner primeiro para usar a lanterna",
      });
      return;
    }

    const stream = videoRef.current.srcObject as MediaStream;
    const track = stream.getVideoTracks()[0];
    if (!track) {
      setResult({ type: "info", message: "Lanterna não disponível" });
      return;
    }

    const next = !flashlightOn;
    try {
      await track.applyConstraints({
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        advanced: [{ torch: next }] as any,
      });
      setFlashlightOn(next);
    } catch (err) {
      console.error("Erro ao alternar lanterna:", err);
      setResult({
        type: "info",
        message: "Lanterna não suportada neste dispositivo",
      });
    }
  }, [flashlightOn]);

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
          title={flashlightOn ? "Desligar lanterna" : "Ligar lanterna"}
          onClick={toggleFlashlight}
          className={`flex h-8 w-8 items-center justify-center rounded-full border transition-transform active:scale-95 ${
            flashlightOn
              ? "border-primary bg-primary-container text-on-primary-container shadow-[0_0_12px_rgba(91,80,230,0.6)]"
              : "border-primary/40 bg-primary-container/30 text-primary shadow-[0_0_12px_rgba(91,80,230,0.4)]"
          }`}
        >
          <Icon
            name={flashlightOn ? "flash_off" : "flash_on"}
            className="text-[18px]"
            fill={flashlightOn}
          />
        </button>
        <button
          type="button"
          title={soundEnabled ? "Desativar som" : "Ativar som"}
          onClick={toggleSound}
          className={`flex h-8 w-8 items-center justify-center rounded-full border transition-colors active:scale-95 ${
            soundEnabled
              ? "border-primary/40 bg-primary-container/30 text-primary"
              : "border-outline-variant/30 bg-surface-container-high/80 text-on-surface-variant hover:text-on-surface"
          }`}
        >
          <Icon
            name={soundEnabled ? "volume_up" : "volume_off"}
            className="text-[18px]"
            fill={soundEnabled}
          />
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
        <BookPreviewSheet
          book={scannedBook}
          existing={existing}
          loading={saving}
          onConfirm={async (status) => {
            const book = scannedBook;
            if (!book) return;

            if (existing) {
              if (book.id) {
                router.push(`/books/${book.id}`);
              }
              return;
            }

            setSaving(true);
            try {
              const res = await fetch("/api/books", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                  isbn: book.isbn,
                  title: book.title,
                  author: book.author,
                  publishedDate: book.publishedDate,
                  synopsis: book.synopsis,
                  coverUrl: book.coverUrl,
                  genre: book.genre,
                  pages: book.pages,
                  status,
                  collection: book.collection,
                }),
              });
              const data = await res.json();
              if (res.ok) {
                if (data.message === "Livro já cadastrado" && data.book?.id) {
                  router.push(`/books/${data.book.id}`);
                  return;
                }
                setResult({
                  type: "success",
                  message: `${data.book.title} — adicionado com sucesso`,
                });
                router.push("/");
              } else {
                setResult({
                  type: "error",
                  message: data.error || "Erro ao adicionar livro",
                });
                setSaving(false);
              }
            } catch (err) {
              console.error("Erro ao adicionar livro:", err);
              setResult({ type: "error", message: "Erro de rede ao adicionar" });
              setSaving(false);
            }
          }}
          onCancel={() => {
            setScannedBook(null);
            setExisting(false);
            processingRef.current = false;
          }}
          onViewDetails={
            scannedBook?.id ? () => router.push(`/books/${scannedBook.id!}`) : undefined
          }
        />
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
