// @vitest-environment jsdom
import { act, cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import OraclePage from "./page";

const fetchMock = vi.fn();
const getUserMedia = vi.fn();
const stopTrack = vi.fn();
const language = { langs: ["pt-BR"], processLocally: true };

class LocalRecognition {
  static available = vi.fn();
  static install = vi.fn();
  static current: LocalRecognition | undefined;
  lang = "";
  continuous = false;
  private local = false;
  get processLocally() { return this.local; }
  set processLocally(value: boolean) { this.local = value; }
  onstart?: () => void;
  onresult?: (event: { resultIndex: number; results: { isFinal: boolean; 0: { transcript: string } }[] }) => void;
  onend?: () => void;
  onerror?: (event: { error: string }) => void;
  start = vi.fn(() => { this.onstart?.(); });
  stop = vi.fn();
  abort = vi.fn();

  constructor() { LocalRecognition.current = this; }
}

class Recorder {
  static isTypeSupported = () => true;
  static current: Recorder | undefined;
  state = "inactive";
  mimeType = "audio/webm";
  ondataavailable?: (event: { data: Blob }) => void;
  onstop?: () => void;

  constructor() { Recorder.current = this; }

  start() { this.state = "recording"; }
  stop() {
    this.state = "inactive";
    this.ondataavailable?.({ data: new Blob(["audio"], { type: this.mimeType }) });
    this.onstop?.();
  }
}

beforeEach(() => {
  vi.resetAllMocks();
  LocalRecognition.current = undefined;
  Recorder.current = undefined;
  LocalRecognition.available.mockResolvedValue("available");
  LocalRecognition.install.mockResolvedValue(true);
  getUserMedia.mockResolvedValue({ getTracks: () => [{ stop: stopTrack }] });
  fetchMock.mockImplementation(async (url: string, init?: RequestInit) => {
    if (url === "/api/oracle" && !init?.method) return Response.json({});
    if (url === "/api/oracle" && init?.method === "POST") return new Response("");
    if (url === "/api/oracle/transcribe") return Response.json({ transcript: "Pergunta online" });
    throw new Error("Unexpected request");
  });
  vi.stubGlobal("fetch", fetchMock);
  vi.stubGlobal("SpeechRecognition", LocalRecognition);
  vi.stubGlobal("MediaRecorder", Recorder);
  vi.stubGlobal("navigator", { mediaDevices: { getUserMedia } });
  vi.stubGlobal("matchMedia", () => ({ matches: false, addEventListener() {}, removeEventListener() {} }));
  vi.stubGlobal("ResizeObserver", class { observe() {} disconnect() {} });
});

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

const button = (name: string) => screen.getByRole("button", { name });
const draft = () => screen.getByRole("textbox", { name: "Sua mensagem" }) as HTMLTextAreaElement;
const result = (transcript: string, isFinal = true) => ({ isFinal, 0: { transcript } });
const requests = () => fetchMock.mock.calls.filter(([, init]) => init?.method === "POST");

async function startDictation() {
  fireEvent.click(button("Ditar no aparelho"));
  await screen.findByRole("button", { name: "Parar ditado e revisar" });
  return LocalRecognition.current!;
}

it("exige processamento local, consolida resultados e só gera após envio explícito do texto revisado", async () => {
  vi.stubGlobal("SpeechRecognition", class extends LocalRecognition {
    unspokenPunctuation = false;
  });
  render(<OraclePage />);
  fireEvent.change(draft(), { target: { value: "Quero saber:" } });
  const speech = await startDictation();
  expect(LocalRecognition.available).toHaveBeenCalledWith(language);
  expect(speech.lang).toBe("pt-BR");
  expect(speech.processLocally).toBe(true);
  expect(speech.continuous).toBe(true);
  expect(speech).toHaveProperty("unspokenPunctuation", true);
  expect(getUserMedia).not.toHaveBeenCalled();

  const firstSentence = result("Quais livros você sugere?");
  const secondSentence = result("Prefiro livros curtos.");
  act(() => speech.onresult?.({ resultIndex: 0, results: [firstSentence, result("pre", false)] }));
  expect(button("Parar ditado e revisar")).toBeTruthy();
  expect(speech.stop).not.toHaveBeenCalled();
  act(() => speech.onresult?.({ resultIndex: 1, results: [firstSentence, secondSentence] }));
  act(() => speech.onresult?.({ resultIndex: 0, results: [firstSentence, secondSentence] }));
  fireEvent.click(button("Parar ditado e revisar"));
  expect(speech.stop).toHaveBeenCalledOnce();
  expect(requests()).toEqual([]);
  act(() => speech.onend?.());
  expect(draft().value).toBe("Quero saber: Quais livros você sugere? Prefiro livros curtos.");
  expect(requests()).toEqual([]);

  fireEvent.change(draft(), { target: { value: "Quais livros curtos você sugere?" } });
  fireEvent.click(button("Enviar mensagem"));
  await waitFor(() => expect(requests()).toHaveLength(1));
  expect(requests()[0]?.[0]).toBe("/api/oracle");
  expect(JSON.parse(requests()[0]?.[1].body).question).toBe("Quais livros curtos você sugere?");
});

it("preserva o rascunho quando o navegador encerra ou interrompe a escuta", async () => {
  render(<OraclePage />);
  const speech = await startDictation();
  expect(speech).not.toHaveProperty("unspokenPunctuation");
  act(() => {
    speech.onresult?.({ resultIndex: 0, results: [result("Uma pergunta")] });
    speech.onend?.();
  });
  expect(draft().value).toBe("Uma pergunta");
  expect(screen.getByText(/O navegador encerrou o ditado/)).toBeTruthy();
  const interrupted = await startDictation();
  act(() => {
    interrupted.onresult?.({ resultIndex: 0, results: [result("Mais um detalhe")] });
    interrupted.onerror?.({ error: "audio-capture" });
  });
  expect(screen.getByText(/Microfone indisponível/)).toBeTruthy();
  const denied = await startDictation();
  act(() => denied.onerror?.({ error: "not-allowed" }));
  expect(screen.getByText(/Permita o acesso ao microfone/)).toBeTruthy();
  const silent = await startDictation();
  act(() => silent.onend?.());
  expect(screen.getByText(/Não identifiquei fala/)).toBeTruthy();
  expect(draft().value).toBe("Uma pergunta Mais um detalhe");
  expect(requests()).toEqual([]);
});

it("sugere nomes literários e tenta uma vez sem dicas quando o pacote as rejeita", async () => {
  class Phrase {
    constructor(public phrase: string, public boost: number) {}
  }
  class RecognitionWithHints extends LocalRecognition {
    phrases: Phrase[] = [];
    start = vi.fn(() => {
      if (this.phrases.length === 0) this.onstart?.();
    });
  }
  vi.stubGlobal("SpeechRecognitionPhrase", Phrase);
  vi.stubGlobal("SpeechRecognition", RecognitionWithHints);

  render(<OraclePage />);
  fireEvent.click(button("Ditar no aparelho"));
  await waitFor(() => expect(LocalRecognition.current?.start).toHaveBeenCalledOnce());
  const speech = LocalRecognition.current as RecognitionWithHints;
  expect(speech.phrases.map(({ phrase }) => phrase)).toEqual(expect.arrayContaining([
    "Günter Grass", "Byung-Chul Han", "Michel Foucault", "Jean-Paul Sartre",
  ]));
  act(() => speech.onerror?.({ error: "phrases-not-supported" }));
  expect(speech.phrases).toEqual([]);
  expect(speech.start).toHaveBeenCalledTimes(2);
  expect(speech.processLocally).toBe(true);
  expect(button("Parar ditado e revisar")).toBeTruthy();

  act(() => speech.onerror?.({ error: "phrases-not-supported" }));
  expect(speech.start).toHaveBeenCalledTimes(2);
  expect(draft().disabled).toBe(false);
  const next = await startDictation() as RecognitionWithHints;
  expect(next.phrases).toEqual([]);
  expect(requests()).toEqual([]);
});

it.each(["", "Texto reconhecido"])("libera o rascunho quando o navegador não encerra após parar (%j)", async text => {
  render(<OraclePage />);
  const speech = await startDictation();
  if (text) act(() => speech.onresult?.({ resultIndex: 0, results: [result(text)] }));
  const lateEnd = speech.onend;

  vi.useFakeTimers();
  try {
    fireEvent.click(button("Parar ditado e revisar"));
    expect(draft().disabled).toBe(true);
    act(() => vi.advanceTimersByTime(4000));
    expect(speech.abort).toHaveBeenCalledOnce();
    expect(draft().disabled).toBe(false);
    if (!text) expect(screen.getByText(/Não consegui iniciar ou concluir o ditado local/)).toBeTruthy();
    act(() => lateEnd?.());
    expect(draft().value).toBe(text);
    expect(requests()).toEqual([]);
  } finally {
    vi.useRealTimers();
  }
});

it("instala o pacote apenas por ação explícita e espera um novo toque para ouvir", async () => {
  vi.stubGlobal("SpeechRecognition", undefined);
  vi.stubGlobal("webkitSpeechRecognition", LocalRecognition);
  LocalRecognition.available.mockResolvedValueOnce("downloadable");
  render(<OraclePage />);
  fireEvent.click(button("Ditar no aparelho"));
  const install = await screen.findByRole("button", { name: "Preparar pacote de português" });
  expect(LocalRecognition.install).not.toHaveBeenCalled();
  fireEvent.click(install);
  await screen.findByText(/Pacote pronto/);
  expect(LocalRecognition.install).toHaveBeenCalledWith(language);
  expect(LocalRecognition.current).toBeUndefined();
  await startDictation();
  expect(requests()).toEqual([]);
});

it("mantém a digitação quando falta suporte local, inclusive com uma API legada", async () => {
  LocalRecognition.available.mockResolvedValue("unavailable");
  const { rerender } = render(<OraclePage />);
  fireEvent.click(button("Ditar no aparelho"));
  await screen.findByText(/Ditado local em português do Brasil indisponível/);
  expect(LocalRecognition.current).toBeUndefined();
  vi.stubGlobal("SpeechRecognition", undefined);
  vi.stubGlobal("webkitSpeechRecognition", vi.fn());
  rerender(<OraclePage />);
  expect(screen.queryByRole("button", { name: "Ditar no aparelho" })).toBeNull();
  fireEvent.change(draft(), { target: { value: "Posso digitar" } });
  expect(draft().value).toBe("Posso digitar");
  expect(requests()).toEqual([]);
});

it("descarta o resultado após cancelar e interrompe a captura ao desmontar", async () => {
  const page = render(<OraclePage />);
  const speech = await startDictation();
  const lateEnd = speech.onend;
  act(() => speech.onresult?.({ resultIndex: 0, results: [result("Descartar")] }));
  fireEvent.click(button("Cancelar voz"));
  expect(speech.abort).toHaveBeenCalledOnce();
  act(() => lateEnd?.());
  expect(draft().value).toBe("");

  const another = await startDictation();
  page.unmount();
  expect(another.abort).toHaveBeenCalledOnce();
  expect(requests()).toEqual([]);
});

it("descarta verificações de idioma e permissões resolvidas após cancelamento", async () => {
  const availability = Promise.withResolvers<string>();
  const permission = Promise.withResolvers<{ getTracks: () => { stop: () => void }[] }>();
  LocalRecognition.available.mockReturnValueOnce(availability.promise);
  getUserMedia.mockReturnValueOnce(permission.promise);
  render(<OraclePage />);

  fireEvent.click(button("Ditar no aparelho"));
  fireEvent.click(button("Cancelar voz"));
  await act(async () => availability.resolve("available"));
  expect(LocalRecognition.current).toBeUndefined();

  fireEvent.click(button("Gravar para transcrição online"));
  fireEvent.click(button("Cancelar voz"));
  await act(async () => permission.resolve({ getTracks: () => [{ stop: stopTrack }] }));
  expect(Recorder.current).toBeUndefined();
  expect(stopTrack).toHaveBeenCalledOnce();
  expect(requests()).toEqual([]);
});

it("requer envio explícito do áudio online e traz de volta somente o rascunho", async () => {
  render(<OraclePage />);
  fireEvent.click(button("Gravar para transcrição online"));
  await screen.findByRole("button", { name: "Parar e enviar áudio ao serviço online" });
  act(() => Recorder.current?.stop());
  expect(stopTrack).toHaveBeenCalledOnce();
  expect(requests()).toEqual([]);

  fireEvent.click(button("Gravar para transcrição online"));
  const sendAudio = await screen.findByRole("button", { name: "Parar e enviar áudio ao serviço online" });
  expect(requests()).toEqual([]);
  fireEvent.click(sendAudio);
  await waitFor(() => expect(draft().value).toBe("Pergunta online"));
  expect(requests()).toHaveLength(1);
  expect(requests()[0]?.[0]).toBe("/api/oracle/transcribe");
});

it("aborta a transcrição online e ignora uma resposta que chegue após o cancelamento", async () => {
  const pending = Promise.withResolvers<Response>();
  render(<OraclePage />);
  fetchMock.mockReturnValueOnce(pending.promise);
  fireEvent.click(button("Gravar para transcrição online"));
  fireEvent.click(await screen.findByRole("button", { name: "Parar e enviar áudio ao serviço online" }));
  await waitFor(() => expect(requests()).toHaveLength(1));
  const signal = requests()[0]?.[1].signal;
  fireEvent.click(button("Cancelar voz"));
  expect(signal.aborted).toBe(true);
  await act(async () => pending.resolve(Response.json({ transcript: "Resposta atrasada" })));
  expect(draft().value).toBe("");
  expect(draft().disabled).toBe(false);
});
