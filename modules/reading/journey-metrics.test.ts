import { describe, expect, it } from "vitest";
import { calculateJourney, completedThisYear } from "./journey-metrics";
import type { JourneyBook } from "./journey-metrics";
import { readingDay, storedDay, dayDate } from "./calendar";
import { calculateGoalProgress, yearlyGoalSchema } from "./goals";

const now = new Date("2026-10-14T01:00:00Z"); // Still October 13 in São Paulo.
const log = (date: string, pages = 10) => ({ date: dayDate(date), pages });
const book = (values: Partial<JourneyBook> = {}): JourneyBook => ({
  id: "b1", title: "Livro", author: "Autor", coverUrl: null, status: "READING",
  pages: 100, currentPage: 20, startedAt: null, finishedAt: null,
  createdAt: new Date("2026-01-02T12:00:00Z"), ...values,
});

describe("calendário da Jornada", () => {
  it("distingue instante de data armazenada no banco", () => {
    expect(readingDay(now)).toBe("2026-10-13");
    expect(storedDay(dayDate("2026-10-13"))).toBe("2026-10-13");
    expect(readingDay(dayDate("2026-10-13"))).toBe("2026-10-12");
  });

  it.each(["UTC", "America/Sao_Paulo", "Pacific/Kiritimati"])("não depende do fuso do servidor (%s)", zone => {
    const previous = process.env.TZ;
    process.env.TZ = zone;
    try {
      const result = calculateJourney([], [log("2026-10-11"), log("2026-10-12"), log("2026-10-13")], null, now);
      expect(result.streak).toBe(3);
      expect(result.heatmap.find(day => day.day === "2026-10-13")).toMatchObject({ label: "13/10/2026", pages: 10 });
    } finally {
      if (previous === undefined) delete process.env.TZ;
      else process.env.TZ = previous;
    }
  });

  it("mantém sequência até ontem e zera após uma lacuna", () => {
    expect(calculateJourney([], [log("2026-10-11"), log("2026-10-12")], null, now).streak).toBe(2);
    expect(calculateJourney([], [log("2026-10-11")], null, now).streak).toBe(0);
  });

  it("ignora dias sem páginas e futuros, somando duplicatas no mesmo dia", () => {
    const result = calculateJourney([], [log("2026-10-13", 5), log("2026-10-13", 7), log("2026-10-12", 0), log("2026-10-11", -2), log("2026-10-14", 99)], null, now);
    expect(result.streak).toBe(1);
    expect(result.bestStreak).toBe(1);
    expect(result.weekPages).toBe(12);
    expect(result.heatmap.find(day => day.day === "2026-10-14")?.pages).toBe(0);
  });

  it("conta exatamente os últimos sete dias incluindo hoje", () => {
    const result = calculateJourney([], [log("2026-10-06", 100), log("2026-10-07", 20), log("2026-10-13", 30)], null, now);
    expect(result.weekPages).toBe(50);
    expect(result.heatmap).toHaveLength(105);
    expect(dayDate(result.heatmap[0]!.day).getUTCDay()).toBe(0);
    expect(dayDate(result.heatmap.at(-1)!.day).getUTCDay()).toBe(6);
  });

  it("calcula recorde sem depender da ordem e atravessa ano bissexto", () => {
    const result = calculateJourney([], [log("2024-03-01"), log("2024-02-28"), log("2024-02-29"), log("2024-02-28")], null, new Date("2024-03-01T15:00:00Z"));
    expect(result.streak).toBe(3);
    expect(result.bestStreak).toBe(3);
  });
});

describe("estatísticas e metas", () => {
  it("retorna valores definidos para acervo vazio", () => {
    expect(calculateJourney([], [], null, now)).toMatchObject({
      pagesRead: 0, pace: null, avgDays: null, streak: 0, bestStreak: 0,
      goal: { percentage: null, remaining: null, reached: false },
    });
  });

  it("conta conclusões pelo ano local, incluindo fallback legado", () => {
    const atYearBoundary = new Date("2027-01-01T02:45:00Z");
    const books = [
      book({ status: "READ", finishedAt: new Date("2027-01-01T02:00:00Z") }),
      book({ id: "legacy", status: "READ", finishedAt: null }),
      book({ id: "future", status: "READ", finishedAt: new Date("2027-01-01T03:00:00Z") }),
      book({ id: "old", status: "READ", finishedAt: new Date("2026-01-01T02:00:00Z") }),
      book({ id: "reading", finishedAt: new Date("2026-10-01T12:00:00Z") }),
    ];
    const result = calculateJourney(books, [], 2, atYearBoundary);
    expect(result.year).toBe(2026);
    expect(result.readThisYear.map(b => b.id)).toEqual(["b1", "legacy"]);
    expect(result.goal).toEqual({ percentage: 100, remaining: 0, reached: true });
    expect(completedThisYear(books[0]!, new Date("2027-01-01T03:00:00Z"))).toBe(false);
  });

  it("usa dias de calendário e exclui intervalos de leitura inválidos", () => {
    const result = calculateJourney([
      book({ status: "READ", pages: 200, startedAt: new Date("2026-10-11T23:00:00Z"), finishedAt: new Date("2026-10-13T04:00:00Z") }),
      book({ status: "READ", pages: 100, startedAt: now, finishedAt: new Date("2026-01-01T12:00:00Z") }),
    ], [], null, now);
    expect(result.pace).toBe(100);
    expect(result.avgDays).toBe(2);
  });

  it("limita progresso a 100% e não produz prazo negativo", () => {
    const result = calculateJourney([book({ currentPage: 120, startedAt: new Date("2026-10-10T12:00:00Z") })], [], null, now);
    expect(result.pagesRead).toBe(100);
    expect(result.reading[0]?.progress).toMatchObject({ percentage: 100, etaDays: 0 });
    expect(calculateJourney([book({ currentPage: 0 })], [], null, now).reading[0]?.progress.etaDays).toBeNull();
  });

  it.each([null, undefined, 0, -1, 2.5])("não calcula percentual para meta inválida ou ausente (%s)", goal => {
    expect(calculateGoalProgress(10, goal).percentage).toBeNull();
  });
  it("limita percentual e aceita limpar a meta", () => {
    expect(calculateGoalProgress(1, 3)).toEqual({ percentage: 33, remaining: 2, reached: false });
    expect(calculateGoalProgress(20, 10)).toEqual({ percentage: 100, remaining: 0, reached: true });
    expect(yearlyGoalSchema.safeParse(null).success).toBe(true);
    expect(yearlyGoalSchema.safeParse(0).success).toBe(false);
    expect(yearlyGoalSchema.safeParse(1.5).success).toBe(false);
  });
});
