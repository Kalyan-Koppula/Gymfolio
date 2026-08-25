export type Role = "owner" | "member"

export type Bindings = {
  DB: D1Database
  SESSIONS_KV: KVNamespace
  ENVIRONMENT: string
  WEBAUTHN_RP_ID: string
  WEBAUTHN_RP_NAME: string
  WEBAUTHN_ORIGIN: string
}

export type AuthContext = {
  userId: string
  tenantId: string
  role: Role
}

export type Variables = {
  auth: AuthContext
}

export type AppEnv = { Bindings: Bindings; Variables: Variables }
