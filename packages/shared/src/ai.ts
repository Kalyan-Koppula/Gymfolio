import { z } from "zod"
import { EquipmentSchema } from "./settings.ts"

/** OpenRouter is the default; `local` covers any OpenAI-compatible custom endpoint. */
export const AiProviderIdSchema = z.enum(["openrouter", "local"])
export type AiProviderId = z.infer<typeof AiProviderIdSchema>

export const DEFAULT_OPENROUTER_MODEL = "openrouter/free"

export const AiProviderConfigSchema = z.object({
  configured: z.boolean(),
  provider: AiProviderIdSchema.nullable(),
  endpointOverride: z.string().nullable(),
  modelSlug: z.string().nullable(),
})
export type AiProviderConfig = z.infer<typeof AiProviderConfigSchema>

export const UpsertAiProviderInputSchema = z.object({
  provider: AiProviderIdSchema,
  apiKey: z.string().min(1),
  /** Defaults to openrouter/free when omitted or empty. */
  modelSlug: z.string().min(1).optional(),
  endpointOverride: z.union([z.string().url(), z.literal("")]).optional(),
})
export type UpsertAiProviderInput = z.infer<typeof UpsertAiProviderInputSchema>

export const DetectEquipmentInputSchema = z.object({
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

/** Cached OpenRouter model capabilities (from KV via GET /ai/models). */
export const OpenRouterModelCapabilitySchema = z.object({
  id: z.string(),
  name: z.string().optional(),
  isFree: z.boolean(),
  supportsVision: z.boolean(),
  supportsTools: z.boolean(),
})
export type OpenRouterModelCapability = z.infer<typeof OpenRouterModelCapabilitySchema>
