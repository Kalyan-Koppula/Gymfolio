import type { Equipment } from "shared"
import {
  chatWithForcedTool,
  withSchemaRetry,
  type CompatClientOptions,
  type ToolDefinition,
} from "./openai-compat.ts"
import { AiDegradedError, type AIProvider, type RoutineGenInput, type RoutineGenOutput } from "./types.ts"
import { validateEquipmentTags, validateRoutineDays } from "./validate.ts"

function detectTool(taxonomy: string[]): ToolDefinition {
  return {
    type: "function",
    function: {
      name: "report_detected_equipment",
      description: "Report which gym equipment is visible in the photo.",
      parameters: {
        type: "object",
        properties: {
          equipment: {
            type: "array",
            items: { type: "string", enum: taxonomy },
          },
        },
        required: ["equipment"],
        additionalProperties: false,
      },
    },
  }
}

function routineTool(allowedExerciseIds: string[], dayLabels: string[]): ToolDefinition {
  const idEnum = allowedExerciseIds.length > 0 ? allowedExerciseIds : ["__none__"]
  return {
    type: "function",
    function: {
      name: "propose_routine",
      description: "Propose a training routine using only allowed exercise IDs.",
      parameters: {
        type: "object",
        properties: {
          days: {
            type: "array",
            items: {
              type: "object",
              properties: {
                label: { type: "string", enum: dayLabels.length > 0 ? dayLabels : ["Day"] },
                exerciseIds: {
                  type: "array",
                  items: { type: "string", enum: idEnum },
                  minItems: 1,
                  maxItems: 8,
                },
              },
              required: ["label", "exerciseIds"],
              additionalProperties: false,
            },
          },
        },
        required: ["days"],
        additionalProperties: false,
      },
    },
  }
}

/**
 * Generic OpenAI-compatible adapter for local Ollama/LM Studio or a direct vendor base URL.
 */
export class CustomEndpointProvider implements AIProvider {
  private readonly client: CompatClientOptions

  constructor(apiKey: string, modelSlug: string, endpointOverride: string) {
    const base = endpointOverride.replace(/\/$/, "")
    // Accept either .../v1 or a host root.
    const baseUrl = base.endsWith("/v1") ? base : `${base}/v1`
    this.client = { baseUrl, apiKey, model: modelSlug }
  }

  async detectEquipment(imageBase64: string, taxonomy: string[]): Promise<Equipment[]> {
    if (!imageBase64.trim()) {
      throw new AiDegradedError("No image provided for equipment detection")
    }
    const dataUrl = imageBase64.startsWith("data:")
      ? imageBase64
      : `data:image/jpeg;base64,${imageBase64}`

    return withSchemaRetry(() =>
      chatWithForcedTool(this.client, {
        messages: [
          {
            role: "system",
            content:
              "Identify gym equipment from the photo. Call report_detected_equipment with taxonomy tags only.",
          },
          {
            role: "user",
            content: [
              { type: "text", text: `Taxonomy: ${taxonomy.join(", ")}` },
              { type: "image_url", image_url: { url: dataUrl } },
            ],
          },
        ],
        tool: detectTool(taxonomy),
        parse: (args) => {
          const equipment = (args as { equipment?: unknown })?.equipment
          return validateEquipmentTags(equipment, taxonomy)
        },
      }),
    )
  }

  async generateRoutine(input: RoutineGenInput): Promise<RoutineGenOutput> {
    const catalogLines = input.exerciseCatalog
      .slice(0, 200)
      .map((e) => `${e.id}: ${e.name}`)
      .join("\n")

    return withSchemaRetry(async () => {
      const days = await chatWithForcedTool(this.client, {
        messages: [
          {
            role: "system",
            content:
              "Build a strength routine. Call propose_routine using only allowed exercise IDs.",
          },
          {
            role: "user",
            content: [
              `Split: ${input.splitType}`,
              `Equipment: ${input.equipment.join(", ")}`,
              `Days: ${input.dayLabels.join(", ")}`,
              "Allowed exercises:",
              catalogLines || "(none)",
            ].join("\n"),
          },
        ],
        tool: routineTool(input.allowedExerciseIds, input.dayLabels),
        parse: (args) => {
          const rawDays = (args as { days?: unknown })?.days
          return validateRoutineDays(rawDays, input.dayLabels, input.allowedExerciseIds)
        },
      })
      return { days }
    })
  }
}
