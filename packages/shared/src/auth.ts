import { z } from "zod"

export const RoleSchema = z.enum(["owner", "member"])
export type Role = z.infer<typeof RoleSchema>

export const UserSchema = z.object({
  id: z.string(),
  tenantId: z.string(),
  username: z.string(),
  role: RoleSchema,
  createdAt: z.number(),
})
export type User = z.infer<typeof UserSchema>

export const RegisterInputSchema = z.object({
  username: z.string().min(3).max(64),
  password: z.string().min(12).max(256),
  // Required for every registration after the instance's first (owner) account — enforced
  // server-side, not just hidden client-side.
  inviteToken: z.string().optional(),
})
export type RegisterInput = z.infer<typeof RegisterInputSchema>

export const LoginInputSchema = z.object({
  username: z.string().min(1),
  password: z.string().min(1),
})
export type LoginInput = z.infer<typeof LoginInputSchema>

export const SessionResponseSchema = z.object({
  user: UserSchema,
})
export type SessionResponse = z.infer<typeof SessionResponseSchema>

export const HasAccountResponseSchema = z.object({
  hasAccount: z.boolean(),
})
export type HasAccountResponse = z.infer<typeof HasAccountResponseSchema>

export const SessionListItemSchema = z.object({
  id: z.string(),
  lastActive: z.string(),
  current: z.boolean(),
  expiresAt: z.number(),
})
export type SessionListItem = z.infer<typeof SessionListItemSchema>

export const ChangePasswordInputSchema = z.object({
  currentPassword: z.string().min(1),
  newPassword: z.string().min(12).max(256),
})
export type ChangePasswordInput = z.infer<typeof ChangePasswordInputSchema>

export const PasskeyListItemSchema = z.object({
  id: z.string(),
  label: z.string().nullable(),
  deviceType: z.string().nullable(),
  backedUp: z.boolean(),
  createdAt: z.number(),
  lastUsedAt: z.number().nullable(),
})
export type PasskeyListItem = z.infer<typeof PasskeyListItemSchema>

export const UpdatePasskeyInputSchema = z.object({
  label: z.string().trim().min(1).max(80),
})
export type UpdatePasskeyInput = z.infer<typeof UpdatePasskeyInputSchema>
