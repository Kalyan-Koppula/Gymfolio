import * as React from "react"
import { useNavigate, useParams } from "react-router-dom"
import { startRegistration, browserSupportsWebAuthn } from "@simplewebauthn/browser"
import { AlertCircle, Dumbbell, Fingerprint, Loader2, ShieldOff } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import { useOnlineStatus } from "@/hooks/use-online-status"
import { useSession } from "@/hooks/use-session"
import { APP_NAME } from "@/lib/brand"
import { validateInvite, register, passkeyRegisterOptions, passkeyRegisterVerify, ApiError } from "@/lib/api-client"

type ValidationState =
  | { status: "checking" }
  | { status: "invalid"; reason: "not_found" | "expired" | "used" }
  | { status: "valid"; label: string | null }

const INVALID_COPY: Record<"not_found" | "expired" | "used", string> = {
  not_found: "This invite link doesn't exist.",
  expired: "This invite link has expired.",
  used: "This invite link has already been used.",
}

export function Join() {
  const { token = "" } = useParams()
  const navigate = useNavigate()
  const online = useOnlineStatus()
  const { setUser } = useSession()
  const passkeySupported = React.useMemo(() => browserSupportsWebAuthn(), [])

  const [validation, setValidation] = React.useState<ValidationState>({ status: "checking" })
  const [stage, setStage] = React.useState<"form" | "passkey-offer">("form")
  const [username, setUsername] = React.useState("")
  const [password, setPassword] = React.useState("")
  const [status, setStatus] = React.useState<"idle" | "saving" | "error">("idle")
  const [errorMessage, setErrorMessage] = React.useState("")
  const [passkeyStatus, setPasskeyStatus] = React.useState<"idle" | "saving" | "error">("idle")
  const [passkeyError, setPasskeyError] = React.useState("")

  React.useEffect(() => {
    let cancelled = false
    validateInvite(token)
      .then((result) => {
        if (cancelled) return
        setValidation(result.valid ? { status: "valid", label: result.label } : { status: "invalid", reason: result.reason })
      })
      .catch(() => {
        if (!cancelled) setValidation({ status: "invalid", reason: "not_found" })
      })
    return () => {
      cancelled = true
    }
  }, [token])

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!online) {
      setStatus("error")
      setErrorMessage("You're offline — check your connection and try again.")
      return
    }
    setStatus("saving")
    try {
      const { user } = await register({ username, password, inviteToken: token })
      setUser(user)
      setStatus("idle")
      setStage(passkeySupported ? "passkey-offer" : "form")
      if (!passkeySupported) navigate("/onboarding")
    } catch (err) {
      setStatus("error")
      setErrorMessage(err instanceof ApiError ? err.message : "Couldn't create your account — try again.")
    }
  }

  async function handleSetUpPasskey() {
    setPasskeyStatus("saving")
    try {
      const { flowId, options } = await passkeyRegisterOptions()
      const response = await startRegistration({ optionsJSON: options })
      await passkeyRegisterVerify(flowId, response)
      navigate("/onboarding")
    } catch (err) {
      setPasskeyStatus("error")
      if (err instanceof Error && err.name === "NotAllowedError") {
        setPasskeyError("Passkey setup was cancelled — you can add one later in Settings.")
      } else {
        setPasskeyError(err instanceof ApiError ? err.message : "Couldn't set up a passkey — you can add one later in Settings.")
      }
    }
  }

  if (validation.status === "checking") {
    return (
      <div className="flex min-h-svh items-center justify-center">
        <Loader2 className="size-6 animate-spin text-muted-foreground" />
      </div>
    )
  }

  if (validation.status === "invalid") {
    return (
      <div className="flex min-h-svh flex-col items-center justify-center gap-4 px-6 text-center">
        <div className="flex size-14 items-center justify-center rounded-2xl bg-muted text-muted-foreground">
          <ShieldOff className="size-7" />
        </div>
        <div className="space-y-1">
          <h1 className="font-heading text-lg font-semibold">Invite link no longer valid</h1>
          <p className="text-sm text-muted-foreground">
            {INVALID_COPY[validation.reason]} Ask your family admin to send you a new one.
          </p>
        </div>
      </div>
    )
  }

  if (stage === "passkey-offer") {
    return (
      <div
        className="flex min-h-svh flex-col justify-center px-6 py-8 animate-in fade-in slide-in-from-bottom-1 duration-300 ease-out"
        style={{ paddingTop: "var(--safe-top)" }}
      >
        <div className="mx-auto w-full max-w-sm space-y-6 text-center">
          <div className="mx-auto flex size-14 items-center justify-center rounded-2xl bg-primary text-primary-foreground">
            <Fingerprint className="size-7" />
          </div>
          <div className="space-y-1">
            <h1 className="font-heading text-xl font-semibold">Set up Face ID / Touch ID</h1>
            <p className="text-sm text-muted-foreground">
              Skip typing your password at the gym — sign in with your device's biometrics instead. You can
              always sign in with your password too.
            </p>
          </div>
          {passkeyStatus === "error" && (
            <Alert variant="destructive" className="text-left">
              <AlertCircle className="size-4" />
              <AlertTitle>Couldn't set up passkey</AlertTitle>
              <AlertDescription>{passkeyError}</AlertDescription>
            </Alert>
          )}
          <div className="space-y-3">
            <Button onClick={handleSetUpPasskey} disabled={passkeyStatus === "saving"} className="h-11 w-full text-base">
              {passkeyStatus === "saving" ? (
                <>
                  <Loader2 className="size-4 animate-spin" /> Setting up…
                </>
              ) : (
                "Set up Face ID / Touch ID"
              )}
            </Button>
            <button
              onClick={() => navigate("/onboarding")}
              className="w-full text-center text-xs text-muted-foreground underline"
            >
              Skip for now
            </button>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div
      className="flex min-h-svh flex-col justify-center px-6 py-8 animate-in fade-in slide-in-from-bottom-1 duration-300 ease-out"
      style={{ paddingTop: "var(--safe-top)" }}
    >
      <div className="mx-auto w-full max-w-sm space-y-8">
        <div className="flex flex-col items-center gap-3 text-center">
          <div className="flex size-14 items-center justify-center rounded-2xl bg-primary text-primary-foreground">
            <Dumbbell className="size-7" />
          </div>
          <div>
            <p className="font-heading text-2xl font-semibold tracking-tight">{APP_NAME}</p>
            <h1 className="mt-1 text-base font-medium text-muted-foreground">
              {validation.label ? `You're invited, ${validation.label}` : "You're invited"}
            </h1>
            <p className="text-sm text-muted-foreground">Create your account to join the family instance</p>
          </div>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          {status === "error" && (
            <Alert variant="destructive">
              <AlertCircle className="size-4" />
              <AlertTitle>Couldn't create your account</AlertTitle>
              <AlertDescription>{errorMessage}</AlertDescription>
            </Alert>
          )}

          <div className="space-y-1.5">
            <Label htmlFor="join-username">Username</Label>
            <Input
              id="join-username"
              autoComplete="username"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              className="h-11 text-base"
            />
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="join-password">Password</Label>
            <Input
              id="join-password"
              type="password"
              autoComplete="new-password"
              placeholder="At least 12 characters"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="h-11 text-base"
            />
          </div>

          <Button type="submit" disabled={status === "saving"} className="h-11 w-full text-base">
            {status === "saving" ? (
              <>
                <Loader2 className="size-4 animate-spin" /> Creating account…
              </>
            ) : (
              "Join"
            )}
          </Button>
        </form>
      </div>
    </div>
  )
}
