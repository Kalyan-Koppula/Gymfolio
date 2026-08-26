/**
 * AES-GCM helpers for BYOK API keys. Key material is derived from MASTER_KEY
 * (Wrangler secret) + tenantId via HKDF, matching architecture §3 / §7.
 */
function b64encode(bytes: Uint8Array): string {
  let s = ""
  for (const b of bytes) s += String.fromCharCode(b)
  return btoa(s)
}

function b64decode(s: string): Uint8Array {
  const bin = atob(s)
  const out = new Uint8Array(bin.length)
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i)
  return out
}

async function deriveKey(masterKey: string, tenantId: string): Promise<CryptoKey> {
  const enc = new TextEncoder()
  const baseKey = await crypto.subtle.importKey("raw", enc.encode(masterKey), "HKDF", false, [
    "deriveKey",
  ])
  return crypto.subtle.deriveKey(
    { name: "HKDF", hash: "SHA-256", salt: enc.encode(tenantId), info: enc.encode("ai-provider-key") },
    baseKey,
    { name: "AES-GCM", length: 256 },
    false,
    ["encrypt", "decrypt"],
  )
}

export async function encryptSecret(
  masterKey: string,
  tenantId: string,
  plaintext: string,
): Promise<{ ciphertext: string; iv: string }> {
  const key = await deriveKey(masterKey, tenantId)
  const iv = crypto.getRandomValues(new Uint8Array(12))
  const cipher = await crypto.subtle.encrypt({ name: "AES-GCM", iv }, key, new TextEncoder().encode(plaintext))
  return { ciphertext: b64encode(new Uint8Array(cipher)), iv: b64encode(iv) }
}

export async function decryptSecret(
  masterKey: string,
  tenantId: string,
  ciphertext: string,
  iv: string,
): Promise<string> {
  const key = await deriveKey(masterKey, tenantId)
  const plain = await crypto.subtle.decrypt(
    { name: "AES-GCM", iv: b64decode(iv) },
    key,
    b64decode(ciphertext),
  )
  return new TextDecoder().decode(plain)
}
