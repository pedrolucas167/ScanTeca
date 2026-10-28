// @vitest-environment jsdom
import { useRef } from "react";
import { act, cleanup, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { useOracleViewport } from "./useOracleViewport";

class VisibleViewport extends EventTarget {
  height = 844;
  offsetTop = 0;
  scale = 1;
}

function Harness() {
  const ref = useRef<HTMLDivElement>(null);
  useOracleViewport(ref);
  return <div ref={ref} data-testid="shell"><textarea aria-label="Mensagem" /></div>;
}

let viewport: VisibleViewport;
let media: MediaQueryList;
beforeEach(() => {
  viewport = new VisibleViewport();
  media = Object.assign(new EventTarget(), { matches: true }) as MediaQueryList;
  vi.stubGlobal("visualViewport", viewport);
  vi.stubGlobal("matchMedia", vi.fn(() => media));
  vi.stubGlobal("requestAnimationFrame", (callback: FrameRequestCallback) => { callback(0); return 1; });
  vi.stubGlobal("cancelAnimationFrame", vi.fn());
});
afterEach(() => { cleanup(); vi.unstubAllGlobals(); });

describe("viewport visível do chat", () => {
  it("acompanha o teclado e o deslocamento visual, recuperando a altura ao fechar", () => {
    render(<Harness />);
    const shell = screen.getByTestId("shell");
    expect(shell.style.getPropertyValue("--oracle-viewport-height")).toBe("844px");
    act(() => {
      screen.getByRole("textbox").focus();
      viewport.height = 430;
      viewport.offsetTop = 25;
      viewport.dispatchEvent(new Event("resize"));
    });
    expect(shell.style.getPropertyValue("--oracle-viewport-height")).toBe("430px");
    expect(shell.style.getPropertyValue("--oracle-viewport-top")).toBe("25px");
    expect(shell.dataset.keyboardOpen).toBe("true");
    act(() => { viewport.height = 844; viewport.offsetTop = 0; viewport.dispatchEvent(new Event("resize")); });
    expect(shell.dataset.keyboardOpen).toBe("false");
  });

  it("libera o tamanho no desktop e remove listeners ao desmontar", () => {
    const remove = vi.spyOn(viewport, "removeEventListener");
    const view = render(<Harness />);
    act(() => { Object.assign(media, { matches: false }); media.dispatchEvent(new Event("change")); });
    expect(screen.getByTestId("shell").style.getPropertyValue("--oracle-viewport-height")).toBe("");
    view.unmount();
    expect(remove).toHaveBeenCalledWith("resize", expect.any(Function));
    expect(remove).toHaveBeenCalledWith("scroll", expect.any(Function));
  });

  it("usa a altura da janela quando VisualViewport não está disponível", () => {
    vi.stubGlobal("visualViewport", undefined);
    render(<Harness />);
    expect(screen.getByTestId("shell").style.getPropertyValue("--oracle-viewport-height")).toBe(`${window.innerHeight}px`);
  });
});
