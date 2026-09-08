/**
 * Device-local app lock preferences (Android-style).
 * PIN never leaves this browser — only a salted hash is stored.
 */

const STORAGE_KEY = "gymfolio.appLock"

export type AppLockSettings = {
  /** Lock when the app goes to background / sleep. */
  lockOnSleep: boolean
  /** Prefer Face ID / Touch ID when a passkey exists on this account. */
  preferBiometric: boolean
  pinSalt: string | null
  pinHash: string | null
  /** Digit count chosen when PIN was set (4–8). */
  pinLength: number | null
}

const DEFAULTS: AppLockSettings = {
  lockOnSleep: false,
  preferBiometric: true,
  pinSalt: null,
  pinHash: null,
  pinLength: null,
}

function bytesToHex(buf: ArrayBuffer): string {
  return [...new Uint8Array(buf)].map((b) => b.toString(16).padStart(2, "0")).join("")
}

function hexToBytes(hex: string): Uint8Array {
  const out = new Uint8Array(hex.length / 2)
  for (let i = 0; i < out.length; i++) out[i] = Number.parseInt(hex.slice(i * 2, i * 2 + 2), 16)
  return out
}

export function readAppLockSettings(): AppLockSettings {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) return { ...DEFAULTS }
    const parsed = JSON.parse(raw) as Partial<AppLockSettings>
    return {
      lockOnSleep: Boolean(parsed.lockOnSleep),
      preferBiometric: parsed.preferBiometric !== false,
      pinSalt: typeof parsed.pinSalt === "string" ? parsed.pinSalt : null,
      pinHash: typeof parsed.pinHash === "string" ? parsed.pinHash : null,
      pinLength:
        typeof parsed.pinLength === "number" && parsed.pinLength >= 4 && parsed.pinLength <= 8
          ? parsed.pinLength
          : null,
    }
  } catch {
    return { ...DEFAULTS }
  }
}

export function writeAppLockSettings(next: AppLockSettings) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(next))
  window.dispatchEvent(new CustomEvent("gymfolio:app-lock-changed"))
}

export function hasPinConfigured(settings = readAppLockSettings()): boolean {
  return Boolean(settings.pinSalt && settings.pinHash)
}

export function isAppLockArmed(settings = readAppLockSettings()): boolean {
  return settings.lockOnSleep && hasPinConfigured(settings)
}

async function derivePinHash(pin: string, saltHex: string): Promise<string> {
  const enc = new TextEncoder()
  const keyMaterial = await crypto.subtle.importKey("raw", enc.encode(pin), "PBKDF2", false, ["deriveBits"])
  const bits = await crypto.subtle.deriveBits(
    {
      name: "PBKDF2",
      salt: hexToBytes(saltHex) as BufferSource,
      iterations: 120_000,
      hash: "SHA-256",
    },
    keyMaterial,
    256,
  )
  return bytesToHex(bits)
}

export async function setAppLockPin(pin: string): Promise<AppLockSettings> {
  const digits = pin.replace(/\D/g, "")
  if (digits.length < 4 || digits.length > 8) {
    throw new Error("PIN must be 4–8 digits")
  }
  const salt = bytesToHex(crypto.getRandomValues(new Uint8Array(16)).buffer)
  const pinHash = await derivePinHash(digits, salt)
  const prev = readAppLockSettings()
  const next: AppLockSettings = {
    ...prev,
    lockOnSleep: true,
    pinSalt: salt,
    pinHash,
    pinLength: digits.length,
  }
  writeAppLockSettings(next)
  return next
}

export async function verifyAppLockPin(pin: string, settings = readAppLockSettings()): Promise<boolean> {
  if (!settings.pinSalt || !settings.pinHash) return false
  const digits = pin.replace(/\D/g, "")
  const hash = await derivePinHash(digits, settings.pinSalt)
  return hash === settings.pinHash
}

export function disableAppLock(): AppLockSettings {
  const next: AppLockSettings = {
    ...readAppLockSettings(),
    lockOnSleep: false,
  }
  writeAppLockSettings(next)
  return next
}

export function setPreferBiometric(prefer: boolean): AppLockSettings {
  const next = { ...readAppLockSettings(), preferBiometric: prefer }
  writeAppLockSettings(next)
  return next
}

export function setLockOnSleep(enabled: boolean): AppLockSettings {
  const prev = readAppLockSettings()
  if (enabled && !hasPinConfigured(prev)) {
    throw new Error("Set a PIN before enabling lock")
  }
  const next = { ...prev, lockOnSleep: enabled }
  writeAppLockSettings(next)
  return next
}
