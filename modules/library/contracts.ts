import { z } from "zod";
import { bookStatusSchema, optionalNumber } from "@/lib/validation-schemas";

export const bookCreateSchema = z.object({
  isbn: z.string().nullish(),
  title: z.string("Título é obrigatório").trim().min(1, "Título é obrigatório"),
  author: z.string().nullish(),
  publishedDate: z.string().nullish(),
  synopsis: z.string().nullish(),
  coverUrl: z.string().nullish(),
  status: bookStatusSchema.nullish(),
  collection: z.string().nullish(),
  notes: z.string().nullish(),
  rating: optionalNumber,
  genre: z.string().nullish(),
  pages: optionalNumber,
  customOrder: optionalNumber,
});

export const bookUpdateSchema = bookCreateSchema.partial().extend({
  id: z.string("ID do livro é obrigatório").min(1, "ID do livro é obrigatório"),
  currentPage: optionalNumber,
  sessionNote: z.string().nullish(),
  startReclube: z.boolean().optional(),
});


export type CreateBookInput = z.infer<typeof bookCreateSchema>;
export type UpdateBookInput = z.infer<typeof bookUpdateSchema>;
