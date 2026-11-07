export const bookSpineSource = "https://m.media-amazon.com/images/G/01/kindle-publication/KDP_Print_Publishing_Guidelines_01_24_2018._CB1516837113_.pdf#page=27";

// KDP paperback with black ink on white paper: inches per page × cm per inch.
const spineCmPerPage = 0.002252 * 2.54;

export function estimateBookSpineCm(pages: number | null): number | null {
  return pages !== null && Number.isFinite(pages) && pages > 0 ? pages * spineCmPerPage : null;
}

export function summarizeBookSpines(books: readonly { pages: number | null }[]) {
  let totalCm = 0;
  let counted = 0;
  for (const { pages } of books) {
    const cm = estimateBookSpineCm(pages);
    if (cm === null) continue;
    totalCm += cm;
    counted++;
  }
  return {
    totalCm: counted > 0 ? totalCm : null,
    averageCm: counted > 0 ? totalCm / counted : null,
    counted,
    missing: books.length - counted,
  };
}

export function formatSpineCm(cm: number | null): string {
  return cm === null ? "—" : `${cm.toFixed(1).replace(".", ",")} cm`;
}

const heightReferences = [
  {
    label: "do travessão de futebol",
    meters: 2.44,
    source: "https://www.theifab.com/laws/latest/the-field-of-play/?side-menu-open=true",
  },
  {
    label: "do aro de basquete",
    meters: 3.05,
    source: "https://assets.fiba.basketball/image/upload/documents-corporate-fiba-official-rules-2024-official-basketball-rules-and-basketball-equipment.pdf#page=9",
  },
  {
    label: "de um macho adulto de girafa",
    meters: 5.49,
    source: "https://sdzwildlifeexplorers.org/animals/giraffe",
  },
] as const;

const comparisonTolerance = 0.1;

export function compareSpineHeight(meters: number) {
  let closest: (typeof heightReferences)[number] | null = null;
  let smallestDifference = Infinity;
  for (const reference of heightReferences) {
    const difference = Math.abs(meters - reference.meters) / reference.meters;
    if (difference <= comparisonTolerance && difference < smallestDifference) {
      closest = reference;
      smallestDifference = difference;
    }
  }
  return closest;
}
