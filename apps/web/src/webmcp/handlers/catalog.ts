import {
  createBodyMetricEntry,
  createHydrationEntry,
  createSleepEntry,
  finishWorkout,
  getBodyMetrics,
  getHydrationHistory,
  getHydrationToday,
  getInProgressWorkout,
  getLastPerformances,
  getMacrosForDate,
  getMacrosHistory,
  getRoutine,
  getSession,
  getSleepHistory,
  getWorkoutForDate,
  listExercises,
  logWorkoutSet,
  skipWorkout,
  startWorkout,
  upsertMacros,
} from "@/lib/api-client"
import {
  assertRunnable,
  errorResult,
  jsonResult,
  todayIso,
  WebMcpToolError,
  type ToolContext,
} from "../helpers"
import type { WebMcpToolDefinition } from "../types"

function num(v: unknown, name: string): number {
  if (typeof v !== "number" || !Number.isFinite(v)) {
    throw new WebMcpToolError("validation_error", `${name} must be a number`)
  }
  return v
}

function str(v: unknown, name: string): string {
  if (typeof v !== "string" || !v.trim()) {
    throw new WebMcpToolError("validation_error", `${name} must be a non-empty string`)
  }
  return v.trim()
}

function optDate(v: unknown): string {
  if (v == null || v === "") return todayIso()
  const d = str(v, "date")
  if (!/^\d{4}-\d{2}-\d{2}$/.test(d)) {
    throw new WebMcpToolError("validation_error", "date must be YYYY-MM-DD")
  }
  return d
}

function wrap(
  ctx: () => ToolContext,
  fn: (args: Record<string, unknown>) => Promise<unknown>,
): WebMcpToolDefinition["execute"] {
  return async (args) => {
    try {
      assertRunnable(ctx())
      const data = await fn(args ?? {})
      return jsonResult({ ok: true, data })
    } catch (err) {
      return errorResult(err)
    }
  }
}

export function buildToolCatalog(getCtx: () => ToolContext): WebMcpToolDefinition[] {
  return [
    {
      name: "get_session",
      description: "Return the signed-in Gymfolio user and onboarding state.",
      inputSchema: { type: "object", properties: {}, additionalProperties: false },
      annotations: { readOnlyHint: true },
      execute: wrap(getCtx, async () => getSession()),
    },
    {
      name: "get_today_overview",
      description: "Today's workout status, hydration total, and macros for a date (default today).",
      inputSchema: {
        type: "object",
        properties: {
          date: { type: "string", description: "YYYY-MM-DD; defaults to today" },
        },
        additionalProperties: false,
      },
      annotations: { readOnlyHint: true },
      execute: wrap(getCtx, async (args) => {
        const date = optDate(args.date)
        const [workout, hydration, macros] = await Promise.all([
          getWorkoutForDate(date),
          getHydrationToday(date),
          getMacrosForDate(date),
        ])
        return { date, workout, hydration, macros }
      }),
    },
    {
      name: "get_in_progress_workout",
      description: "Return the current in-progress workout and logged sets, if any.",
      inputSchema: { type: "object", properties: {}, additionalProperties: false },
      annotations: { readOnlyHint: true },
      execute: wrap(getCtx, async () => getInProgressWorkout()),
    },
    {
      name: "get_hydration",
      description: "Get today's hydration or recent history.",
      inputSchema: {
        type: "object",
        properties: {
          date: { type: "string", description: "YYYY-MM-DD for a single day" },
          history: { type: "boolean", description: "If true, return history instead of one day" },
        },
        additionalProperties: false,
      },
      annotations: { readOnlyHint: true },
      execute: wrap(getCtx, async (args) => {
        if (args.history === true) return getHydrationHistory()
        return getHydrationToday(optDate(args.date))
      }),
    },
    {
      name: "get_macros",
      description: "Get macros for a date or recent history.",
      inputSchema: {
        type: "object",
        properties: {
          date: { type: "string", description: "YYYY-MM-DD" },
          history: { type: "boolean", description: "If true, return history" },
        },
        additionalProperties: false,
      },
      annotations: { readOnlyHint: true },
      execute: wrap(getCtx, async (args) => {
        if (args.history === true) return getMacrosHistory()
        return getMacrosForDate(optDate(args.date))
      }),
    },
    {
      name: "get_sleep",
      description: "Return recent sleep entries.",
      inputSchema: { type: "object", properties: {}, additionalProperties: false },
      annotations: { readOnlyHint: true },
      execute: wrap(getCtx, async () => getSleepHistory()),
    },
    {
      name: "get_body_metrics",
      description: "Return body metric history (e.g. weight).",
      inputSchema: { type: "object", properties: {}, additionalProperties: false },
      annotations: { readOnlyHint: true },
      execute: wrap(getCtx, async () => getBodyMetrics()),
    },
    {
      name: "get_routine",
      description: "Return the active training routine summary.",
      inputSchema: { type: "object", properties: {}, additionalProperties: false },
      annotations: { readOnlyHint: true },
      execute: wrap(getCtx, async () => getRoutine()),
    },
    {
      name: "search_exercises",
      description: "Search the exercise library by name, muscle, or equipment.",
      inputSchema: {
        type: "object",
        properties: {
          q: { type: "string", description: "Name search" },
          muscle: { type: "string" },
          equipment: { type: "string" },
        },
        additionalProperties: false,
      },
      annotations: { readOnlyHint: true, untrustedContentHint: true },
      execute: wrap(getCtx, async (args) =>
        listExercises({
          q: typeof args.q === "string" ? args.q : undefined,
          muscle: typeof args.muscle === "string" ? args.muscle : undefined,
          equipment: typeof args.equipment === "string" ? args.equipment : undefined,
        }),
      ),
    },
    {
      name: "get_last_performance",
      description: "Last logged sets per exercise from completed workouts.",
      inputSchema: { type: "object", properties: {}, additionalProperties: false },
      annotations: { readOnlyHint: true },
      execute: wrap(getCtx, async () => getLastPerformances()),
    },
    {
      name: "log_hydration",
      description: "Log water intake in milliliters for a date.",
      inputSchema: {
        type: "object",
        properties: {
          amountMl: { type: "number", minimum: 1, maximum: 5000 },
          date: { type: "string", description: "YYYY-MM-DD; default today" },
        },
        required: ["amountMl"],
        additionalProperties: false,
      },
      annotations: { readOnlyHint: false },
      execute: wrap(getCtx, async (args) => {
        const amountMl = Math.round(num(args.amountMl, "amountMl"))
        if (amountMl < 1 || amountMl > 5000) {
          throw new WebMcpToolError("validation_error", "amountMl must be 1–5000")
        }
        return createHydrationEntry({ amountMl, date: optDate(args.date) })
      }),
    },
    {
      name: "log_macros",
      description: "Upsert calories/protein/carbs/fat for a date.",
      inputSchema: {
        type: "object",
        properties: {
          date: { type: "string" },
          calories: { type: "number" },
          protein: { type: "number" },
          carbs: { type: "number" },
          fat: { type: "number" },
        },
        required: ["calories", "protein", "carbs", "fat"],
        additionalProperties: false,
      },
      annotations: { readOnlyHint: false },
      execute: wrap(getCtx, async (args) =>
        upsertMacros({
          date: optDate(args.date),
          calories: Math.round(num(args.calories, "calories")),
          protein: Math.round(num(args.protein, "protein")),
          carbs: Math.round(num(args.carbs, "carbs")),
          fat: Math.round(num(args.fat, "fat")),
        }),
      ),
    },
    {
      name: "log_sleep",
      description: "Log sleep for a date with start/end times (HH:MM) and quality 1–5.",
      inputSchema: {
        type: "object",
        properties: {
          date: { type: "string" },
          startTime: { type: "string", description: "HH:MM" },
          endTime: { type: "string", description: "HH:MM" },
          quality: { type: "number", minimum: 1, maximum: 5 },
        },
        required: ["startTime", "endTime", "quality"],
        additionalProperties: false,
      },
      annotations: { readOnlyHint: false },
      execute: wrap(getCtx, async (args) => {
        const quality = Math.round(num(args.quality, "quality"))
        if (quality < 1 || quality > 5) {
          throw new WebMcpToolError("validation_error", "quality must be 1–5")
        }
        return createSleepEntry({
          date: optDate(args.date),
          startTime: str(args.startTime, "startTime"),
          endTime: str(args.endTime, "endTime"),
          quality: quality as 1 | 2 | 3 | 4 | 5,
        })
      }),
    },
    {
      name: "log_body_metric",
      description: "Log body weight (kg) for a date; optional measurement map.",
      inputSchema: {
        type: "object",
        properties: {
          date: { type: "string" },
          weightKg: { type: "number", minimum: 0.1 },
          measurements: {
            type: "object",
            additionalProperties: { type: "number" },
            description: "Optional named measurements in cm, e.g. waist",
          },
        },
        required: ["weightKg"],
        additionalProperties: false,
      },
      annotations: { readOnlyHint: false },
      execute: wrap(getCtx, async (args) => {
        const weightKg = num(args.weightKg, "weightKg")
        if (weightKg <= 0) throw new WebMcpToolError("validation_error", "weightKg must be positive")
        const measurements =
          args.measurements && typeof args.measurements === "object"
            ? (args.measurements as Record<string, number>)
            : undefined
        return createBodyMetricEntry({
          date: optDate(args.date),
          weightKg,
          measurements,
        })
      }),
    },
    {
      name: "start_workout",
      description: "Start a workout session for a routine day.",
      inputSchema: {
        type: "object",
        properties: {
          date: { type: "string" },
          dayLabel: { type: "string" },
          dayIndex: { type: "number" },
          setsPlanned: { type: "number" },
        },
        required: ["dayLabel", "dayIndex", "setsPlanned"],
        additionalProperties: false,
      },
      annotations: { readOnlyHint: false, consequentialHint: true },
      execute: wrap(getCtx, async (args) =>
        startWorkout({
          date: optDate(args.date),
          dayLabel: str(args.dayLabel, "dayLabel"),
          dayIndex: Math.round(num(args.dayIndex, "dayIndex")),
          setsPlanned: Math.round(num(args.setsPlanned, "setsPlanned")),
        }),
      ),
    },
    {
      name: "log_set",
      description: "Log a set on an in-progress workout (or mark skipped).",
      inputSchema: {
        type: "object",
        properties: {
          workoutId: { type: "string" },
          exerciseId: { type: "string" },
          setIndex: { type: "number" },
          actualReps: { type: "number" },
          actualWeightKg: { type: "number" },
          skipped: { type: "boolean" },
        },
        required: ["workoutId", "exerciseId", "setIndex"],
        additionalProperties: false,
      },
      annotations: { readOnlyHint: false },
      execute: wrap(getCtx, async (args) => {
        const skipped = args.skipped === true
        return logWorkoutSet(str(args.workoutId, "workoutId"), {
          exerciseId: str(args.exerciseId, "exerciseId"),
          setIndex: Math.round(num(args.setIndex, "setIndex")),
          actualReps: skipped ? 0 : Math.round(num(args.actualReps ?? 0, "actualReps")),
          actualWeightKg: skipped ? 0 : num(args.actualWeightKg ?? 0, "actualWeightKg"),
          skipped,
        })
      }),
    },
    {
      name: "finish_workout",
      description: "Mark an in-progress workout as completed.",
      inputSchema: {
        type: "object",
        properties: { workoutId: { type: "string" } },
        required: ["workoutId"],
        additionalProperties: false,
      },
      annotations: { readOnlyHint: false, consequentialHint: true },
      execute: wrap(getCtx, async (args) => finishWorkout(str(args.workoutId, "workoutId"))),
    },
    {
      name: "skip_workout",
      description: "Skip today's planned workout day without logging sets.",
      inputSchema: {
        type: "object",
        properties: {
          date: { type: "string" },
          dayLabel: { type: "string" },
          dayIndex: { type: "number" },
        },
        required: ["dayLabel", "dayIndex"],
        additionalProperties: false,
      },
      annotations: { readOnlyHint: false, consequentialHint: true },
      execute: wrap(getCtx, async (args) =>
        skipWorkout({
          date: optDate(args.date),
          dayLabel: str(args.dayLabel, "dayLabel"),
          dayIndex: Math.round(num(args.dayIndex, "dayIndex")),
        }),
      ),
    },
  ]
}
