import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";

export async function readJson<S extends z.ZodType>(
  request: NextRequest,
  schema: S
): Promise<
  { ok: true; data: z.infer<S> } | { ok: false; response: NextResponse }
> {
  const body = await request.json().catch(() => ({}));
  const parsed = schema.safeParse(body);
  if (!parsed.success) {
    return {
      ok: false,
      response: NextResponse.json(
        { error: parsed.error.issues[0]?.message ?? "Dados inválidos" },
        { status: 400 }
      ),
    };
  }
  return { ok: true, data: parsed.data };
}

export const bookStatusSchema = z.enum(
  ["READ", "READING", "TO_READ", "WISHLIST"],
  "Status inválido"
);

// Formulários mandam número como string ("" quando vazio) — normaliza pra number|null
export const optionalNumber = z.preprocess(
  (v) => {
    if (v === "" || v === undefined || v === null) return null;
    if (typeof v === "string") return Number(v);
    return v;
  },
  z.number("Deve ser um número").nullish()
);
