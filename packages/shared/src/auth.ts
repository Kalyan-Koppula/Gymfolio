import { z } from "zod"

export const UserSchema = z.object({
  id: z.string(),
  tenantId: z.string(),
  username: z.string(),
  createdAt: z.number(),
})
export type User = z.infer<typeof UserSchema>

export const RegisterInputSchema = z.object({
  username: z.string().min(3).max(64),
  password: z.string().min(12).max(256),
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
