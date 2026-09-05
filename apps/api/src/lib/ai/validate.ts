import { EquipmentSchema, type Equipment } from "shared"
import type { RoutineGenDay } from "./types.ts"
import { AiDegradedError } from "./types.ts"

export function validateEquipmentTags(raw: unknown, taxonomy: string[]): Equipment[] {
  if (!Array.isArray(raw)) {
    throw new AiDegradedError("AI response failed equipment schema validation")
  }
  const allowed = new Set(taxonomy)
  const out: Equipment[] = []
  for (const item of raw) {
    if (typeof item !== "string" || !allowed.has(item)) continue
    const parsed = EquipmentSchema.safeParse(item)
    if (parsed.success) out.push(parsed.data)
  }
  return [...new Set(out)]
}

/**
 * Unconditional server-side validation: every exercise ID must be in the
 * equipment-filtered allow-list (architecture §7 / FR-6.3).
 */
export function validateRoutineDays(
  rawDays: unknown,
  dayLabels: string[],
  allowedExerciseIds: string[],
): RoutineGenDay[] {
  if (!Array.isArray(rawDays)) {
    throw new AiDegradedError("AI response failed routine schema validation")
  }

  const allowed = new Set(allowedExerciseIds)
  const byLabel = new Map<string, string[]>()

  for (const day of rawDays) {
    if (!day || typeof day !== "object") continue
    const label = (day as { label?: unknown }).label
    const exerciseIds = (day as { exerciseIds?: unknown }).exerciseIds
    if (typeof label !== "string" || !Array.isArray(exerciseIds)) continue
    const ids = exerciseIds
      .filter((id): id is string => typeof id === "string" && allowed.has(id))
      .filter((id, i, arr) => arr.indexOf(id) === i)
    byLabel.set(label, ids)
  }

  const days: RoutineGenDay[] = dayLabels.map((label) => ({
    label,
    exerciseIds: byLabel.get(label) ?? [],
  }))

  const anyValid = days.some((d) => d.exerciseIds.length > 0)
  if (!anyValid) {
    throw new AiDegradedError("AI returned no valid exercise IDs for your equipment")
  }

  return days
}
