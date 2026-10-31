// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeAll, expect, it, vi } from "vitest";
import { OracleMemoryDialog } from "./OracleMemoryDialog";

beforeAll(() => {
  HTMLDialogElement.prototype.showModal = function () { this.setAttribute("open", ""); };
  HTMLDialogElement.prototype.close = function () { this.removeAttribute("open"); };
});
afterEach(() => { cleanup(); vi.unstubAllGlobals(); });

const saved = { oracleProfile: "Gosto de poesia", oracleMemoryEnabled: true, oracleProfileVersion: 5 };
async function open(fetch = vi.fn().mockResolvedValue(Response.json({ setting: saved }))) {
  vi.stubGlobal("fetch", fetch);
  const onClose = vi.fn();
  const rendered = render(<OracleMemoryDialog onClose={onClose} />);
  await waitFor(() => expect((screen.getByRole("textbox", { name: "Preferências e objetivos" }) as HTMLTextAreaElement).value).toBe(saved.oracleProfile));
  return { fetch, onClose, ...rendered };
}

it("loads the current profile on every opening", async () => {
  const first = await open();
  expect(first.fetch).toHaveBeenCalledWith("/api/library-settings", expect.objectContaining({ cache: "no-store" }));
  first.unmount();
  const fetch = vi.fn().mockResolvedValue(Response.json({ setting: { ...saved, oracleProfile: "Novo objetivo", oracleProfileVersion: 6 } }));
  vi.stubGlobal("fetch", fetch);
  render(<OracleMemoryDialog onClose={vi.fn()} />);
  await waitFor(() => expect((screen.getByRole("textbox") as HTMLTextAreaElement).value).toBe("Novo objetivo"));
});

it("saves edited preferences and the learning choice with the current version", async () => {
  const fetch = vi.fn().mockResolvedValueOnce(Response.json({ setting: saved }))
    .mockResolvedValueOnce(Response.json({ setting: { ...saved, oracleProfile: "Prefiro contos", oracleMemoryEnabled: false, oracleProfileVersion: 6 } }));
  await open(fetch);
  fireEvent.change(screen.getByRole("textbox"), { target: { value: "Prefiro contos" } });
  fireEvent.click(screen.getByRole("checkbox"));
  fireEvent.click(screen.getByRole("button", { name: "Salvar memória" }));
  await screen.findByText("Memória salva.");
  expect(JSON.parse(fetch.mock.calls[1]![1].body)).toEqual({ oracleProfile: "Prefiro contos", oracleMemoryEnabled: false, oracleProfileVersion: 5 });
});

it("erases and pauses rather than silently learning the profile again", async () => {
  const fetch = vi.fn().mockResolvedValueOnce(Response.json({ setting: saved }))
    .mockResolvedValueOnce(Response.json({ setting: { oracleProfile: null, oracleMemoryEnabled: false, oracleProfileVersion: 6 } }));
  await open(fetch);
  fireEvent.click(screen.getByRole("button", { name: "Apagar memória e pausar" }));
  await screen.findByText("Memória apagada. Aprendizado pausado.");
  expect(JSON.parse(fetch.mock.calls[1]![1].body)).toEqual({ oracleProfile: null, oracleMemoryEnabled: false, oracleProfileVersion: 5 });
  expect((screen.getByRole("textbox") as HTMLTextAreaElement).value).toBe("");
  expect((screen.getByRole("checkbox") as HTMLInputElement).checked).toBe(false);
});

it.each([503, 409])("preserves the draft when saving fails (%s)", async status => {
  const fetch = vi.fn().mockResolvedValueOnce(Response.json({ setting: saved })).mockResolvedValueOnce(new Response(null, { status }))
    .mockResolvedValueOnce(Response.json({ setting: { ...saved, oracleProfile: "Perfil atualizado por outra conversa", oracleProfileVersion: 6 } }));
  await open(fetch);
  fireEvent.change(screen.getByRole("textbox"), { target: { value: "Meu rascunho" } });
  fireEvent.click(screen.getByRole("button", { name: "Salvar memória" }));
  await screen.findByRole("alert");
  expect((screen.getByRole("textbox") as HTMLTextAreaElement).value).toBe("Meu rascunho");
  if (status === 409) {
    expect((screen.getByRole("button", { name: "Salvar memória" }) as HTMLButtonElement).disabled).toBe(true);
    expect(screen.getByRole("button", { name: "Recarregar memória" })).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "Recarregar memória" }));
    await screen.findByText("Versão atual carregada. Confira seu rascunho antes de salvar.");
    expect((screen.getByRole("textbox") as HTMLTextAreaElement).value).toBe("Meu rascunho");
    expect(screen.getByText("Perfil atualizado por outra conversa")).toBeTruthy();
    expect((screen.getByRole("button", { name: "Salvar memória" }) as HTMLButtonElement).disabled).toBe(false);
  }
});

it("keeps saving disabled if the profile could not be loaded", async () => {
  vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response(null, { status: 503 })));
  render(<OracleMemoryDialog onClose={vi.fn()} />);
  await screen.findByRole("alert");
  expect((screen.getByRole("button", { name: "Salvar memória" }) as HTMLButtonElement).disabled).toBe(true);
  expect(screen.getByRole("button", { name: "Recarregar memória" })).toBeTruthy();
});
