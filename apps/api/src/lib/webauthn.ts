import type { Bindings } from "../types.ts"

export function webAuthnConfig(env: Bindings) {
  return { rpID: env.WEBAUTHN_RP_ID, rpName: env.WEBAUTHN_RP_NAME, origin: env.WEBAUTHN_ORIGIN }
}

const CHALLENGE_TTL_SECONDS = 5 * 60

type ChallengeRecord = { challenge: string; userId?: string }

function challengeKey(flowId: string) {
  return `webauthn_challenge:${flowId}`
}

/** One challenge per registration/login attempt, single-use and short-lived. `userId` is set
 * for registration (so register-verify can confirm the response belongs to the same account
 * that started the flow) and omitted for the discoverable-credential login flow. */
export async function storeChallenge(kv: KVNamespace, challenge: string, userId?: string): Promise<string> {
  const flowId = crypto.randomUUID()
  await kv.put(challengeKey(flowId), JSON.stringify({ challenge, userId } satisfies ChallengeRecord), {
    expirationTtl: CHALLENGE_TTL_SECONDS,
  })
  return flowId
}

export async function consumeChallenge(kv: KVNamespace, flowId: string): Promise<ChallengeRecord | null> {
  const key = challengeKey(flowId)
  const record = (await kv.get(key, "json")) as ChallengeRecord | null
  if (!record) return null
  await kv.delete(key)
  return record
}
