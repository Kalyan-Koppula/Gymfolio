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
 * Android-style app lock — only when the account has a passkey.
 * Password-only / web users with no passkey skip the gate entirely.
 * Session cookie is never cleared by lock/unlock.
 */
export function AppLockProvider({ children }: { children: React.ReactNode }) {
  const { user, loading, setUser } = useSession()
  const [locked, setLocked] = React.useState(false)
  const [busy, setBusy] = React.useState(false)
  const [error, setError] = React.useState<string | null>(null)
  /** null = still checking; true = must unlock; false = no passkey → never lock */
  const [hasPasskey, setHasPasskey] = React.useState<boolean | null>(null)
  const [checkingPasskeys, setCheckingPasskeys] = React.useState(false)
  const wasHidden = React.useRef(false)
  const autoPrompted = React.useRef(false)

  // Resolve whether this account uses biometrics. No passkey → stay unlocked.
  React.useEffect(() => {
    if (!user) {
      setLocked(false)
      setHasPasskey(null)
      setCheckingPasskeys(false)
      return
    }
    let cancelled = false
    setCheckingPasskeys(true)
    setError(null)
    listPasskeys()
      .then((res) => {
        if (cancelled) return
        const ok = res.passkeys.length > 0
        setHasPasskey(ok)
        setLocked(ok) // only gate if they can unlock with a passkey
      })
      .catch(() => {
        if (cancelled) return
        // Fail open: don't trap password-only users behind a lock screen.
        setHasPasskey(false)
        setLocked(false)
      })
      .finally(() => {
        if (!cancelled) setCheckingPasskeys(false)
      })
    return () => {
      cancelled = true
    }
  }, [user?.id])

  // Resume from background → re-lock only when biometrics are set up.
  React.useEffect(() => {
    if (!user) return
    const onVisibility = () => {
      if (document.visibilityState === "hidden") {
        wasHidden.current = true
        return
      }
      if (document.visibilityState === "visible" && wasHidden.current) {
        wasHidden.current = false
        if (hasPasskey) {
          autoPrompted.current = false
          setLocked(true)
          setError(null)
        }
      }
    }
    const onPageShow = (e: PageTransitionEvent) => {
      if (e.persisted && hasPasskey) {
        autoPrompted.current = false
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
  }, [user?.id, hasPasskey])

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
        // Account has no passkeys — drop the gate.
        setHasPasskey(false)
        setLocked(false)
      } else {
        setError(err instanceof ApiError ? err.message : "Couldn't unlock — try again.")
      }
    } finally {
      setBusy(false)
    }
  }, [user])

  // Auto-prompt once when a biometric lock screen appears.
  React.useEffect(() => {
    if (!user || !locked || hasPasskey !== true) {
      if (!locked) autoPrompted.current = false
      return
    }
    if (loading || busy || autoPrompted.current) return
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

  const showGate = Boolean(user) && !loading && hasPasskey === true && locked
  const value = React.useMemo(
    () => ({ locked: showGate, unlock }),
    [showGate, unlock],
  )

  return (
    <AppLockContext.Provider value={value}>
      {children}
      {user && !loading && checkingPasskeys ? (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-background">
          <Loader2 className="size-6 animate-spin text-muted-foreground" />
        </div>
      ) : null}
      {showGate ? (
        <div
          className="fixed inset-0 z-[100] flex flex-col items-center justify-center gap-6 bg-background px-6"
          style={{ paddingTop: "var(--safe-top)", paddingBottom: "var(--safe-bottom)" }}
        >
          <div className="flex size-16 items-center justify-center rounded-2xl bg-primary text-primary-foreground">
            <Shield className="size-8" />
          </div>
          <div className="space-y-1 text-center">
            <p className="font-heading text-xl font-semibold tracking-tight">{APP_NAME}</p>
            <p className="text-sm text-muted-foreground">Unlock with Face ID / Touch ID to continue</p>
            {user.username ? (
              <p className="text-xs text-muted-foreground">Signed in as {user.username}</p>
            ) : null}
          </div>

          {error ? <p className="max-w-xs text-center text-sm text-destructive">{error}</p> : null}

          <div className="flex w-full max-w-sm flex-col gap-2">
            <Button className="h-12 w-full text-base" disabled={busy} onClick={() => void unlock()}>
              {busy ? <Loader2 className="size-4 animate-spin" /> : <Fingerprint className="size-5" />}
              {busy ? "Waiting…" : "Unlock"}
            </Button>
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
