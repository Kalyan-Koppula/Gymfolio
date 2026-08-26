import { z } from "zod"
import { EquipmentSchema } from "./settings.ts"

export const AiProviderIdSchema = z.enum(["anthropic", "openai", "google", "local"])
export type AiProviderId = z.infer<typeof AiProviderIdSchema>

export const AiProviderConfigSchema = z.object({
  configured: z.boolean(),
  provider: AiProviderIdSchema.nullable(),
  endpointOverride: z.string().nullable(),
})
export type AiProviderConfig = z.infer<typeof AiProviderConfigSchema>

export const UpsertAiProviderInputSchema = z.object({
  provider: AiProviderIdSchema,
  apiKey: z.string().min(1),
  endpointOverride: z.union([z.string().url(), z.literal("")]).optional(),
})
export type UpsertAiProviderInput = z.infer<typeof UpsertAiProviderInputSchema>

export const DetectEquipmentInputSchema = z.object({
  // Base64 image optional for v0 — without a real vision call we still accept the
  // request shape; the Worker returns a degraded response when no key is configured.
  imageBase64: z.string().optional(),
})
export type DetectEquipmentInput = z.infer<typeof DetectEquipmentInputSchema>

export const DetectEquipmentResponseSchema = z.object({
  degraded: z.boolean(),
  reason: z.string().optional(),
  equipment: z.array(EquipmentSchema),
})
export type DetectEquipmentResponse = z.infer<typeof DetectEquipmentResponseSchema>

export const GenerateRoutineInputSchema = z.object({
  splitType: z.string(),
  equipment: z.array(EquipmentSchema),
  dayLabels: z.array(z.string()),
})
export type GenerateRoutineInput = z.infer<typeof GenerateRoutineInputSchema>

export const GenerateRoutineResponseSchema = z.object({
  degraded: z.boolean(),
  reason: z.string().optional(),
  days: z
    .array(
      z.object({
        label: z.string(),
        exerciseIds: z.array(z.string()),
      }),
    )
    .optional(),
})
export type GenerateRoutineResponse = z.infer<typeof GenerateRoutineResponseSchema>
