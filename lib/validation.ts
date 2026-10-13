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

export { bookStatusSchema, optionalNumber } from "./validation-schemas";
