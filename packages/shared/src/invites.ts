import { z } from "zod"

export const InviteSchema = z.object({
  id: z.string(),
  label: z.string().nullable(),
  expiresAt: z.number(),
  usedAt: z.number().nullable(),
  createdAt: z.number(),
})
export type Invite = z.infer<typeof InviteSchema>

export const CreateInviteInputSchema = z.object({
  label: z.string().max(64).optional(),
})
export type CreateInviteInput = z.infer<typeof CreateInviteInputSchema>

export const CreateInviteResponseSchema = z.object({
  token: z.string(),
  joinUrl: z.string(),
  expiresAt: z.number(),
})
export type CreateInviteResponse = z.infer<typeof CreateInviteResponseSchema>

// A dead link (expired/used/not found) must read as a dead end, not a working form — the
// frontend branches on `valid` directly rather than trying to interpret an error status.
export const InviteValidationResponseSchema = z.discriminatedUnion("valid", [
  z.object({ valid: z.literal(true), label: z.string().nullable() }),
  z.object({ valid: z.literal(false), reason: z.enum(["not_found", "expired", "used"]) }),
])
export type InviteValidationResponse = z.infer<typeof InviteValidationResponseSchema>
