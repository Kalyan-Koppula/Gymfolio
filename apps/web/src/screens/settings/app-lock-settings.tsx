import * as React from "react"
import { browserSupportsWebAuthn } from "@simplewebauthn/browser"
import { toast } from "sonner"
import { Fingerprint, KeyRound, Loader2 } from "lucide-react"
import { TopBar } from "@/components/nav/top-bar"
import { Card, CardContent } from "@/components/ui/card"
import { Label } from "@/components/ui/label"
import { Button } from "@/components/ui/button"
import { Switch } from "@/components/ui/switch"
import { listPasskeys } from "@/lib/api-client"
import {
  disableAppLock,
  hasPinConfigured,
  readAppLockSettings,
  setAppLockPin,
  setLockOnSleep,
  setPreferBiometric,
  type AppLockSettings,
} from "@/lib/app-lock-settings"

export function AppLockSettingsScreen() {
  const [settings, setSettings] = React.useState<AppLockSettings>(() => readAppLockSettings())
  const [hasPasskey, setHasPasskey] = React.useState(false)
  const [pin, setPin] = React.useState("")
  const [pinConfirm, setPinConfirm] = React.useState("")
  const [settingPin, setSettingPin] = React.useState(false)
  const [busy, setBusy] = React.useState(false)

  const biometricOk = browserSupportsWebAuthn() && hasPasskey
  const pinReady = hasPinConfigured(settings)

  React.useEffect(() => {
    listPasskeys()
      .then((res) => setHasPasskey(res.passkeys.length > 0))
      .catch(() => setHasPasskey(false))
  }, [])

  async function enableWithPin() {
    if (pin !== pinConfirm) {
      toast.error("PINs don't match")
      return
    }
    setBusy(true)
    try {
      const next = await setAppLockPin(pin)
      setSettings(next)
      setPin("")
      setPinConfirm("")
      setSettingPin(false)
      toast.success("App lock enabled")
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Couldn't set PIN")
    } finally {
      setBusy(false)
    }
  }

  function onToggleLock(enabled: boolean) {
    if (enabled) {
      if (!pinReady) {
        setSettingPin(true)
        return
      }
      try {
        setSettings(setLockOnSleep(true))
        toast.success("Lock on sleep enabled")
      } catch (err) {
        toast.error(err instanceof Error ? err.message : "Couldn't enable lock")
      }
      return
    }
    setSettings(disableAppLock())
    toast.message("App lock turned off")
  }

  return (
    <div>
      <TopBar title="App lock" back />
      <div className="space-y-5 px-4 py-4 pb-10">
        <p className="text-xs text-muted-foreground">
          Like Android: when enabled, leaving the app (sleep / background) requires unlock. This is
          stored on <span className="font-medium text-foreground">this device only</span>. Unlock
          with Face ID / Touch ID when available, or your PIN.
        </p>

        <Card>
          <CardContent className="flex items-center justify-between gap-3 py-4">
            <div className="min-w-0">
              <p className="text-sm font-medium">Lock on sleep</p>
              <p className="text-xs text-muted-foreground">
                Ask for biometrics or PIN when you reopen the app
              </p>
            </div>
            <Switch
              checked={settings.lockOnSleep && pinReady}
              onCheckedChange={onToggleLock}
              aria-label="Lock on sleep"
            />
          </CardContent>
        </Card>

        <Card>
          <CardContent className="flex items-center justify-between gap-3 py-4">
            <div className="min-w-0">
              <p className="text-sm font-medium flex items-center gap-1.5">
                <Fingerprint className="size-4" /> Prefer biometrics
              </p>
              <p className="text-xs text-muted-foreground">
                {biometricOk
                  ? "Face ID / Touch ID first, PIN as backup"
                  : hasPasskey
                    ? "This browser can't use biometrics — PIN only"
                    : "Add a passkey under Account to use Face ID / Touch ID"}
              </p>
            </div>
            <Switch
              checked={settings.preferBiometric}
              disabled={!biometricOk}
              onCheckedChange={(v) => setSettings(setPreferBiometric(v))}
              aria-label="Prefer biometrics"
            />
          </CardContent>
        </Card>

        <Card>
          <CardContent className="space-y-3 py-4">
            <div className="flex items-center justify-between gap-2">
              <div>
                <p className="text-sm font-medium flex items-center gap-1.5">
                  <KeyRound className="size-4" /> PIN
                </p>
                <p className="text-xs text-muted-foreground">
                  {pinReady ? `${settings.pinLength ?? 4}-digit PIN set on this device` : "Required to enable lock"}
                </p>
              </div>
              <Button
                variant="outline"
                size="sm"
                onClick={() => {
                  setSettingPin((v) => !v)
                  setPin("")
                  setPinConfirm("")
                }}
              >
                {pinReady ? "Change PIN" : "Set PIN"}
              </Button>
            </div>

            {settingPin ? (
              <div className="space-y-3 border-t border-border pt-3">
                <div className="space-y-1.5">
                  <Label htmlFor="pin">New PIN (4–8 digits)</Label>
                  <input
                    id="pin"
                    inputMode="numeric"
                    autoComplete="new-password"
                    className="flex h-11 w-full rounded-lg border border-border bg-background px-3 text-base tracking-[0.3em]"
                    value={pin}
                    onChange={(e) => setPin(e.target.value.replace(/\D/g, "").slice(0, 8))}
                    placeholder="••••"
                  />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="pin2">Confirm PIN</Label>
                  <input
                    id="pin2"
                    inputMode="numeric"
                    autoComplete="new-password"
                    className="flex h-11 w-full rounded-lg border border-border bg-background px-3 text-base tracking-[0.3em]"
                    value={pinConfirm}
                    onChange={(e) => setPinConfirm(e.target.value.replace(/\D/g, "").slice(0, 8))}
                    placeholder="••••"
                  />
                </div>
                <Button
                  className="h-11 w-full"
                  disabled={busy || pin.length < 4 || pin !== pinConfirm}
                  onClick={() => void enableWithPin()}
                >
                  {busy ? <Loader2 className="size-4 animate-spin" /> : null}
                  Save PIN & enable lock
                </Button>
              </div>
            ) : null}
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
