export type BookStatus = "READ" | "READING" | "TO_READ" | "WISHLIST";

export interface Book {
  id: string;
  isbn: string;
  title: string;
  author: string;
  publishedDate: string | null;
  synopsis: string | null;
  coverUrl: string | null;
  status: BookStatus;
  currentPage: number | null;
  collection: string;
  notes: string | null;
  rating: number | null;
  genre: string | null;
  pages: number | null;
  customOrder: number | null;
  createdAt: Date;
  updatedAt: Date;
  userId: string;
}

// Fields needed to browse, filter, sort and calculate catalog statistics.
// Long text and editing-only metadata are fetched on demand.
export type CatalogBook = Omit<Book, "synopsis" | "notes" | "updatedAt" | "userId">;
