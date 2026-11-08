import { useEffect, useRef, useState, useSyncExternalStore } from "react";

type Availability = "available" | "unavailable" | "downloadable" | "downloading";
type LanguageOptions = { langs: string[]; processLocally: true };
type Recognition = {
  lang: string;
  processLocally: boolean;
  continuous: boolean;
  interimResults: boolean;
  onstart: (() => void) | null;
  onresult: ((event: SpeechRecognitionEvent) => void) | null;
  onerror: ((event: SpeechRecognitionErrorEvent) => void) | null;
  onend: (() => void) | null;
  start(): void;
  stop(): void;
  abort(): void;
};

type RecognitionConstructor = {
  new (): Recognition;
  available?(options: LanguageOptions): Promise<Availability>;
  install?(options: LanguageOptions): Promise<boolean>;
};

const language = "pt-BR";
const options: LanguageOptions = { langs: [language], processLocally: true };
const unavailable = "Ditado local em português do Brasil indisponível. Você pode digitar sua pergunta.";
const noSpeech = "Não identifiquei fala. Tente ditar novamente ou digite sua pergunta.";
const failed = "Não consegui iniciar ou concluir o ditado local. Tente novamente ou digite sua pergunta.";
const permissionDenied = "Permita o acesso ao microfone no navegador ou digite sua pergunta.";
const errors: Partial<Record<SpeechRecognitionErrorCode, string>> = {
  "no-speech": noSpeech,
  "audio-capture": "Microfone indisponível. Verifique o dispositivo ou digite sua pergunta.",
  "not-allowed": permissionDenied,
  "service-not-allowed": "O navegador bloqueou o ditado local. Você pode digitar sua pergunta.",
  "language-not-supported": unavailable,
};

function getRecognition() {
  const browser = window as Window & {
    SpeechRecognition?: RecognitionConstructor;
    webkitSpeechRecognition?: RecognitionConstructor;
  };
  return [browser.SpeechRecognition, browser.webkitSpeechRecognition]
    .find(Recognition => typeof Recognition?.available === "function" && "processLocally" in Recognition.prototype);
}

const subscribe = () => () => {};
const getSupported = () => Boolean(getRecognition());
const getServerSupported = () => false;
type Phase = "idle" | "checking" | "installing" | "listening" | "finishing";
type Attempt = { recognition?: Recognition; stopping?: boolean };

function discard(attempt: Attempt | null) {
  const recognition = attempt?.recognition;
  if (!recognition) return;
  recognition.onstart = null;
  recognition.onresult = null;
  recognition.onerror = null;
  recognition.onend = null;
  try {
    recognition.abort();
  } catch {
    // Recognition may already have ended.
  }
}

export function useLocalDictation(onTranscript: (text: string) => void) {
  const supported = useSyncExternalStore(subscribe, getSupported, getServerSupported);
  const [phase, setPhase] = useState<Phase>("idle");
  const [notice, setNotice] = useState<string | null>(null);
  const [canInstall, setCanInstall] = useState(false);
  const active = useRef<Attempt | null>(null);

  useEffect(() => () => {
    const attempt = active.current;
    active.current = null;
    discard(attempt);
  }, []);

  function cancel() {
    const attempt = active.current;
    active.current = null;
    discard(attempt);
    setPhase("idle");
    setNotice(null);
    setCanInstall(false);
  }

  async function start() {
    if (active.current) return;
    const Constructor = getRecognition();
    if (!Constructor?.available) return;
    const attempt: Attempt = {};
    active.current = attempt;
    setPhase("checking");
    setNotice(null);
    setCanInstall(false);

    function finish(message: string | null) {
      active.current = null;
      setPhase("idle");
      setNotice(message);
    }

    try {
      const status = await Constructor.available(options);
      if (active.current !== attempt) return;
      if (status !== "available") {
        const installable = status === "downloadable" && typeof Constructor.install === "function";
        setCanInstall(installable);
        finish(installable
          ? "Prepare o pacote de português do Brasil para ditar no aparelho."
          : status === "downloading" ? "O navegador está baixando o pacote de voz. Tente ditar de novo quando terminar."
          : unavailable);
        return;
      }

      const recognition = new Constructor();
      attempt.recognition = recognition;
      recognition.lang = language;
      recognition.processLocally = true;
      if (recognition.processLocally !== true) {
        finish(unavailable);
        return;
      }
      recognition.continuous = false;
      recognition.interimResults = false;

      const segments = new Map<number, string>();
      recognition.onstart = () => {
        if (active.current === attempt && !attempt.stopping) setPhase("listening");
      };
      recognition.onresult = event => {
        if (active.current !== attempt) return;
        for (let index = event.resultIndex; index < event.results.length; index++) {
          const result = event.results[index];
          if (result?.isFinal) segments.set(index, result[0]?.transcript.trim() ?? "");
        }
      };
      recognition.onerror = event => {
        if (active.current !== attempt) return;
        finish(errors[event.error] ?? failed);
        discard(attempt);
      };
      recognition.onend = () => {
        if (active.current !== attempt) return;
        const transcript = [...segments].sort(([a], [b]) => a - b)
          .map(([, text]) => text).filter(Boolean).join(" ");
        finish(transcript ? null : noSpeech);
        if (transcript) onTranscript(transcript);
      };
      recognition.start();
    } catch (error) {
      if (active.current !== attempt) return;
      finish(error instanceof DOMException && error.name === "NotAllowedError" ? permissionDenied : failed);
      discard(attempt);
    }
  }

  async function install() {
    if (active.current) return;
    const Constructor = getRecognition();
    if (!Constructor?.install) return;
    const attempt: Attempt = {};
    active.current = attempt;
    setPhase("installing");
    setNotice(null);
    setCanInstall(false);
    let installed = false;
    try {
      installed = await Constructor.install(options);
    } catch {
      // Browsers can reject installation when blocked by policy.
    }
    if (active.current !== attempt) return;
    active.current = null;
    setPhase("idle");
    setCanInstall(!installed);
    setNotice(installed
      ? "Pacote pronto. Toque no microfone para ditar no aparelho."
      : "Não consegui preparar o pacote de voz. Tente novamente ou digite sua pergunta.");
  }

  function stop() {
    const attempt = active.current;
    if (!attempt?.recognition || attempt.stopping) return;
    attempt.stopping = true;
    setPhase("finishing");
    try {
      attempt.recognition.stop();
    } catch {
      cancel();
      setNotice(failed);
    }
  }

  const progress = {
    idle: null,
    checking: "Preparando o ditado local…",
    installing: "Preparando o pacote de português do Brasil…",
    listening: "Ouvindo no aparelho. Pare o ditado para revisar o texto.",
    finishing: "Finalizando o ditado local…",
  };
  return { supported, phase, notice: progress[phase] ?? notice ?? (!supported ? unavailable : null),
    canInstall, isActive: () => active.current !== null, start, stop, cancel, install };
}
