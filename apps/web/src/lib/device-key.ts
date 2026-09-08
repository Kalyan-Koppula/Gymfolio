/**
 * Durable browser/device id for one session per install (Netflix-style).
 * Survives PWA close/reopen; cleared only if storage is wiped.
 */
const KEY = "gymfolio.deviceKey"

export function getOrCreateDeviceKey(): string {
  try {
    const existing = localStorage.getItem(KEY)
    if (existing && existing.length >= 16) return existing
    const next =
      typeof crypto !== "undefined" && "randomUUID" in crypto
        ? crypto.randomUUID()
        : `dev-${Date.now()}-${Math.random().toString(36).slice(2)}`
    localStorage.setItem(KEY, next)
    return next
  } catch {
    // Private mode / blocked storage — ephemeral per tab (still better than always-new server rows
    // when the cookie can be reused).
    return `ephemeral-${Date.now()}`
  }
}
