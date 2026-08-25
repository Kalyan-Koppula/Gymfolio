import { z } from "zod"
import { RoleSchema } from "./auth.ts"

export const MemberSchema = z.object({
  id: z.string(),
  username: z.string(),
  role: RoleSchema,
  deactivated: z.boolean(),
  createdAt: z.number(),
})
export type Member = z.infer<typeof MemberSchema>
