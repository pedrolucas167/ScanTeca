// @vitest-environment jsdom
import { createRef } from "react";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { OracleComposer } from "./OracleComposer";

beforeEach(() => vi.stubGlobal("matchMedia", vi.fn(() => ({ matches: false }))));
afterEach(() => { cleanup(); vi.unstubAllGlobals(); });

function setup(overrides: Partial<Parameters<typeof OracleComposer>[0]> = {}) {
  const props = {
    inputRef: createRef<HTMLTextAreaElement>(), value: "Minha pergunta", onChange: vi.fn(), onSend: vi.fn(),
    loading: false, recording: false, transcribing: false, micSupported: true,
    onMic: vi.fn(), onStop: vi.fn(), ...overrides,
  };
  render(<OracleComposer {...props} />);
  return props;
}

describe("compositor do Oráculo", () => {
  it("mantém Enter como nova linha no celular e envia pelo botão", () => {
    vi.mocked(window.matchMedia).mockReturnValue({ matches: true } as MediaQueryList);
    const props = setup();
    const field = screen.getByRole("textbox", { name: "Sua mensagem" });
    expect(fireEvent.keyDown(field, { key: "Enter" })).toBe(true);
    expect(props.onSend).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole("button", { name: "Enviar mensagem" }));
    expect(props.onSend).toHaveBeenCalledWith("Minha pergunta");
  });

  it("preserva Shift+Enter e composição de texto, enviando Enter no desktop", () => {
    const props = setup();
    const field = screen.getByRole("textbox");
    fireEvent.keyDown(field, { key: "Enter", shiftKey: true });
    fireEvent.keyDown(field, { key: "Enter", isComposing: true });
    fireEvent.keyDown(field, { key: "Enter", keyCode: 229 });
    expect(props.onSend).not.toHaveBeenCalled();
    fireEvent.keyDown(field, { key: "Enter" });
    expect(props.onSend).toHaveBeenCalledOnce();
  });

  it("permite o atalho explícito de envio no celular", () => {
    vi.mocked(window.matchMedia).mockReturnValue({ matches: true } as MediaQueryList);
    const props = setup();
    fireEvent.keyDown(screen.getByRole("textbox"), { key: "Enter", ctrlKey: true });
    expect(props.onSend).toHaveBeenCalledOnce();
  });

  it("bloqueia envio duplicado e mantém a ação de interromper durante geração", () => {
    const props = setup({ loading: true });
    expect(screen.getByRole("textbox")).toHaveProperty("disabled", true);
    fireEvent.submit(screen.getByRole("form", { name: "Mensagem para o Oráculo" }));
    expect(props.onSend).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole("button", { name: "Parar geração" }));
    expect(props.onStop).toHaveBeenCalledOnce();
  });

  it("mantém gravação revisável e bloqueia envio enquanto transcreve", () => {
    const props = setup({ recording: true });
    fireEvent.click(screen.getByRole("button", { name: "Parar e transcrever" }));
    expect(props.onMic).toHaveBeenCalledOnce();
    expect(screen.getByRole("button", { name: "Enviar mensagem" })).toHaveProperty("disabled", true);
    cleanup();
    setup({ transcribing: true });
    expect(screen.getByRole("status").textContent).toBe("Transcrevendo áudio…");
    expect(screen.getByRole("textbox")).toHaveProperty("disabled", true);
  });
});
