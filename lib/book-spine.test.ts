import { expect, it } from "vitest";
import { compareSpineHeight, estimateBookSpineCm, formatSpineCm, summarizeBookSpines } from "./book-spine";

it("estima cerca de 1,43 cm para uma brochura de 250 páginas", () => {
  expect(estimateBookSpineCm(250)).toBeCloseTo(1.43, 4);
  expect(formatSpineCm(estimateBookSpineCm(250))).toBe("1,4 cm");
  expect(estimateBookSpineCm(24)).toBeCloseTo(0.1373, 4);
});

it("soma antes de arredondar e calcula a média apenas dos volumes com páginas", () => {
  const result = summarizeBookSpines([{ pages: 250 }, { pages: null }, { pages: 250 }, { pages: 0 }]);
  expect(result.totalCm).toBeCloseTo(2.86, 4);
  expect(result.averageCm).toBeCloseTo(1.43, 4);
  expect(formatSpineCm(result.totalCm)).toBe("2,9 cm");
  expect(result).toMatchObject({ counted: 2, missing: 2 });
});

it("exibe ausência de estimativa para acervo vazio ou sem páginas válidas", () => {
  expect(summarizeBookSpines([])).toEqual({ totalCm: null, averageCm: null, counted: 0, missing: 0 });
  const result = summarizeBookSpines([{ pages: null }, { pages: -1 }, { pages: NaN }]);
  expect(result).toEqual({ totalCm: null, averageCm: null, counted: 0, missing: 3 });
  expect(formatSpineCm(result.totalCm)).toBe("—");
});

it.each([
  [1.38, 1.50],
  [2.2, 2.44],
  [2.44, 2.44],
  [3.02, 3.05],
  [5.5, 5.49],
  [6.03, 5.49],
])("compara %f m à referência próxima de %f m", (meters, reference) => {
  expect(compareSpineHeight(meters)?.meters).toBe(reference);
});

it.each([0, 1.34, 1.66, 2.19, 2.72, 4.82, 6.04, 19.42])("exibe %f m sem analogia distante", (meters) => {
  expect(compareSpineHeight(meters)).toBeNull();
});
