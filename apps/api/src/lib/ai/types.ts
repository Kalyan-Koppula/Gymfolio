import type { Equipment } from "shared"

export type RoutineGenInput = {
  splitType: string
  equipment: Equipment[]
  dayLabels: string[]
  /** Equipment-filtered exercise IDs — used both as the tool-call enum and for server validation. */
  allowedExerciseIds: string[]
  /** Short labels for the model (id → name). */
  exerciseCatalog: Array<{ id: string; name: string }>
}

export type RoutineGenDay = {
  label: string
  exerciseIds: string[]
}

export type RoutineGenOutput = {
  days: RoutineGenDay[]
}

export interface AIProvider {
  detectEquipment(imageBase64: string, taxonomy: string[]): Promise<Equipment[]>
  generateRoutine(input: RoutineGenInput): Promise<RoutineGenOutput>
}

export class AiDegradedError extends Error {
  readonly degraded = true as const
  constructor(readonly reason: string) {
    super(reason)
    this.name = "AiDegradedError"
  }
}

export function isAiDegradedError(err: unknown): err is AiDegradedError {
  return err instanceof AiDegradedError
}
