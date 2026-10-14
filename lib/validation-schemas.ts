import { z } from "zod";

export const bookStatusSchema = z.enum(
  ["READ", "READING", "TO_READ", "WISHLIST"],
  "Status inválido",
);

// Forms submit numeric values as strings, or an empty string to clear a field.
export const optionalNumber = z.preprocess(
  value => {
    if (value === "" || value === undefined || value === null) return null;
    return typeof value === "string" ? Number(value) : value;
  },
  z.number("Deve ser um número").nullish(),
);
