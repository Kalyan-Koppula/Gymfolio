import type { Equipment } from "shared"
import {
  chatWithForcedTool,
  withSchemaRetry,
  type CompatClientOptions,
  type ToolDefinition,
} from "./openai-compat.ts"
import type { AIProvider, RoutineGenInput, RoutineGenOutput } from "./types.ts"
import { validateEquipmentTags, validateRoutineDays } from "./validate.ts"

const OPENROUTER_BASE = "https://openrouter.ai/api/v1"

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
            description: "Equipment tags present in the image (subset of the taxonomy).",
          },
        },
        required: ["equipment"],
        additionalProperties: false,
      },
    },
  }
}

function routineTool(allowedExerciseIds: string[], dayLabels: string[]): ToolDefinition {
  // OpenAI-compatible enums can be large; still required by architecture §7.
  const idEnum =
    allowedExerciseIds.length > 0 ? allowedExerciseIds : ["__none__"]
  return {
    type: "function",
    function: {
      name: "propose_routine",
      description:
        "Propose a training routine using only the provided exercise IDs for each day label.",
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

export class OpenRouterProvider implements AIProvider {
  private readonly client: CompatClientOptions

  constructor(apiKey: string, modelSlug: string) {
    this.client = {
      baseUrl: OPENROUTER_BASE,
      apiKey,
      model: modelSlug,
      headers: {
        "HTTP-Referer": "https://gymfolio.app",
        "X-Title": "Gymfolio",
      },
    }
  }

  async detectEquipment(imageBase64: string, taxonomy: string[]): Promise<Equipment[]> {
    const dataUrl = imageBase64.startsWith("data:")
      ? imageBase64
      : `data:image/jpeg;base64,${imageBase64}`

    return withSchemaRetry(() =>
      chatWithForcedTool(this.client, {
        messages: [
          {
            role: "system",
            content:
              "You identify gym equipment from photos. Call report_detected_equipment with only tags from the given taxonomy.",
          },
          {
            role: "user",
            content: [
              {
                type: "text",
                text: `Taxonomy: ${taxonomy.join(", ")}. List every matching tag you can see.`,
              },
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
              "You build strength-training routines. Call propose_routine using only the allowed exercise IDs. Cover each day label.",
          },
          {
            role: "user",
            content: [
              `Split: ${input.splitType}`,
              `Equipment: ${input.equipment.join(", ")}`,
              `Days: ${input.dayLabels.join(", ")}`,
              "Allowed exercises (id: name):",
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
