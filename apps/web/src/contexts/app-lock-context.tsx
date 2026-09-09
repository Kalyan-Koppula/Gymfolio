import * as React from "react"
import { startAuthentication, browserSupportsWebAuthn } from "@simplewebauthn/browser"
import { Delete, Fingerprint, Loader2, LogOut, Shield } from "lucide-react"
import { Button } from "@/components/ui/button"
import { useSession } from "@/hooks/use-session"
import { logout, passkeyUnlockOptions, passkeyUnlockVerify, ApiError, listPasskeys } from "@/lib/api-client"
import { getPreferredPasskey, rememberPasskey } from "@/lib/passkey-preference"
import {
  isAppLockArmed,
  readAppLockSettings,
  verifyAppLockPin,
  type AppLockSettings,
} from "@/lib/app-lock-settings"
import { APP_NAME } from "@/lib/brand"
import { cn } from "@/lib/utils"

type AppLockState = {
  locked: boolean
  unlockWithBiometric: () => Promise<void>
  settings: AppLockSettings
  refreshSettings: () => void
}

const AppLockContext = React.createContext<AppLockState | null>(null)

/** Ignore tiny hide→show flickers (e.g. OS overlays); real background switches are longer. */
const MIN_BACKGROUND_MS = 400

/**
 * Device app lock (opt-in "lock on sleep"):
 * - Armed only when the user enables it and sets a local PIN
 * - Locks when the tab/app returns from background — not on in-tab refresh
 * - Unlock with Face ID / Touch ID when passkeys exist + WebAuthn works
 * - Always allow PIN as fallback (like Android)
 * Session cookie is never cleared by lock/unlock.
 */
export function AppLockProvider({ children }: { children: React.ReactNode }) {
  const { user, loading, setUser } = useSession()
  const [settings, setSettings] = React.useState<AppLockSettings>(() => readAppLockSettings())
  const [locked, setLocked] = React.useState(false)
  const [busy, setBusy] = React.useState(false)
  const [error, setError] = React.useState<string | null>(null)
  const [hasPasskey, setHasPasskey] = React.useState(false)
  const [pin, setPin] = React.useState("")
  /** Timestamp when the document last went hidden; null if never / cancelled by unload. */
  const hiddenAt = React.useRef<number | null>(null)
  const autoPrompted = React.useRef(false)

  const refreshSettings = React.useCallback(() => {
    setSettings(readAppLockSettings())
  }, [])

  React.useEffect(() => {
    const onChange = () => refreshSettings()
    window.addEventListener("gymfolio:app-lock-changed", onChange)
    return () => window.removeEventListener("gymfolio:app-lock-changed", onChange)
  }, [refreshSettings])

  const armed = isAppLockArmed(settings)
  const biometricAvailable =
    settings.preferBiometric && hasPasskey && browserSupportsWebAuthn()

  // Track passkeys for biometric unlock (optional).
  React.useEffect(() => {
    if (!user) {
      setHasPasskey(false)
      setLocked(false)
      setPin("")
      return
    }
    listPasskeys()
      .then((res) => setHasPasskey(res.passkeys.length > 0))
      .catch(() => setHasPasskey(false))
  }, [user?.id])

  // Disarming clears the gate; enabling does not lock until the next background return.
  React.useEffect(() => {
    if (!armed) setLocked(false)
  }, [armed])

  const engageLock = React.useCallback(() => {
    if (!isAppLockArmed()) return
    autoPrompted.current = false
    setLocked(true)
    setError(null)
    setPin("")
  }, [])

  // Lock only after a real background → foreground transition (not refresh / cold load).
  React.useEffect(() => {
    if (!user) return

    const onVisibility = () => {
      if (document.visibilityState === "hidden") {
        hiddenAt.current = Date.now()
        return
      }
      if (document.visibilityState !== "visible" || hiddenAt.current == null) return
      const elapsed = Date.now() - hiddenAt.current
      hiddenAt.current = null
      if (elapsed < MIN_BACKGROUND_MS) return
      engageLock()
    }

    // Refresh / close / navigate away: visibility often goes "hidden" first.
    // Clear that so a same-tab reload does not treat the load as "returned from background".
    const onPageHide = (e: PageTransitionEvent) => {
      if (!e.persisted) hiddenAt.current = null
    }

    // Restored from bfcache after the user left the page.
    const onPageShow = (e: PageTransitionEvent) => {
      if (e.persisted) engageLock()
    }

    document.addEventListener("visibilitychange", onVisibility)
    window.addEventListener("pagehide", onPageHide)
    window.addEventListener("pageshow", onPageShow)
    return () => {
      document.removeEventListener("visibilitychange", onVisibility)
      window.removeEventListener("pagehide", onPageHide)
      window.removeEventListener("pageshow", onPageShow)
    }
  }, [user?.id, engageLock])

  const unlockWithBiometric = React.useCallback(async () => {
    if (!user) return
    if (!browserSupportsWebAuthn()) {
      setError("Biometrics aren't available on this device — use your PIN.")
      return
    }
    setBusy(true)
    setError(null)
    try {
      const preferred = getPreferredPasskey()
      const { flowId, options } = await passkeyUnlockOptions({
        allowCredentialIds: preferred ? [preferred.credentialId] : [],
      })
      const response = await startAuthentication({ optionsJSON: options })
      await passkeyUnlockVerify(flowId, response)
      rememberPasskey(response.id, preferred?.transports)
      setLocked(false)
      setPin("")
    } catch (err) {
      if (err instanceof Error && err.name === "NotAllowedError") {
        setError("Biometric unlock cancelled — enter your PIN.")
      } else if (err instanceof ApiError && err.message.includes("no_passkey")) {
        setHasPasskey(false)
        setError("No passkey on this account — unlock with PIN.")
      } else {
        setError(err instanceof ApiError ? err.message : "Biometric unlock failed — try PIN.")
      }
    } finally {
      setBusy(false)
    }
  }, [user])

  async function unlockWithPin(nextPin: string) {
    setBusy(true)
    setError(null)
    try {
      const ok = await verifyAppLockPin(nextPin)
      if (!ok) {
        setError("Incorrect PIN")
        setPin("")
        return
      }
      setLocked(false)
      setPin("")
    } finally {
      setBusy(false)
    }
  }

  // Auto-verify when PIN reaches the configured length.
  React.useEffect(() => {
    if (!locked) return
    const need = settings.pinLength ?? 4
    if (pin.length !== need) return
    const t = window.setTimeout(() => {
      void unlockWithPin(pin)
    }, 120)
    return () => window.clearTimeout(t)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pin, locked, settings.pinLength])

  function onDigit(d: string) {
    if (busy) return
    setError(null)
    const need = settings.pinLength ?? 8
    setPin((prev) => (prev + d).slice(0, need))
  }

  React.useEffect(() => {
    if (!user || !locked || !biometricAvailable) {
      if (!locked) autoPrompted.current = false
      return
    }
    if (loading || busy || autoPrompted.current) return
    autoPrompted.current = true
    const t = window.setTimeout(() => {
      void unlockWithBiometric()
    }, 320)
    return () => window.clearTimeout(t)
  }, [user, locked, biometricAvailable, loading, busy, unlockWithBiometric])

  async function handleLogout() {
    try {
      await logout()
    } catch {
      /* ignore */
    }
    setUser(null)
    setLocked(false)
    setPin("")
  }

  const showGate = Boolean(user) && !loading && armed && locked
  const value = React.useMemo(
    () => ({
      locked: showGate,
      unlockWithBiometric,
      settings,
      refreshSettings,
    }),
    [showGate, unlockWithBiometric, settings, refreshSettings],
  )

  return (
    <AppLockContext.Provider value={value}>
      {children}
      {showGate ? (
        <div
          className="fixed inset-0 z-[100] flex flex-col items-center justify-center gap-5 bg-background px-6"
          style={{ paddingTop: "var(--safe-top)", paddingBottom: "var(--safe-bottom)" }}
        >
          <div className="flex size-14 items-center justify-center rounded-2xl bg-primary text-primary-foreground">
            <Shield className="size-7" />
          </div>
          <div className="space-y-1 text-center">
            <p className="font-heading text-xl font-semibold tracking-tight">{APP_NAME}</p>
            <p className="text-sm text-muted-foreground">
              {biometricAvailable ? "Unlock with biometrics or PIN" : "Enter your PIN to continue"}
            </p>
            {user?.username ? (
              <p className="text-xs text-muted-foreground">Signed in as {user.username}</p>
            ) : null}
          </div>

          <div className="flex gap-2">
            {Array.from({ length: settings.pinLength ?? 4 }).map((_, i) => (
              <span
                key={i}
                className={cn(
                  "size-2.5 rounded-full border border-border transition-colors",
                  i < pin.length ? "bg-primary border-primary" : "bg-transparent",
                )}
              />
            ))}
          </div>

          {error ? <p className="max-w-xs text-center text-sm text-destructive">{error}</p> : null}

          <div className="grid w-full max-w-[240px] grid-cols-3 gap-2">
            {["1", "2", "3", "4", "5", "6", "7", "8", "9", "", "0", "del"].map((key) => {
              if (key === "") return <span key="pad" />
              if (key === "del") {
                return (
                  <Button
                    key="del"
                    type="button"
                    variant="ghost"
                    className="h-14"
                    disabled={busy}
                    onClick={() => setPin((p) => p.slice(0, -1))}
                    aria-label="Delete"
                  >
                    <Delete className="size-5" />
                  </Button>
                )
              }
              return (
                <Button
                  key={key}
                  type="button"
                  variant="outline"
                  className="h-14 text-lg font-semibold"
                  disabled={busy}
                  onClick={() => onDigit(key)}
                >
                  {key}
                </Button>
              )
            })}
          </div>

          <div className="flex w-full max-w-sm flex-col gap-2">
            {biometricAvailable ? (
              <Button
                className="h-12 w-full text-base"
                disabled={busy}
                onClick={() => void unlockWithBiometric()}
              >
                {busy ? <Loader2 className="size-4 animate-spin" /> : <Fingerprint className="size-5" />}
                {busy ? "Waiting…" : "Use Face ID / Touch ID"}
              </Button>
            ) : null}
            <Button variant="ghost" className="h-11 w-full" onClick={() => void handleLogout()}>
              <LogOut className="size-4" /> Sign out
            </Button>
          </div>
        </div>
      ) : null}
    </AppLockContext.Provider>
  )
}

export function useAppLock() {
  const ctx = React.useContext(AppLockContext)
  if (!ctx) throw new Error("useAppLock must be used within AppLockProvider")
  return ctx
}
