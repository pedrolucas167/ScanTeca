export class LibraryError extends Error {
  constructor(
    public readonly code: "INVALID_INPUT" | "NOT_FOUND" | "CONFLICT",
    message: string,
  ) {
    super(message);
    this.name = "LibraryError";
  }
}
