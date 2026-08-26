import { z } from "zod"
import { EquipmentSchema } from "./settings.ts"

export const MuscleGroupSchema = z.enum([
  "chest",
  "back",
  "shoulders",
  "legs",
  "arms",
  "core",
  "glutes",
])
export type MuscleGroup = z.infer<typeof MuscleGroupSchema>

export const ExerciseDifficultySchema = z.enum(["beginner", "intermediate", "advanced"])

export const ExerciseYoutubeSchema = z.object({
  videoId: z.string(),
  title: z.string(),
  channel: z.string(),
  views: z.string(),
})

export const ExerciseSchema = z.object({
  id: z.string(),
  name: z.string(),
  muscleGroups: z.array(MuscleGroupSchema),
  equipment: z.array(EquipmentSchema),
  difficulty: ExerciseDifficultySchema,
  instructions: z.string(),
  hasGif: z.boolean(),
  youtubeStatus: z.enum(["not_fetched", "pending", "ready"]),
  youtube: ExerciseYoutubeSchema.optional(),
})
export type Exercise = z.infer<typeof ExerciseSchema>
