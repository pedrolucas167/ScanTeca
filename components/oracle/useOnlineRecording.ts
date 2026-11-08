import { useEffect, useRef, useState, useSyncExternalStore } from "react";

const subscribe = () => () => {};
const getMimeType = () => ["audio/webm;codecs=opus", "audio/webm", "audio/ogg"]
  .find(type => MediaRecorder.isTypeSupported(type));
const getSupported = () => typeof MediaRecorder !== "undefined" && !!navigator.mediaDevices?.getUserMedia && !!getMimeType();
const getServerSupported = () => false;
type Phase = "idle" | "starting" | "recording" | "finishing";
type Capture = { stream?: MediaStream; recorder?: MediaRecorder; submit?: boolean };

function release(capture: Capture | null) {
  if (!capture) return;
  const recorder = capture.recorder;
  if (recorder) {
    recorder.onstop = null;
    recorder.onerror = null;
    recorder.ondataavailable = null;
    if (recorder.state !== "inactive") {
      try {
        recorder.stop();
      } catch {
        // The stream can end between the state check and stop().
      }
    }
  }
  capture.stream?.getTracks().forEach(track => track.stop());
}

export function useOnlineRecording(onError: (message: string) => void) {
  const supported = useSyncExternalStore(subscribe, getSupported, getServerSupported);
  const [phase, setPhase] = useState<Phase>("idle");
  const active = useRef<Capture | null>(null);

  useEffect(() => () => {
    const capture = active.current;
    active.current = null;
    release(capture);
  }, []);

  function cancel() {
    const capture = active.current;
    active.current = null;
    release(capture);
    setPhase("idle");
  }

  async function start(onRecording: (blob: Blob) => void) {
    if (active.current || typeof MediaRecorder === "undefined") return;
    const mimeType = getMimeType();
    if (!mimeType) {
      onError("Este navegador não oferece um formato compatível com a transcrição online.");
      return;
    }
    const capture: Capture = {};
    active.current = capture;
    setPhase("starting");
    try {
      capture.stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      if (active.current !== capture) {
        release(capture);
        return;
      }
      const recorder = new MediaRecorder(capture.stream, { mimeType });
      capture.recorder = recorder;
      const chunks: Blob[] = [];
      recorder.ondataavailable = event => {
        if (event.data.size > 0) chunks.push(event.data);
      };
      recorder.onerror = () => {
        if (active.current !== capture) return;
        cancel();
        onError("A gravação foi interrompida. Tente gravar novamente.");
      };
      recorder.onstop = () => {
        if (active.current !== capture) return;
        cancel();
        if (!capture.submit) {
          onError("A gravação terminou antes do envio. Tente gravar novamente.");
        } else if (chunks.length === 0) {
          onError("A gravação ficou vazia. Tente gravar novamente.");
        } else {
          onRecording(new Blob(chunks, { type: chunks[0]?.type || recorder.mimeType || mimeType }));
        }
      };
      recorder.start();
      setPhase("recording");
    } catch (error) {
      if (active.current !== capture) return;
      cancel();
      onError(error instanceof DOMException && error.name === "NotAllowedError"
        ? "Permita o acesso ao microfone nas configurações do navegador."
        : "Não consegui iniciar a gravação. Verifique se o microfone está disponível.");
    }
  }

  function stopAndSubmit() {
    const capture = active.current;
    if (capture?.recorder?.state !== "recording") return;
    capture.submit = true;
    setPhase("finishing");
    try {
      capture.recorder.stop();
    } catch {
      cancel();
      onError("Não consegui finalizar a gravação. Tente gravar novamente.");
    }
  }

  return { supported, phase, isActive: () => active.current !== null, start, stopAndSubmit, cancel };
}
