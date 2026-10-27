// @vitest-environment jsdom
import { act, cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";
import { TextComposer } from "./TextComposer";

afterEach(cleanup);

describe("compositor por teclado", () => {
  it("percorre emojis com Tab e fecha com Escape devolvendo foco", async () => {
    const user = userEvent.setup();
    render(<TextComposer placeholder="Texto" submitLabel="Publicar" onSubmit={vi.fn()} />);
    const trigger = screen.getByRole("button", { name: "Adicionar emoji" });
    await user.click(trigger);
    await user.tab();
    expect(document.activeElement).toBe(screen.getByRole("button", { name: "Adicionar livros" }));
    await user.keyboard("{Escape}");
    expect(screen.queryByRole("group", { name: "Emojis" })).toBeNull();
    expect(document.activeElement).toBe(trigger);
  });

  it("substitui o texto selecionado e devolve foco ao campo", async () => {
    const user = userEvent.setup();
    render(<TextComposer placeholder="Texto" submitLabel="Publicar" onSubmit={vi.fn()} />);
    const field = screen.getByRole("textbox") as HTMLTextAreaElement;
    await user.type(field, "abc");
    field.setSelectionRange(1, 2);
    await user.click(screen.getByRole("button", { name: "Adicionar emoji" }));
    await user.click(screen.getByRole("button", { name: "Adicionar livros" }));
    await waitFor(() => expect(field.value).toBe("a📚c"));
    await waitFor(() => expect(document.activeElement).toBe(field));
    expect(field.selectionStart).toBe(3);
  });

  it("preserva o rascunho em falha e impede envio duplicado enquanto aguarda", async () => {
    const user = userEvent.setup();
    let reject!: (error: Error) => void;
    const onSubmit = vi.fn(() => new Promise<void>((_, fail) => { reject = fail; }));
    render(<TextComposer placeholder="Texto" submitLabel="Publicar" onSubmit={onSubmit} />);
    const field = screen.getByRole("textbox") as HTMLTextAreaElement;
    await user.type(field, "Meu rascunho");
    await user.click(screen.getByRole("button", { name: "Publicar" }));
    expect(field.disabled).toBe(true);
    expect((screen.getByRole("button", { name: "Enviando..." }) as HTMLButtonElement).disabled).toBe(true);
    fireEvent.keyDown(field, { key: "Enter", ctrlKey: true });
    expect(onSubmit).toHaveBeenCalledTimes(1);
    await act(async () => reject(new Error("Falha controlada")));
    expect(await screen.findByRole("alert")).toHaveProperty("textContent", "Falha controlada");
    expect(field.value).toBe("Meu rascunho");
    expect(field.disabled).toBe(false);
  });

  it("confirma envio e limpa o campo somente depois do sucesso", async () => {
    const user = userEvent.setup();
    let resolve!: () => void;
    const onSubmit = vi.fn(() => new Promise<void>(done => { resolve = done; }));
    render(<TextComposer compact placeholder="Texto" submitLabel="Enviar" onSubmit={onSubmit} />);
    const field = screen.getByRole("textbox") as HTMLTextAreaElement;
    await user.type(field, "Comentário");
    await user.keyboard("{Control>}{Enter}{/Control}");
    expect(field.value).toBe("Comentário");
    await act(async () => resolve());
    await waitFor(() => expect(field.value).toBe(""));
    expect(screen.getByRole("status").textContent).toBe("Comentário enviado.");
    expect(onSubmit).toHaveBeenCalledWith("Comentário");
  });
});
