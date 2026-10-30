import type { Book, CatalogBook } from "./types/book";

export function toCatalogBook(book: Book): CatalogBook {
  return {
    id: book.id, isbn: book.isbn, title: book.title, author: book.author,
    publishedDate: book.publishedDate, coverUrl: book.coverUrl, status: book.status,
    currentPage: book.currentPage, collection: book.collection, rating: book.rating,
    genre: book.genre, pages: book.pages, customOrder: book.customOrder, createdAt: book.createdAt,
  };
}
