export type Role = "owner" | "member"

/** Object storage for exercise media. Default "r2". */
export type MediaBackend = "r2" | "b2"

export type Bindings = {
  DB: D1Database
  SESSIONS_KV: KVNamespace
  ENVIRONMENT: string
  WEBAUTHN_RP_ID: string
  WEBAUTHN_RP_NAME: string
  WEBAUTHN_ORIGIN: string
  MASTER_KEY?: string
  YOUTUBE_API_KEY?: string
  /** "r2" (Cloudflare R2 binding) or "b2" (Backblaze S3-compatible). Default r2. */
  MEDIA_BACKEND?: string
  /** Present when MEDIA_BACKEND=r2 (or omitted). */
  MEDIA?: R2Bucket
  /** Backblaze B2 application key id (S3 access key id). Required when MEDIA_BACKEND=b2. */
  B2_KEY_ID?: string
  /** Backblaze B2 application key (S3 secret). Required when MEDIA_BACKEND=b2. */
  B2_APPLICATION_KEY?: string
  /** B2 bucket name. Required when MEDIA_BACKEND=b2. */
  B2_BUCKET?: string
  /** S3-compatible endpoint, e.g. https://s3.us-west-004.backblazeb2.com */
  B2_ENDPOINT?: string
  /** Optional; inferred from B2_ENDPOINT when omitted. */
  B2_REGION?: string
  /**
   * Public CDN / object origin (no trailing slash). Objects must be readable at
   * `{MEDIA_PUBLIC_ORIGIN}/{objectKey}`. When set, `/api/media` 302s instead of
   * streaming — use R2 custom domain, r2.dev, or B2+Cloudflare CDN / friendly URL.
   */
  MEDIA_PUBLIC_ORIGIN?: string
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
