// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";
import { OracleChatSettings } from "./OracleChatSettings";

afterEach(cleanup);
const props = () => ({
  mode: "EXPLORE" as const, onModeChange: vi.fn(), scope: "library" as const,
  onScopeChange: vi.fn(), temperature: 0.3, onTemperatureChange: vi.fn(),
  voiceOn: false, onVoiceChange: vi.fn(), playbackRate: 1, onPlaybackRateChange: vi.fn(),
  onOpenMemory: vi.fn(), onClear: vi.fn(), canClear: true,
});

describe("ajustes da conversa", () => {
  it("abre por teclado, expõe as opções e fecha com Escape devolvendo o foco", async () => {
    const user = userEvent.setup();
    render(<OracleChatSettings {...props()} />);
    const trigger = screen.getByRole("button", { name: "Ajustes da conversa" });
    trigger.focus();
    await user.keyboard("{Enter}");
    await user.tab();
    expect(document.activeElement).toBe(screen.getByRole("button", { name: "Recomendar" }));
    await user.keyboard("{Escape}");
    expect(screen.queryByRole("region", { name: "Ajustes da conversa" })).toBeNull();
    expect(document.activeElement).toBe(trigger);
    expect(trigger.getAttribute("aria-expanded")).toBe("false");
  });

  it("mantém os callbacks de modo, escopo, voz e criatividade", () => {
    const callbacks = props();
    render(<OracleChatSettings {...callbacks} />);
    fireEvent.click(screen.getByRole("button", { name: "Ajustes da conversa" }));
    expect(screen.getByRole("button", { name: "Explorar" }).getAttribute("aria-pressed")).toBe("true");
    fireEvent.click(screen.getByRole("button", { name: "Comparar" }));
    fireEvent.click(screen.getByRole("button", { name: "Acervo + catálogo" }));
    fireEvent.change(screen.getByRole("slider"), { target: { value: "0.7" } });
    fireEvent.click(screen.getByRole("button", { name: "Ativar voz" }));
    expect(callbacks.onModeChange).toHaveBeenCalledWith("COMPARE");
    expect(callbacks.onScopeChange).toHaveBeenCalledWith("all");
    expect(callbacks.onTemperatureChange).toHaveBeenCalledWith(0.7);
    expect(callbacks.onVoiceChange).toHaveBeenCalledOnce();
    fireEvent.click(screen.getByRole("button", { name: "Minha memória" }));
    expect(callbacks.onOpenMemory).toHaveBeenCalledOnce();
    expect(screen.queryByRole("region", { name: "Ajustes da conversa" })).toBeNull();
  });

  it("fecha ao tocar fora sem acionar controles internos", () => {
    const callbacks = props();
    render(<OracleChatSettings {...callbacks} />);
    fireEvent.click(screen.getByRole("button", { name: "Ajustes da conversa" }));
    fireEvent.pointerDown(document.body);
    expect(screen.queryByRole("region", { name: "Ajustes da conversa" })).toBeNull();
    expect(callbacks.onClear).not.toHaveBeenCalled();
  });
});
