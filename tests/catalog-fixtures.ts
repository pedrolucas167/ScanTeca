import type { Book } from "../lib/types/book";

export function catalogBooks(count: number): Book[] {
  return Array.from({ length: count }, (_, index) => ({
    id: `book-${index}`, isbn: `978${String(index).padStart(10, "0")}`,
    title: `Livro ${String(index).padStart(4, "0")}`, author: `Autora ${index % 13}`,
    publishedDate: String(1980 + index % 45),
    synopsis: `Sinopse fictícia do livro ${index}. `.repeat(35),
    notes: `Notas privadas do livro ${index}. `.repeat(12),
    coverUrl: null, status: "TO_READ", currentPage: null, collection: "Estante",
    rating: null, genre: `Gênero ${index % 7}`, pages: 200 + index,
    customOrder: index, createdAt: new Date("2026-10-01T12:00:00Z"),
    updatedAt: new Date("2026-10-01T12:00:00Z"), userId: "synthetic-owner",
  }));
}
