import { z } from "zod"
import type {
  PublicKeyCredentialCreationOptionsJSON,
  PublicKeyCredentialRequestOptionsJSON,
  RegistrationResponseJSON,
  AuthenticationResponseJSON,
} from "@simplewebauthn/browser"
import {
  RegisterInputSchema,
  LoginInputSchema,
  SessionResponseSchema,
  HasAccountResponseSchema,
  InviteSchema,
  CreateInviteInputSchema,
  CreateInviteResponseSchema,
  InviteValidationResponseSchema,
  MemberSchema,
  BodyMetricEntrySchema,
  CreateBodyMetricEntryInputSchema,
  HydrationTodayResponseSchema,
  HydrationHistoryResponseSchema,
  CreateHydrationEntryInputSchema,
  SleepEntrySchema,
  CreateSleepEntryInputSchema,
  MacroEntrySchema,
  UpsertMacroEntryInputSchema,
  UserSettingsSchema,
  UpsertUserSettingsInputSchema,
  RoutineSchema,
  SaveRoutineInputSchema,
  type RegisterInput,
  type LoginInput,
  type SessionResponse,
  type CreateInviteInput,
  type BodyMetricEntry,
  type CreateBodyMetricEntryInput,
  type HydrationTodayResponse,
  type CreateHydrationEntryInput,
  type SleepEntry,
  type CreateSleepEntryInput,
  type MacroEntry,
  type UpsertMacroEntryInput,
  type UserSettings,
  type UpsertUserSettingsInput,
  type Routine,
  type SaveRoutineInput,
  WorkoutLogSchema,
  WorkoutLogSetSchema,
  WorkoutSessionSummarySchema,
  AdherenceWeekSchema,
  LastPerformanceSchema,
  TodayWorkoutStatusSchema,
  StartWorkoutInputSchema,
  SkipWorkoutInputSchema,
  LogWorkoutSetInputSchema,
  UpdateWorkoutSetInputSchema,
  ExerciseProgressResponseSchema,
  MuscleVolumeResponseSchema,
  ExerciseSchema,
  AiProviderConfigSchema,
  UpsertAiProviderInputSchema,
  DetectEquipmentResponseSchema,
  GenerateRoutineResponseSchema,
  SessionListItemSchema,
  ChangePasswordInputSchema,
  PasskeyListItemSchema,
  UpdatePasskeyInputSchema,
  ThemePreferenceSchema,
  UpsertThemePreferenceInputSchema,
  type StartWorkoutInput,
  type SkipWorkoutInput,
  type LogWorkoutSetInput,
  type UpdateWorkoutSetInput,
  type UpsertAiProviderInput,
  type GenerateRoutineInput,
  type ChangePasswordInput,
  type UpdatePasskeyInput,
  type UpsertThemePreferenceInput,
  type Exercise,
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

// WebAuthn options/response payloads are opaque, browser-shaped objects from
// @simplewebauthn/browser — not worth re-declaring as zod schemas just to parse them.
async function requestJson<T>(path: string, init: RequestInit): Promise<T> {
  const res = await fetch(`/api${path}`, {
    ...init,
    credentials: "include",
    headers: { "Content-Type": "application/json", ...init.headers },
  })
  if (!res.ok) {
    const body = await res.json().catch(() => null)
    throw new ApiError(res.status, body?.error ?? `Request failed (${res.status})`)
  }
  return res.json() as Promise<T>
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

export function hasAccount() {
  return request("/auth/has-account", { method: "GET" }, HasAccountResponseSchema)
}

// --- invites (owner-only except validateInvite) ---
export function validateInvite(token: string) {
  return request(`/invites/${token}`, { method: "GET" }, InviteValidationResponseSchema)
}

export function listInvites() {
  return request("/invites", { method: "GET" }, z.object({ invites: z.array(InviteSchema) }))
}

export function createInvite(input: CreateInviteInput = {}) {
  CreateInviteInputSchema.parse(input)
  return request("/invites", { method: "POST", body: JSON.stringify(input) }, CreateInviteResponseSchema)
}

export function revokeInvite(id: string) {
  return request<undefined>(`/invites/${id}`, { method: "DELETE" }, z.undefined())
}

// --- members (owner-only) ---
export function listMembers() {
  return request("/members", { method: "GET" }, z.object({ members: z.array(MemberSchema) }))
}

export function deactivateMember(userId: string) {
  return request<undefined>(`/members/${userId}/deactivate`, { method: "POST" }, z.undefined())
}

export function reactivateMember(userId: string) {
  return request<undefined>(`/members/${userId}/reactivate`, { method: "POST" }, z.undefined())
}

// --- passkeys ---
export function passkeyRegisterOptions() {
  return requestJson<{ flowId: string; options: PublicKeyCredentialCreationOptionsJSON }>(
    "/auth/passkey/register-options",
    { method: "POST" },
  )
}

export function passkeyRegisterVerify(flowId: string, response: RegistrationResponseJSON, label?: string) {
  return requestJson<{ ok: true }>("/auth/passkey/register-verify", {
    method: "POST",
    body: JSON.stringify({ flowId, response, label }),
  })
}

export function passkeyLoginOptions() {
  return requestJson<{ flowId: string; options: PublicKeyCredentialRequestOptionsJSON }>(
    "/auth/passkey/login-options",
    { method: "POST" },
  )
}

export function passkeyLoginVerify(flowId: string, response: AuthenticationResponseJSON) {
  return requestJson<SessionResponse>("/auth/passkey/login-verify", {
    method: "POST",
    body: JSON.stringify({ flowId, response }),
  })
}

export function listPasskeys() {
  return request("/auth/passkey", { method: "GET" }, z.object({ passkeys: z.array(PasskeyListItemSchema) }))
}

export function updatePasskey(id: string, input: UpdatePasskeyInput) {
  UpdatePasskeyInputSchema.parse(input)
  return request(
    `/auth/passkey/${id}`,
    { method: "PATCH", body: JSON.stringify(input) },
    z.object({ passkey: PasskeyListItemSchema }),
  )
}

export function deletePasskey(id: string) {
  return request<undefined>(`/auth/passkey/${id}`, { method: "DELETE" }, z.undefined())
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

export function getHydrationHistory() {
  return request("/hydration/history", { method: "GET" }, HydrationHistoryResponseSchema)
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

export function getMacrosHistory(): Promise<{ entries: MacroEntry[] }> {
  return request("/macros/history", { method: "GET" }, z.object({ entries: z.array(MacroEntrySchema) }))
}

export function upsertMacros(input: UpsertMacroEntryInput): Promise<{ entry: MacroEntry }> {
  UpsertMacroEntryInputSchema.parse(input)
  return request("/macros", { method: "PUT", body: JSON.stringify(input) }, z.object({ entry: MacroEntrySchema }))
}

// --- settings (hydration goal, macro targets, equipment) ---
export function getSettings(): Promise<UserSettings> {
  return request("/settings", { method: "GET" }, UserSettingsSchema)
}

export function saveSettings(input: UpsertUserSettingsInput): Promise<UserSettings> {
  UpsertUserSettingsInputSchema.parse(input)
  return request("/settings", { method: "PUT", body: JSON.stringify(input) }, UserSettingsSchema)
}

// --- routine ---
export function getRoutine(): Promise<{ routine: Routine | null }> {
  return request("/routines", { method: "GET" }, z.object({ routine: RoutineSchema.nullable() }))
}

export function saveRoutine(input: SaveRoutineInput): Promise<{ routine: Routine }> {
  SaveRoutineInputSchema.parse(input)
  return request("/routines", { method: "PUT", body: JSON.stringify(input) }, z.object({ routine: RoutineSchema }))
}

// --- workouts ---
export function startWorkout(input: StartWorkoutInput) {
  StartWorkoutInputSchema.parse(input)
  return request("/workouts/start", { method: "POST", body: JSON.stringify(input) }, z.object({ workout: WorkoutLogSchema }))
}

export function logWorkoutSet(workoutId: string, input: LogWorkoutSetInput) {
  LogWorkoutSetInputSchema.parse(input)
  return request(
    `/workouts/${workoutId}/sets`,
    { method: "POST", body: JSON.stringify(input) },
    z.object({ set: WorkoutLogSetSchema, setsCompleted: z.number() }),
  )
}

export function finishWorkout(workoutId: string) {
  return request(`/workouts/${workoutId}/finish`, { method: "POST" }, z.object({ workout: WorkoutLogSchema }))
}

export function skipWorkout(input: SkipWorkoutInput) {
  SkipWorkoutInputSchema.parse(input)
  return request("/workouts/skip", { method: "POST", body: JSON.stringify(input) }, z.object({ workout: WorkoutLogSchema }))
}

export function getInProgressWorkout() {
  return request("/workouts/in-progress", { method: "GET" }, z.object({ workout: WorkoutLogSchema.nullable() }))
}

export function getRecentWorkouts(limit = 10) {
  return request(
    `/workouts/recent?limit=${limit}`,
    { method: "GET" },
    z.object({ sessions: z.array(WorkoutSessionSummarySchema) }),
  )
}

export function getAdherenceHistory(weeks = 12) {
  return request(
    `/workouts/adherence?weeks=${weeks}`,
    { method: "GET" },
    z.object({ history: z.array(AdherenceWeekSchema) }),
  )
}

export function getCycleStep(dayCount: number) {
  return request(
    `/workouts/cycle-step?dayCount=${dayCount}`,
    { method: "GET" },
    z.object({ cycleStep: z.number(), lastDayIndex: z.number().nullable() }),
  )
}

export function getLastPerformances() {
  return request(
    "/workouts/last-performance",
    { method: "GET" },
    z.object({ performances: z.array(LastPerformanceSchema) }),
  )
}

export function getWorkoutForDate(date?: string) {
  const q = date ? `?date=${encodeURIComponent(date)}` : ""
  return request(
    `/workouts/for-date${q}`,
    { method: "GET" },
    TodayWorkoutStatusSchema,
  )
}

export function getWorkout(id: string) {
  return request(`/workouts/${id}`, { method: "GET" }, z.object({ workout: WorkoutLogSchema }))
}

export function updateWorkoutSet(workoutId: string, setId: string, input: UpdateWorkoutSetInput) {
  UpdateWorkoutSetInputSchema.parse(input)
  return request(
    `/workouts/${workoutId}/sets/${setId}`,
    { method: "PATCH", body: JSON.stringify(input) },
    z.object({ set: WorkoutLogSetSchema }),
  )
}

export function getExerciseProgress(exerciseId: string) {
  return request(
    `/workouts/progress/exercise?exerciseId=${encodeURIComponent(exerciseId)}`,
    { method: "GET" },
    ExerciseProgressResponseSchema,
  )
}

export function getMuscleVolume(days: number | "all") {
  const param = days === "all" ? "all" : String(days)
  return request(
    `/workouts/progress/muscle-volume?days=${param}`,
    { method: "GET" },
    MuscleVolumeResponseSchema,
  )
}

// --- exercises ---
export function listExercises(params?: { q?: string; muscle?: string; equipment?: string }) {
  const qs = new URLSearchParams()
  if (params?.q) qs.set("q", params.q)
  if (params?.muscle) qs.set("muscle", params.muscle)
  if (params?.equipment) qs.set("equipment", params.equipment)
  const query = qs.toString()
  return request(`/exercises${query ? `?${query}` : ""}`, { method: "GET" }, z.object({ exercises: z.array(ExerciseSchema), total: z.number().optional() }))
}

export function fetchExerciseYoutube(id: string): Promise<{ exercise: Exercise }> {
  return request(`/exercises/${id}/youtube`, { method: "POST" }, z.object({ exercise: ExerciseSchema }))
}

export function getExercise(id: string): Promise<{ exercise: Exercise }> {
  return request(`/exercises/${id}`, { method: "GET" }, z.object({ exercise: ExerciseSchema }))
}

// --- account ---
export function listSessions() {
  return request("/account/sessions", { method: "GET" }, z.object({ sessions: z.array(SessionListItemSchema) }))
}

export function revokeSession(id: string) {
  return request<undefined>(`/account/sessions/${id}`, { method: "DELETE" }, z.undefined())
}

export function changePassword(input: ChangePasswordInput) {
  ChangePasswordInputSchema.parse(input)
  return request("/account/change-password", { method: "POST", body: JSON.stringify(input) }, z.object({ ok: z.literal(true) }))
}

// --- AI ---
export function getAiConfig() {
  return request("/ai/config", { method: "GET" }, AiProviderConfigSchema)
}

export function saveAiConfig(input: UpsertAiProviderInput) {
  UpsertAiProviderInputSchema.parse(input)
  return request("/ai/config", { method: "PUT", body: JSON.stringify(input) }, AiProviderConfigSchema)
}

export function listAiModels() {
  return request(
    "/ai/models",
    { method: "GET" },
    z.object({
      refreshedAt: z.number().nullable(),
      models: z.array(
        z.object({
          id: z.string(),
          name: z.string().optional(),
          isFree: z.boolean(),
          supportsVision: z.boolean(),
          supportsTools: z.boolean(),
        }),
      ),
    }),
  )
}

export function testAiConfig() {
  return request("/ai/test", { method: "POST" }, z.object({ ok: z.boolean(), reason: z.string().optional() }))
}

export function detectEquipment(imageBase64?: string) {
  return request(
    "/ai/detect-equipment",
    { method: "POST", body: JSON.stringify({ imageBase64 }) },
    DetectEquipmentResponseSchema,
  )
}

export function generateRoutineAi(input: GenerateRoutineInput) {
  return request("/ai/generate-routine", { method: "POST", body: JSON.stringify(input) }, GenerateRoutineResponseSchema)
}

// --- theme (D1 source of truth; localStorage is instant-paint cache only) ---
export function getThemePreference() {
  return request("/theme", { method: "GET" }, z.object({ theme: ThemePreferenceSchema }))
}

export function saveThemePreference(
  input: UpsertThemePreferenceInput,
  opts?: { signal?: AbortSignal },
) {
  UpsertThemePreferenceInputSchema.parse(input)
  return request(
    "/theme",
    { method: "PUT", body: JSON.stringify(input), signal: opts?.signal },
    z.object({ theme: ThemePreferenceSchema }),
  )
}
