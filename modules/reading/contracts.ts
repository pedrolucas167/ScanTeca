import { z } from "zod";

const entryFields = {
  type: z.enum(["REFLECTION", "QUOTE", "OCR"]),
  content: z.string().trim().min(1).max(5000),
  page: z.number().int().min(1).nullable().optional(),
  tags: z.array(z.string().trim().min(1).max(40)).max(10).default([]),
};
export const diaryCommandSchema = z.discriminatedUnion("action", [
  z.object({ action: z.literal("start"), bookId: z.string().cuid() }),
  z.object({ action: z.literal("pause"), sessionId: z.string().cuid(), currentPage: z.number().int().min(0) }),
  z.object({ action: z.literal("entry"), bookId: z.string().cuid(), sessionId: z.string().cuid().nullable().optional(), ...entryFields }),
  z.object({ action: z.literal("updateEntry"), entryId: z.string().cuid(), ...entryFields }),
  z.object({ action: z.literal("deleteEntry"), entryId: z.string().cuid() }),
]);
export type DiaryCommand = z.infer<typeof diaryCommandSchema>;

export const annotationSchema = z.object({
  bookId: z.string().min(1),
  chapter: z.number().int().min(0).optional(),
  paragraph: z.number().int().min(0),
  content: z.string().trim().min(1).max(2000),
  position: z.number().finite().optional(),
  type: z.enum(["comment", "highlight", "reaction"]).default("comment"),
  sessionId: z.string().min(1).optional(),
});
export const passageCommentSchema = z.object({
  bookId: z.string().min(1), passageId: z.string().min(1),
  content: z.string().trim().min(1).max(2000),
});
export type AnnotationInput = z.infer<typeof annotationSchema>;
