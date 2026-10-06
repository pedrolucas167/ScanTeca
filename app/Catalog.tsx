"use client";

interface Book {
  id: string;
  isbn: string;
  title: string;
  author: string;
  publishedDate: string | null;
  synopsis: string | null;
  coverUrl: string | null;
  status: "READ" | "READING" | "TO_READ" | "WISHLIST";
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

export default function Catalog({
  books,
  libraryName,
  shareEnabled,
  shareId,
}: {
  books: Book[];
  libraryName: string;
  shareEnabled: boolean;
  shareId: string | null;
}) {
  console.log("Catalog rendering with", books.length, "books");
  
  return (
    <div className="p-8">
      <h1 className="text-2xl font-bold">{libraryName}</h1>
      <p>Catalog minimalista - {books.length} livros</p>
      {books.length === 0 && <p>Nenhum livro encontrado</p>}
    </div>
  );
}
