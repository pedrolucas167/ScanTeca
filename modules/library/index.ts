// Public entry point. Consumers must not import internal module files.
export { createBook, updateBook, deleteBook } from "./service";
export { bookCreateSchema, bookUpdateSchema } from "./contracts";
export type { CreateBookInput, UpdateBookInput } from "./contracts";
export { LibraryError } from "./errors";
