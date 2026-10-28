// @vitest-environment jsdom
import { cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, expect, it, vi } from "vitest";
const mocks = vi.hoisted(() => ({ push: vi.fn() }));
vi.mock("next/navigation", () => ({ useRouter: () => ({ push: mocks.push }) }));
import ManualAddPage from "./page";

afterEach(() => { cleanup(); vi.restoreAllMocks(); vi.clearAllMocks(); vi.unstubAllGlobals(); });

it("permite preencher por rótulos e preserva o cadastro quando o servidor falha", async () => {
  vi.stubGlobal("fetch", vi.fn(async (url: string) => url === "/api/library-settings"
    ? Response.json({ setting: { name: "Minha Biblioteca" } })
    : Response.json({ error: "Não foi possível salvar agora" }, { status: 503 })));
  const user = userEvent.setup();
  render(<ManualAddPage />);
  await user.type(screen.getByRole("textbox", { name: "Título *" }), "Livro preservado");
  await user.type(screen.getByRole("textbox", { name: "Autor" }), "Autora");
  await user.type(screen.getByRole("spinbutton", { name: "Páginas" }), "120");
  await user.selectOptions(screen.getByRole("combobox", { name: "Status" }), "READING");
  await user.click(screen.getByRole("button", { name: "Salvar Livro" }));
  expect((await screen.findByRole("alert")).textContent).toContain("Não foi possível salvar agora");
  expect((screen.getByRole("textbox", { name: "Título *" }) as HTMLInputElement).value).toBe("Livro preservado");
  expect((screen.getByRole("spinbutton", { name: "Páginas" }) as HTMLInputElement).value).toBe("120");
  expect(mocks.push).not.toHaveBeenCalled();
});
