import { randomBytes, scrypt as scryptCallback, timingSafeEqual } from "node:crypto"
import { promisify } from "node:util"

const scrypt = promisify(scryptCallback)
const KEY_LENGTH = 64

/**
 * scrypt, not bcrypt — bcrypt has no native implementation in the Workers runtime.
 *
 * Note on how this differs from the architecture doc's original wording: scrypt is NOT
 * part of the standard Web Crypto API (`crypto.subtle`) — verified against Cloudflare's
 * own docs and workerd's issue tracker before writing this. It IS genuinely available via
 * `node:crypto`'s `scrypt`/`scryptSync`, gated behind the `nodejs_compat` compatibility
 * flag (already set in wrangler.toml) — same algorithm the architecture called for, via
 * the mechanism that actually exists in this runtime.
 *
 * Hex encode/decode below are hand-rolled rather than `Buffer#toString('hex')` /
 * `Buffer.from(hex, 'hex')` — @cloudflare/workers-types and @types/node both being loaded
 * (Workers runtime + nodejs_compat) merge into a global Buffer/Uint8Array type whose
 * encoding-aware overloads don't survive the merge, so those calls fail to type-check even
 * though they'd work fine at runtime. Operating on plain Uint8Array sidesteps it entirely.
 */
function toHex(bytes: Uint8Array): string {
  return Array.from(bytes)
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("")
}

function fromHex(hex: string): Uint8Array {
  const bytes = new Uint8Array(hex.length / 2)
  for (let i = 0; i < bytes.length; i++) bytes[i] = parseInt(hex.slice(i * 2, i * 2 + 2), 16)
  return bytes
}

export async function hashPassword(password: string): Promise<string> {
  const salt = randomBytes(16)
  const derivedKey = (await scrypt(password, salt, KEY_LENGTH)) as Uint8Array
  return `${toHex(salt)}:${toHex(derivedKey)}`
}

export async function verifyPassword(password: string, stored: string): Promise<boolean> {
  const [saltHex, hashHex] = stored.split(":")
  if (!saltHex || !hashHex) return false
  const salt = fromHex(saltHex)
  const expected = fromHex(hashHex)
  const derivedKey = (await scrypt(password, salt, expected.length)) as Uint8Array
  return derivedKey.length === expected.length && timingSafeEqual(derivedKey, expected)
}
