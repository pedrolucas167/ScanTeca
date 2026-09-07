"use client";

import { useEffect, useState } from "react";
import { Download, MoreVertical, PlusSquare, Share, X } from "lucide-react";

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
}

type Platform = "ios" | "android" | "other";

const DISMISS_KEY = "pwa-install-dismissed";

function isDismissed() {
  try {
    return localStorage.getItem(DISMISS_KEY) !== null;
  } catch {
    return false;
  }
}

function isStandalone() {
  return (
    window.matchMedia("(display-mode: standalone)").matches ||
    (navigator as Navigator & { standalone?: boolean }).standalone === true
  );
}

function detectPlatform(): Platform {
  const ua = navigator.userAgent;
  if (
    /iphone|ipad|ipod/i.test(ua) ||
    (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1)
  ) {
    return "ios";
  }
  if (/android/i.test(ua)) return "android";
  return "other";
}

export default function PwaRegister() {
  const [deferred, setDeferred] = useState<BeforeInstallPromptEvent | null>(null);
  const [platform, setPlatform] = useState<Platform | null>(null);
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    if ("serviceWorker" in navigator) {
      navigator.serviceWorker.register("/sw.js").catch(() => {});
    }

    if (isDismissed() || isStandalone()) return;

    const p = detectPlatform();

    const onPrompt = (e: Event) => {
      e.preventDefault();
      setDeferred(e as BeforeInstallPromptEvent);
      setVisible(true);
    };
    const onInstalled = () => {
      setDeferred(null);
      setVisible(false);
    };
    window.addEventListener("beforeinstallprompt", onPrompt);
    window.addEventListener("appinstalled", onInstalled);

    // iOS nunca dispara beforeinstallprompt — mostra o tutorial direto.
    // Android espera um instante pelo evento; se não vier (Firefox ou o
    // Chrome ainda não liberou), cai no tutorial do menu ⋮.
    const delay = p === "ios" ? 0 : 2500;
    const t = setTimeout(() => {
      setPlatform(p);
      if (p !== "other") setVisible(true);
    }, delay);

    return () => {
      clearTimeout(t);
      window.removeEventListener("beforeinstallprompt", onPrompt);
      window.removeEventListener("appinstalled", onInstalled);
    };
  }, []);

  const dismiss = () => {
    setVisible(false);
    try {
      localStorage.setItem(DISMISS_KEY, "1");
    } catch {}
  };

  const install = async () => {
    if (!deferred) return;
    await deferred.prompt();
    const choice = await deferred.userChoice;
    if (choice.outcome === "accepted") {
      setDeferred(null);
      setVisible(false);
    }
  };

  if (!visible || (!deferred && platform === "other")) return null;

  const icon =
    "inline h-3.5 w-3.5 align-[-2px] text-indigo-600 dark:text-indigo-400";

  return (
    <div className="fixed inset-x-4 bottom-4 z-50 mx-auto max-w-sm rounded-xl border border-zinc-200 bg-white p-4 shadow-lg dark:border-zinc-800 dark:bg-zinc-900">
      <button
        type="button"
        onClick={dismiss}
        aria-label="Fechar"
        className="absolute right-2 top-2 rounded-full p-1 text-zinc-400 transition-colors hover:bg-zinc-100 hover:text-foreground dark:hover:bg-zinc-800"
      >
        <X className="h-4 w-4" />
      </button>
      <p className="pr-6 text-sm font-semibold text-foreground">
        Instalar o Scanteca
      </p>
      {deferred ? (
        <>
          <p className="mt-1 text-xs leading-relaxed text-zinc-500 dark:text-zinc-400">
            Adicione à tela inicial para abrir como app, sem barra do navegador.
          </p>
          <button
            type="button"
            onClick={install}
            className="mt-3 inline-flex items-center gap-1.5 rounded-full bg-indigo-600 px-4 py-2 text-xs font-medium text-white transition-colors hover:bg-indigo-700"
          >
            <Download className="h-3.5 w-3.5" />
            Instalar
          </button>
        </>
      ) : platform === "ios" ? (
        <ol className="mt-2 list-decimal space-y-1 pl-4 text-xs leading-relaxed text-zinc-500 dark:text-zinc-400">
          <li>
            Toque em <Share className={icon} /> Compartilhar na barra do
            navegador
          </li>
          <li>
            Toque em <PlusSquare className={icon} /> &quot;Adicionar à Tela de
            Início&quot;
          </li>
          <li>Confirme em &quot;Adicionar&quot;</li>
        </ol>
      ) : (
        <ol className="mt-2 list-decimal space-y-1 pl-4 text-xs leading-relaxed text-zinc-500 dark:text-zinc-400">
          <li>
            Toque no menu <MoreVertical className={icon} /> do navegador
          </li>
          <li>
            Toque em &quot;Instalar app&quot; ou &quot;Adicionar à tela
            inicial&quot;
          </li>
        </ol>
      )}
    </div>
  );
}
