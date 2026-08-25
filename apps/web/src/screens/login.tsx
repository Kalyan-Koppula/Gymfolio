import * as React from "react"
import { useNavigate } from "react-router-dom"
import { startAuthentication, browserSupportsWebAuthn } from "@simplewebauthn/browser"
import { Dumbbell, Eye, EyeOff, Fingerprint, Loader2 } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import { AlertCircle } from "lucide-react"
import { login, passkeyLoginOptions, passkeyLoginVerify, ApiError } from "@/lib/api-client"
import { useOnlineStatus } from "@/hooks/use-online-status"
import { useSession } from "@/contexts/session-context"

export function Login() {
  const navigate = useNavigate()
  const online = useOnlineStatus()
  const { setUser } = useSession()
  const passkeySupported = React.useMemo(() => browserSupportsWebAuthn(), [])

  const [showPasswordForm, setShowPasswordForm] = React.useState(!passkeySupported)
  const [showPassword, setShowPassword] = React.useState(false)
  const [status, setStatus] = React.useState<"idle" | "checking" | "error">("idle")
  const [errorMessage, setErrorMessage] = React.useState("")
  const [username, setUsername] = React.useState("")
  const [password, setPassword] = React.useState("")

  async function handlePasskeySignIn() {
    if (!online) {
      setStatus("error")
      setErrorMessage("You're offline — check your connection and try again.")
      return
    }
    setStatus("checking")
    try {
      const { flowId, options } = await passkeyLoginOptions()
      const response = await startAuthentication({ optionsJSON: options })
      const { user } = await passkeyLoginVerify(flowId, response)
      setUser(user)
      navigate("/today")
    } catch (err) {
      setStatus("error")
      if (err instanceof Error && err.name === "NotAllowedError") {
        setErrorMessage("Sign-in was cancelled.")
      } else {
        setErrorMessage(err instanceof ApiError ? err.message : "Couldn't sign in with a passkey — try again.")
      }
    }
  }

  async function handlePasswordSubmit(e: React.FormEvent) {
    e.preventDefault()

    if (!online) {
      setStatus("error")
      setErrorMessage("You're offline — check your connection and try again.")
      return
    }

    setStatus("checking")
    try {
      const { user } = await login({ username, password })
      setUser(user)
      navigate("/today")
    } catch (err) {
      setStatus("error")
      setErrorMessage(err instanceof ApiError ? err.message : "Couldn't reach the server — try again.")
    }
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
            <h1 className="font-heading text-xl font-semibold tracking-tight">Welcome back</h1>
            <p className="text-sm text-muted-foreground">Sign in to your family's instance</p>
          </div>
        </div>

        {status === "error" && (
          <Alert variant="destructive">
            <AlertCircle className="size-4" />
            <AlertTitle>Couldn't sign in</AlertTitle>
            <AlertDescription>{errorMessage}</AlertDescription>
          </Alert>
        )}

        {passkeySupported && (
          <div className="space-y-4">
            <Button
              onClick={handlePasskeySignIn}
              disabled={status === "checking"}
              className="h-12 w-full text-base"
            >
              {status === "checking" ? (
                <Loader2 className="size-4 animate-spin" />
              ) : (
                <Fingerprint className="size-5" />
              )}
              Sign in with Face ID / Touch ID
            </Button>
            {!showPasswordForm && (
              <button
                type="button"
                onClick={() => setShowPasswordForm(true)}
                className="w-full text-center text-xs text-muted-foreground underline"
              >
                Or sign in with a password
              </button>
            )}
          </div>
        )}

        {showPasswordForm && (
          <form onSubmit={handlePasswordSubmit} className="space-y-4">
            <div className="space-y-1.5">
              <Label htmlFor="username">Username</Label>
              <Input
                id="username"
                name="username"
                autoComplete="username"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                className="h-11 text-base"
              />
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="password">Password</Label>
              <div className="relative">
                <Input
                  id="password"
                  name="password"
                  type={showPassword ? "text" : "password"}
                  autoComplete="current-password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="h-11 pr-11 text-base"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword((v) => !v)}
                  aria-label={showPassword ? "Hide password" : "Show password"}
                  className="absolute inset-y-0 right-0 flex w-11 items-center justify-center text-muted-foreground hover:text-foreground"
                >
                  {showPassword ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
                </button>
              </div>
            </div>

            <Button
              type="submit"
              variant={passkeySupported ? "outline" : "default"}
              disabled={status === "checking"}
              className="h-11 w-full text-base"
            >
              {status === "checking" ? (
                <>
                  <Loader2 className="size-4 animate-spin" /> Signing in…
                </>
              ) : (
                "Sign in"
              )}
            </Button>
          </form>
        )}

        <p className="text-center text-xs text-muted-foreground">
          New to this family instance? Ask your admin for an invite link.
        </p>
      </div>
    </div>
  )
}
