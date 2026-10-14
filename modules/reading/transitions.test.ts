import { describe, it, expect } from "vitest";
import { planReadingTransition, ReadingError } from "./transitions";
import type { ReadingState } from "./transitions";

const now = new Date("2026-10-13T15:00:00Z");
const state: ReadingState = {
  status: "READING", startedAt: new Date("2026-10-01T12:00:00Z"),
  finishedAt: null, currentPage: 20, readCount: 0, reclubeCount: 0,
};

describe("transições de leitura", () => {
  it("conclui uma leitura uma vez e preserva a conclusão em edições", () => {
    const first = planReadingTransition(state, { status: "READ" }, now);
    expect(first).toMatchObject({ completed: true, data: { readCount: 1, finishedAt: now } });
    const repeat = planReadingTransition({ ...state, ...first.data }, { status: "READ" });
    expect(repeat.completed).toBe(false);
    expect(repeat.data).not.toHaveProperty("readCount");
    expect(repeat.data).not.toHaveProperty("finishedAt");
  });

  it("registra apenas páginas novas e preserva zero como progresso válido", () => {
    expect(planReadingTransition(state, { currentPage: 35 }).pagesRead).toBe(15);
    expect(planReadingTransition(state, { currentPage: 20 }).pagesRead).toBe(0);
    expect(planReadingTransition(state, { currentPage: 0 })).toMatchObject({
      pagesRead: 0, data: { currentPage: 0 },
    });
  });

  it("reinicia a releitura sem contar páginas ou conclusão no mesmo pedido", () => {
    const result = planReadingTransition({ ...state, status: "READ", readCount: 1 }, {
      startReclube: true, currentPage: 50, status: "READ",
    }, now);
    expect(result).toMatchObject({
      completed: false, pagesRead: 0,
      data: { status: "READING", currentPage: 0, reclubeCount: 1, finishedAt: null },
    });
    expect(result.data).not.toHaveProperty("readCount");
  });

  it("rejeita releitura de livro ainda não concluído", () => {
    expect(() => planReadingTransition(state, { startReclube: true })).toThrow(ReadingError);
  });

  it("conta uma nova conclusão depois da releitura", () => {
    const result = planReadingTransition({ ...state, readCount: 1, reclubeCount: 1 }, { status: "READ" }, now);
    expect(result.data.readCount).toBe(2);
  });
});
