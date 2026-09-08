import * as React from "react"
import { startAuthentication, browserSupportsWebAuthn } from "@simplewebauthn/browser"
import { Fingerprint, Loader2, LogOut, Shield } from "lucide-react"
import { Button } from "@/components/ui/button"
import { useSession } from "@/contexts/session-context"
import { logout, passkeyUnlockOptions, passkeyUnlockVerify, ApiError, listPasskeys } from "@/lib/api-client"
import { getPreferredPasskey, rememberPasskey } from "@/lib/passkey-preference"
import { APP_NAME } from "@/lib/brand"

type AppLockState = {
  locked: boolean
  unlock: () => Promise<void>
}

const AppLockContext = React.createContext<AppLockState | null>(null)

/**
 * Android-style app lock: session cookie stays; UI is gated until Face ID / fingerprint
 * succeeds. Locks on cold start and whenever the PWA returns from background.
 */
export function AppLockProvider({ children }: { children: React.ReactNode }) {
  const { user, loading, setUser } = useSession()
  const [locked, setLocked] = React.useState(true)
  const [busy, setBusy] = React.useState(false)
  const [error, setError] = React.useState<string | null>(null)
  const [hasPasskey, setHasPasskey] = React.useState<boolean | null>(null)
  const wasHidden = React.useRef(false)

  // Cold start / new session user → always locked.
  React.useEffect(() => {
    if (!user) {
      setLocked(false)
      setHasPasskey(null)
      return
    }
    setLocked(true)
    setError(null)
    listPasskeys()
      .then((res) => setHasPasskey(res.passkeys.length > 0))
      .catch(() => setHasPasskey(false))
  }, [user?.id])

  // Resume from background → lock again (like leaving an Android app).
  React.useEffect(() => {
    if (!user) return
    const onVisibility = () => {
      if (document.visibilityState === "hidden") {
        wasHidden.current = true
        return
      }
      if (document.visibilityState === "visible" && wasHidden.current) {
        wasHidden.current = false
        setLocked(true)
        setError(null)
      }
    }
    const onPageShow = (e: PageTransitionEvent) => {
      if (e.persisted) {
        setLocked(true)
        setError(null)
      }
    }
    document.addEventListener("visibilitychange", onVisibility)
    window.addEventListener("pageshow", onPageShow)
    return () => {
      document.removeEventListener("visibilitychange", onVisibility)
      window.removeEventListener("pageshow", onPageShow)
    }
  }, [user?.id])

  const unlock = React.useCallback(async () => {
    if (!user) return
    if (!browserSupportsWebAuthn()) {
      setError("This device doesn't support biometrics in the browser.")
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
    } catch (err) {
      if (err instanceof Error && err.name === "NotAllowedError") {
        setError("Unlock cancelled.")
      } else if (
        err instanceof ApiError &&
        (err.message.includes("no_passkey") || err.message.includes("Add a passkey"))
      ) {
        setHasPasskey(false)
        setError("Add a passkey in Settings → Account, then reopen to unlock with biometrics.")
      } else {
        setError(err instanceof ApiError ? err.message : "Couldn't unlock — try again.")
      }
    } finally {
      setBusy(false)
    }
  }, [user])

  // Auto-prompt once when the lock screen appears (Android-like).
  const autoPrompted = React.useRef(false)
  React.useEffect(() => {
    if (!user || !locked) {
      autoPrompted.current = false
      return
    }
    if (loading || hasPasskey !== true || busy || autoPrompted.current) return
    autoPrompted.current = true
    const t = window.setTimeout(() => {
      void unlock()
    }, 280)
    return () => window.clearTimeout(t)
  }, [user, locked, loading, hasPasskey, busy, unlock])

  async function handleLogout() {
    try {
      await logout()
    } catch {
      /* still clear local */
    }
    setUser(null)
    setLocked(false)
  }

  const value = React.useMemo(() => ({ locked: Boolean(user) && locked, unlock }), [user, locked, unlock])

  return (
    <AppLockContext.Provider value={value}>
      {children}
      {user && locked && !loading ? (
        <div
          className="fixed inset-0 z-[100] flex flex-col items-center justify-center gap-6 bg-background px-6"
          style={{ paddingTop: "var(--safe-top)", paddingBottom: "var(--safe-bottom)" }}
        >
          <div className="flex size-16 items-center justify-center rounded-2xl bg-primary text-primary-foreground">
            <Shield className="size-8" />
          </div>
          <div className="space-y-1 text-center">
            <p className="font-heading text-xl font-semibold tracking-tight">{APP_NAME}</p>
            <p className="text-sm text-muted-foreground">
              {hasPasskey === false
                ? "Set up Face ID / Touch ID in Settings → Account to unlock."
                : "Unlock with Face ID / Touch ID to continue"}
            </p>
            {user.username ? (
              <p className="text-xs text-muted-foreground">Signed in as {user.username}</p>
            ) : null}
          </div>

          {error ? <p className="max-w-xs text-center text-sm text-destructive">{error}</p> : null}

          <div className="flex w-full max-w-sm flex-col gap-2">
            {hasPasskey !== false ? (
              <Button className="h-12 w-full text-base" disabled={busy} onClick={() => void unlock()}>
                {busy ? <Loader2 className="size-4 animate-spin" /> : <Fingerprint className="size-5" />}
                {busy ? "Waiting…" : "Unlock"}
              </Button>
            ) : (
              <Button className="h-12 w-full text-base" onClick={() => setLocked(false)}>
                Continue without biometrics
              </Button>
            )}
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
