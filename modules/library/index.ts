// Public entry point. Consumers must not import internal module files.
export { createBook, updateBook, deleteBook } from "./service";
export { bookCreateSchema, bookUpdateSchema } from "./contracts";
export type { CreateBookInput, UpdateBookInput } from "./contracts";
export { LibraryError } from "./errors";
export { scanBook, scanSchema } from "./scan";
export { enrichBooks, enrichSchema } from "./enrichment";
export { reorderBooks, reorderSchema } from "./reorder";
export { getCatalog, getCatalogDetails, getSharedCatalog, getBookDetail, getLibrarySettings } from "./queries";
export { updateLibrarySettings, settingsSchema } from "./settings";
export { LEGACY_DEFAULT_COLLECTION, getDefaultCollection, resolveCollection } from "./collections";
