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

export const ExerciseMediaSchema = z.object({
  /** Object key e.g. exercises/slug/thumb.<hash>.webp */
  thumb: z.string().optional(),
  start: z.string().optional(),
  end: z.string().optional(),
})
export type ExerciseMedia = z.infer<typeof ExerciseMediaSchema>

export const ExerciseSchema = z.object({
  id: z.string(),
  name: z.string(),
  muscleGroups: z.array(MuscleGroupSchema),
  equipment: z.array(EquipmentSchema),
  difficulty: ExerciseDifficultySchema,
  instructions: z.string(),
  hasGif: z.boolean(),
  /** Content-addressed media object keys when seeded. */
  media: ExerciseMediaSchema.optional(),
  youtubeStatus: z.enum(["not_fetched", "pending", "ready"]),
  youtube: ExerciseYoutubeSchema.optional(),
})
export type Exercise = z.infer<typeof ExerciseSchema>
