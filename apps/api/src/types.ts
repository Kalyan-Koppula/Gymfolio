export type Bindings = {
  DB: D1Database
  SESSIONS_KV: KVNamespace
  ENVIRONMENT: string
}

export type AuthContext = {
  userId: string
  tenantId: string
}

export type Variables = {
  auth: AuthContext
}

export type AppEnv = { Bindings: Bindings; Variables: Variables }
