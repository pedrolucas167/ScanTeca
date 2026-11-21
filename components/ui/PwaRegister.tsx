"use client";

import { useEffect, useState } from "react";
import { useSession } from "@clerk/nextjs";
import { Download, MoreVertical, PlusSquare, RefreshCw, Share, X } from "lucide-react";

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
}

type Platform = "ios" | "android" | "other";

const DISMISS_KEY = "pwa-install-dismissed";

function isDismissedForSession(sessionId: string) {
  try {
    const dismissedSessionId = localStorage.getItem(DISMISS_KEY);
    if (dismissedSessionId === sessionId) return true;

    // Migra dispensas antigas para a sessão atual; uma sessão futura poderá
    // voltar a receber o aviso.
    if (dismissedSessionId === "1") {
      localStorage.setItem(DISMISS_KEY, sessionId);
      return true;
    }

    return false;
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
  const { isLoaded, session } = useSession();
  const sessionId = session?.id ?? null;
  const [deferred, setDeferred] = useState<BeforeInstallPromptEvent | null>(null);
  const [platform, setPlatform] = useState<Platform | null>(null);
  const [promptSessionId, setPromptSessionId] = useState<string | null>(null);
  const [dismissedSessionId, setDismissedSessionId] = useState<string | null>(null);
  const [appInstalled, setAppInstalled] = useState(false);
  const [updateReady, setUpdateReady] = useState(false);
  const [waitingWorker, setWaitingWorker] = useState<ServiceWorker | null>(null);

  useEffect(() => {
    if (!("serviceWorker" in navigator)) return;

    navigator.serviceWorker
      .register("/sw.js")
      .then((registration) => {
        if (registration.waiting) {
          setWaitingWorker(registration.waiting);
          setUpdateReady(true);
        }

        registration.addEventListener("updatefound", () => {
          const newWorker = registration.installing;
          if (!newWorker) return;

          newWorker.addEventListener("statechange", () => {
            if (
              newWorker.state === "installed" &&
              navigator.serviceWorker.controller
            ) {
              setWaitingWorker(newWorker);
              setUpdateReady(true);
            }
          });
        });
      })
      .catch(() => {});

    const onControllerChange = () => window.location.reload();
    navigator.serviceWorker.addEventListener("controllerchange", onControllerChange);
    return () => {
      navigator.serviceWorker.removeEventListener("controllerchange", onControllerChange);
    };
  }, []);

  useEffect(() => {
    const onPrompt = (e: Event) => {
      e.preventDefault();
      setDeferred(e as BeforeInstallPromptEvent);
    };
    const onInstalled = () => {
      setAppInstalled(true);
      setDeferred(null);
      setPromptSessionId(null);
    };

    window.addEventListener("beforeinstallprompt", onPrompt);
    window.addEventListener("appinstalled", onInstalled);
    return () => {
      window.removeEventListener("beforeinstallprompt", onPrompt);
      window.removeEventListener("appinstalled", onInstalled);
    };
  }, []);

  useEffect(() => {
    if (!isLoaded || !sessionId || appInstalled || isStandalone()) return;
    if (dismissedSessionId === sessionId || isDismissedForSession(sessionId)) return;

    const currentPlatform = detectPlatform();

    if (deferred) {
      const t = setTimeout(() => setPromptSessionId(sessionId), 0);
      return () => clearTimeout(t);
    }

    // iOS nunca dispara beforeinstallprompt — mostra o tutorial direto.
    // Android espera um instante pelo evento; se não vier, mostra o tutorial.
    const delay = currentPlatform === "ios" ? 0 : 2500;
    const t = setTimeout(() => {
      if (currentPlatform !== "other") {
        setPlatform(currentPlatform);
        setPromptSessionId(sessionId);
      }
    }, delay);

    return () => clearTimeout(t);
  }, [appInstalled, deferred, dismissedSessionId, isLoaded, sessionId]);

  const dismiss = () => {
    setPromptSessionId(null);
    if (sessionId) setDismissedSessionId(sessionId);
    try {
      if (sessionId) localStorage.setItem(DISMISS_KEY, sessionId);
    } catch {}
  };

  const install = async () => {
    if (!deferred) return;
    await deferred.prompt();
    const choice = await deferred.userChoice;
    if (choice.outcome === "accepted") {
      setDeferred(null);
      setAppInstalled(true);
      setPromptSessionId(null);
    } else {
      dismiss();
    }
  };

  const updateApp = () => {
    if (waitingWorker) {
      waitingWorker.postMessage({ type: "SKIP_WAITING" });
    }
  };

  const dismissUpdate = () => setUpdateReady(false);

  const showInstallPrompt =
    isLoaded &&
    Boolean(sessionId) &&
    promptSessionId === sessionId &&
    dismissedSessionId !== sessionId &&
    !appInstalled;
  if (!showInstallPrompt && !updateReady) return null;

  const icon =
    "inline h-3.5 w-3.5 align-[-2px] text-indigo-600 dark:text-indigo-400";

  return (
    <>
      {showInstallPrompt && (
        <div className="fixed inset-x-4 bottom-4 z-50 mx-auto max-w-sm rounded-xl border border-zinc-200 bg-white p-4 shadow-lg dark:border-zinc-800 dark:bg-zinc-900">
          <button
            type="button"
            onClick={dismiss}
            aria-label="Adiar até a próxima autenticação"
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
          <button
            type="button"
            onClick={dismiss}
            className="mt-3 rounded-full px-3 py-1.5 text-xs font-medium text-zinc-500 transition-colors hover:bg-zinc-100 hover:text-foreground dark:text-zinc-400 dark:hover:bg-zinc-800"
          >
            Agora não
          </button>
        </div>
      )}

      {updateReady && (
        <div className="fixed right-4 top-4 z-50 max-w-sm rounded-xl border border-zinc-200 bg-white p-4 shadow-lg dark:border-zinc-800 dark:bg-zinc-900">
          <button
            type="button"
            onClick={dismissUpdate}
            aria-label="Fechar"
            className="absolute right-2 top-2 rounded-full p-1 text-zinc-400 transition-colors hover:bg-zinc-100 hover:text-foreground dark:hover:bg-zinc-800"
          >
            <X className="h-4 w-4" />
          </button>
          <p className="pr-6 text-sm font-semibold text-foreground">
            Nova versão do Scanteca
          </p>
          <p className="mt-1 text-xs leading-relaxed text-zinc-500 dark:text-zinc-400">
            Uma atualização foi baixada. Recarregue para usar a versão mais
            recente.
          </p>
          <button
            type="button"
            onClick={updateApp}
            className="mt-3 inline-flex items-center gap-1.5 rounded-full bg-indigo-600 px-4 py-2 text-xs font-medium text-white transition-colors hover:bg-indigo-700"
          >
            <RefreshCw className="h-3.5 w-3.5" />
            Atualizar agora
          </button>
        </div>
      )}
    </>
  );
}
