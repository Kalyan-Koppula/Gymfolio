/**
 * Lightweight optional Capacitor types — avoids hard dependency until `npx cap add android`.
 * When Capacitor is installed in apps/android, swap imports to `@capacitor/core`.
 */

export type CapacitorGlobal = {
  isNativePlatform?: () => boolean
  getPlatform?: () => string
}

export type RegisterPlugin = <T>(name: string) => T

export const Capacitor: CapacitorGlobal | undefined =
  typeof window !== "undefined"
    ? (window as Window & { Capacitor?: CapacitorGlobal }).Capacitor
    : undefined

export function registerPlugin<T>(name: string): T {
  const cap = (window as Window & { capacitorPlugins?: Record<string, T> }).capacitorPlugins
  if (cap?.[name]) return cap[name]!
  // Stub no-op plugin for browser
  return new Proxy(
    {},
    {
      get: () => async () => undefined,
    },
  ) as T
}
