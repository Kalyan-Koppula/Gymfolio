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
