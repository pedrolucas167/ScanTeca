import { z } from "zod";

export const yearlyGoalSchema = z.number("Meta anual deve ser um número inteiro positivo")
  .int("Meta anual deve ser um número inteiro positivo")
  .min(1, "Meta anual deve ser um número inteiro positivo").nullish();

export function calculateGoalProgress(completed: number, goal: number | null | undefined) {
  if (!goal || !Number.isInteger(goal) || goal < 1) {
    return { percentage: null, remaining: null, reached: false };
  }
  const count = Number.isFinite(completed) ? Math.max(0, Math.floor(completed)) : 0;
  return {
    percentage: Math.min(100, Math.round(count / goal * 100)),
    remaining: Math.max(0, goal - count), reached: count >= goal,
  };
}
