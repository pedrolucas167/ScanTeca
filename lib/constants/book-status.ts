export const BOOK_STATUS_LABELS: Record<string, string> = {
  READ: "Lido",
  READING: "Lendo",
  TO_READ: "A ler",
  WISHLIST: "Desejo",
};

export const BOOK_STATUS_CLASSES: Record<string, string> = {
  READ: "bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400",
  READING: "bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-400",
  TO_READ: "bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-400",
  WISHLIST:
    "bg-purple-100 text-purple-800 dark:bg-purple-900/30 dark:text-purple-400",
};

export const BOOK_STATUS_CLASSES_STITCH: Record<string, string> = {
  READ: "bg-primary-container text-on-primary-container",
  READING: "bg-emerald-950/80 text-emerald-300 border border-emerald-500/40",
  TO_READ: "bg-amber-950/80 text-amber-300 border border-amber-500/40",
  WISHLIST: "bg-secondary-container/30 text-secondary",
};
