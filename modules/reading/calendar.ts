const dateFormatter = new Intl.DateTimeFormat("en-US", {
  timeZone: "America/Sao_Paulo", year: "numeric", month: "2-digit", day: "2-digit",
});

// Instants are interpreted in the product timezone. Database Date columns are
// calendar dates already, and must retain their UTC date without conversion.
export function readingDay(date: Date): string {
  const parts = dateFormatter.formatToParts(date);
  const part = (type: string) => parts.find(p => p.type === type)!.value;
  return `${part("year")}-${part("month")}-${part("day")}`;
}

export function storedDay(date: Date): string {
  return date.toISOString().slice(0, 10);
}

export function dayDate(day: string): Date {
  return new Date(`${day}T00:00:00.000Z`);
}

export function shiftDay(day: string, delta: number): string {
  const date = dayDate(day);
  date.setUTCDate(date.getUTCDate() + delta);
  return storedDay(date);
}

export function daysBetween(start: Date, end: Date): number {
  return Math.max(1, Math.round((dayDate(readingDay(end)).getTime() - dayDate(readingDay(start)).getTime()) / 86400000));
}

export function dayLabel(day: string): string {
  return dayDate(day).toLocaleDateString("pt-BR", { timeZone: "UTC" });
}
