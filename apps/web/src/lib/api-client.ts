import { z } from "zod"
import {
  RegisterInputSchema,
  LoginInputSchema,
  SessionResponseSchema,
  BodyMetricEntrySchema,
  CreateBodyMetricEntryInputSchema,
  HydrationTodayResponseSchema,
  CreateHydrationEntryInputSchema,
  SleepEntrySchema,
  CreateSleepEntryInputSchema,
  MacroEntrySchema,
  UpsertMacroEntryInputSchema,
  type RegisterInput,
  type LoginInput,
  type SessionResponse,
  type BodyMetricEntry,
  type CreateBodyMetricEntryInput,
  type HydrationTodayResponse,
  type CreateHydrationEntryInput,
  type SleepEntry,
  type CreateSleepEntryInput,
  type MacroEntry,
  type UpsertMacroEntryInput,
} from "shared"

export class ApiError extends Error {
  status: number
  constructor(status: number, message: string) {
    super(message)
    this.status = status
  }
}

async function request<T>(path: string, init: RequestInit, schema: z.ZodType<T>): Promise<T> {
  const res = await fetch(`/api${path}`, {
    ...init,
    credentials: "include",
    headers: { "Content-Type": "application/json", ...init.headers },
  })
  if (!res.ok) {
    const body = await res.json().catch(() => null)
    throw new ApiError(res.status, body?.error ?? `Request failed (${res.status})`)
  }
  if (res.status === 204) return undefined as T
  return schema.parse(await res.json())
}

// --- auth ---
export function register(input: RegisterInput) {
  RegisterInputSchema.parse(input)
  return request("/auth/register", { method: "POST", body: JSON.stringify(input) }, z.object({ user: SessionResponseSchema.shape.user }))
}

export function login(input: LoginInput) {
  LoginInputSchema.parse(input)
  return request("/auth/login", { method: "POST", body: JSON.stringify(input) }, z.object({ user: SessionResponseSchema.shape.user }))
}

export function logout() {
  return request<undefined>("/auth/logout", { method: "POST" }, z.undefined())
}

export function getSession(): Promise<SessionResponse> {
  return request("/auth/session", { method: "GET" }, SessionResponseSchema)
}

// --- body metrics ---
export function getBodyMetrics(): Promise<{ entries: BodyMetricEntry[] }> {
  return request("/body-metrics", { method: "GET" }, z.object({ entries: z.array(BodyMetricEntrySchema) }))
}

export function createBodyMetricEntry(input: CreateBodyMetricEntryInput): Promise<{ entry: BodyMetricEntry }> {
  CreateBodyMetricEntryInputSchema.parse(input)
  return request(
    "/body-metrics",
    { method: "POST", body: JSON.stringify(input) },
    z.object({ entry: BodyMetricEntrySchema }),
  )
}

// --- hydration ---
export function getHydrationToday(date?: string): Promise<HydrationTodayResponse> {
  return request(`/hydration${date ? `?date=${date}` : ""}`, { method: "GET" }, HydrationTodayResponseSchema)
}

export function createHydrationEntry(input: CreateHydrationEntryInput) {
  CreateHydrationEntryInputSchema.parse(input)
  return request(
    "/hydration",
    { method: "POST", body: JSON.stringify(input) },
    z.object({ entry: HydrationTodayResponseSchema.shape.entries.element }),
  )
}

// --- sleep ---
export function getSleepHistory(): Promise<{ entries: SleepEntry[] }> {
  return request("/sleep", { method: "GET" }, z.object({ entries: z.array(SleepEntrySchema) }))
}

export function createSleepEntry(input: CreateSleepEntryInput): Promise<{ entry: SleepEntry }> {
  CreateSleepEntryInputSchema.parse(input)
  return request("/sleep", { method: "POST", body: JSON.stringify(input) }, z.object({ entry: SleepEntrySchema }))
}

// --- macros ---
export function getMacrosForDate(date?: string): Promise<{ entry: MacroEntry | null }> {
  return request(`/macros${date ? `?date=${date}` : ""}`, { method: "GET" }, z.object({ entry: MacroEntrySchema.nullable() }))
}

export function upsertMacros(input: UpsertMacroEntryInput): Promise<{ entry: MacroEntry }> {
  UpsertMacroEntryInputSchema.parse(input)
  return request("/macros", { method: "PUT", body: JSON.stringify(input) }, z.object({ entry: MacroEntrySchema }))
}
