import * as React from "react"
import { startRegistration, browserSupportsWebAuthn } from "@simplewebauthn/browser"
import { TopBar } from "@/components/nav/top-bar"
import { Card, CardContent } from "@/components/ui/card"
import { Label } from "@/components/ui/label"
import { Input } from "@/components/ui/input"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Skeleton } from "@/components/ui/skeleton"
import { SaveButton } from "@/components/shared/save-button"
import { useApiWrite } from "@/hooks/use-api-write"
import {
  changePassword,
  deletePasskey,
  listPasskeys,
  listSessions,
  passkeyRegisterOptions,
  passkeyRegisterVerify,
  revokeSession,
  updatePasskey,
  ApiError,
} from "@/lib/api-client"
import type { PasskeyListItem, SessionListItem } from "shared"
import { Fingerprint, KeyRound, Laptop, Loader2, LogOut, Pencil, Plus, Trash2 } from "lucide-react"
import { toast } from "sonner"

function formatWhen(ts: number) {
  return new Intl.DateTimeFormat(undefined, { dateStyle: "medium", timeStyle: "short" }).format(new Date(ts))
}

export function AccountSessions() {
  const { status, run } = useApiWrite("Password updated")
  const [sessions, setSessions] = React.useState<SessionListItem[] | null>(null)
  const [currentPassword, setCurrentPassword] = React.useState("")
  const [newPassword, setNewPassword] = React.useState("")

  function reloadSessions() {
    listSessions()
      .then((res) => setSessions(res.sessions))
      .catch(() => {
        toast.error("Couldn't load sessions")
        setSessions([])
      })
  }

  React.useEffect(() => {
    reloadSessions()
  }, [])

  return (
    <div>
      <TopBar title="Account & sessions" back />
      <div className="space-y-6 px-4 py-4 pb-10">
        <PasskeysSection />

        <Card>
          <CardContent className="space-y-4">
            <p className="text-sm font-semibold">Change password</p>
            <div className="space-y-1.5">
              <Label htmlFor="current-pw">Current password</Label>
              <Input
                id="current-pw"
                type="password"
                className="h-11 text-base"
                value={currentPassword}
                onChange={(e) => setCurrentPassword(e.target.value)}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="new-pw">New password</Label>
              <Input
                id="new-pw"
                type="password"
                className="h-11 text-base"
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
              />
            </div>
            <SaveButton
              status={status}
              onClick={() =>
                run(
                  () => changePassword({ currentPassword, newPassword }),
                  () => {
                    setCurrentPassword("")
                    setNewPassword("")
                  },
                )
              }
              idleLabel="Update password"
              className="w-full"
            />
          </CardContent>
        </Card>

        <div>
          <h3 className="mb-2 text-sm font-semibold">Active sessions</h3>
          <p className="mb-3 text-xs text-muted-foreground">
            One session per device — sign out anywhere you no longer recognize.
          </p>
          <div className="overflow-hidden rounded-xl border border-border">
            {sessions == null ? (
              <div className="p-4">
                <Skeleton className="h-16 w-full" />
              </div>
            ) : sessions.length === 0 ? (
              <p className="p-4 text-sm text-muted-foreground">No active sessions.</p>
            ) : (
              sessions.map((s, i) => (
                <div
                  key={s.id}
                  className={`flex items-center gap-3 bg-card px-4 py-3 ${i > 0 ? "border-t border-border" : ""}`}
                >
                  <div className="flex size-9 shrink-0 items-center justify-center rounded-full bg-muted">
                    <Laptop className="size-4 text-muted-foreground" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="flex items-center gap-1.5 text-sm font-medium">
                      Session {s.id.slice(0, 8)}
                      {s.current && (
                        <Badge variant="secondary" className="text-[10px]">
                          This device
                        </Badge>
                      )}
                    </p>
                    <p className="text-xs text-muted-foreground">{s.lastActive}</p>
                  </div>
                  {!s.current && (
                    <button
                      aria-label={`Sign out session ${s.id.slice(0, 8)}`}
                      onClick={() => {
                        revokeSession(s.id)
                          .then(() => setSessions((prev) => prev?.filter((x) => x.id !== s.id) ?? null))
                          .catch((err) => toast.error(err instanceof Error ? err.message : "Couldn't revoke"))
                      }}
                      className="flex size-9 shrink-0 items-center justify-center rounded-md text-muted-foreground hover:bg-destructive/10 hover:text-destructive"
                    >
                      <LogOut className="size-4" />
                    </button>
                  )}
                </div>
              ))
            )}
          </div>
        </div>
      </div>
    </div>
  )
}

function PasskeysSection() {
  const supported = React.useMemo(() => browserSupportsWebAuthn(), [])
  const [passkeys, setPasskeys] = React.useState<PasskeyListItem[] | null>(null)
  const [adding, setAdding] = React.useState(false)
  const [newLabel, setNewLabel] = React.useState("")
  const [renamingId, setRenamingId] = React.useState<string | null>(null)
  const [renameDraft, setRenameDraft] = React.useState("")
  const [busyId, setBusyId] = React.useState<string | null>(null)

  function reload() {
    listPasskeys()
      .then((res) => setPasskeys(res.passkeys))
      .catch(() => {
        toast.error("Couldn't load passkeys")
        setPasskeys([])
      })
  }

  React.useEffect(() => {
    reload()
  }, [])

  async function handleAdd() {
    if (!supported) {
      toast.error("This browser doesn't support passkeys")
      return
    }
    setAdding(true)
    try {
      const label = newLabel.trim() || undefined
      const { flowId, options } = await passkeyRegisterOptions()
      const response = await startRegistration({ optionsJSON: options })
      await passkeyRegisterVerify(flowId, response, label)
      setNewLabel("")
      toast.success("Passkey added")
      reload()
    } catch (err) {
      if (err instanceof Error && /cancel|abort|not allowed/i.test(err.message)) {
        toast.message("Passkey setup cancelled")
      } else {
        toast.error(err instanceof ApiError ? err.message : "Couldn't add passkey")
      }
    } finally {
      setAdding(false)
    }
  }

  async function handleRename(id: string) {
    const label = renameDraft.trim()
    if (!label) {
      toast.error("Enter a name for this passkey")
      return
    }
    setBusyId(id)
    try {
      const { passkey } = await updatePasskey(id, { label })
      setPasskeys((prev) => prev?.map((p) => (p.id === id ? passkey : p)) ?? null)
      setRenamingId(null)
      toast.success("Passkey renamed")
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Couldn't rename passkey")
    } finally {
      setBusyId(null)
    }
  }

  async function handleRemove(id: string, label: string | null) {
    const name = label?.trim() || "this passkey"
    if (!window.confirm(`Remove ${name}? You won't be able to sign in with it anymore.`)) return
    setBusyId(id)
    try {
      await deletePasskey(id)
      setPasskeys((prev) => prev?.filter((p) => p.id !== id) ?? null)
      toast.success("Passkey removed")
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Couldn't remove passkey")
    } finally {
      setBusyId(null)
    }
  }

  return (
    <div>
      <div className="mb-2 flex items-center gap-2">
        <Fingerprint className="size-4 text-muted-foreground" />
        <h3 className="text-sm font-semibold">Passkeys</h3>
      </div>
      <p className="mb-3 text-xs text-muted-foreground">
        Sign in with Face ID, Touch ID, or a device PIN. Add one per device you use, rename them so
        you can tell them apart, or remove keys you no longer trust.
      </p>

      {!supported && (
        <p className="mb-3 rounded-lg border border-border bg-muted/40 px-3 py-2 text-xs text-muted-foreground">
          This browser doesn't support WebAuthn passkeys — try Safari or Chrome on a recent device.
        </p>
      )}

      <div className="mb-3 overflow-hidden rounded-xl border border-border">
        {passkeys == null ? (
          <div className="p-4">
            <Skeleton className="h-16 w-full" />
          </div>
        ) : passkeys.length === 0 ? (
          <p className="p-4 text-sm text-muted-foreground">No passkeys yet — add one below.</p>
        ) : (
          passkeys.map((p, i) => (
            <div
              key={p.id}
              className={`bg-card px-4 py-3 ${i > 0 ? "border-t border-border" : ""}`}
            >
              {renamingId === p.id ? (
                <div className="flex items-center gap-2">
                  <Input
                    autoFocus
                    value={renameDraft}
                    onChange={(e) => setRenameDraft(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter") void handleRename(p.id)
                      if (e.key === "Escape") setRenamingId(null)
                    }}
                    placeholder="e.g. iPhone"
                    className="h-10 flex-1 text-base"
                    aria-label="Passkey name"
                  />
                  <Button
                    size="sm"
                    className="h-10"
                    disabled={busyId === p.id}
                    onClick={() => void handleRename(p.id)}
                  >
                    {busyId === p.id ? <Loader2 className="size-4 animate-spin" /> : "Save"}
                  </Button>
                  <Button size="sm" variant="ghost" className="h-10" onClick={() => setRenamingId(null)}>
                    Cancel
                  </Button>
                </div>
              ) : (
                <div className="flex items-center gap-3">
                  <div className="flex size-9 shrink-0 items-center justify-center rounded-full bg-muted">
                    <KeyRound className="size-4 text-muted-foreground" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="flex flex-wrap items-center gap-1.5 text-sm font-medium">
                      {p.label?.trim() || "Unnamed passkey"}
                      {p.backedUp && (
                        <Badge variant="secondary" className="text-[10px]">
                          Synced
                        </Badge>
                      )}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      Added {formatWhen(p.createdAt)}
                      {p.lastUsedAt ? ` · Last used ${formatWhen(p.lastUsedAt)}` : ""}
                      {p.deviceType ? ` · ${p.deviceType}` : ""}
                    </p>
                  </div>
                  <button
                    type="button"
                    aria-label={`Rename ${p.label ?? "passkey"}`}
                    disabled={busyId === p.id}
                    onClick={() => {
                      setRenamingId(p.id)
                      setRenameDraft(p.label ?? "")
                    }}
                    className="flex size-9 shrink-0 items-center justify-center rounded-md text-muted-foreground hover:bg-muted hover:text-foreground"
                  >
                    <Pencil className="size-4" />
                  </button>
                  <button
                    type="button"
                    aria-label={`Remove ${p.label ?? "passkey"}`}
                    disabled={busyId === p.id}
                    onClick={() => void handleRemove(p.id, p.label)}
                    className="flex size-9 shrink-0 items-center justify-center rounded-md text-muted-foreground hover:bg-destructive/10 hover:text-destructive"
                  >
                    {busyId === p.id ? (
                      <Loader2 className="size-4 animate-spin" />
                    ) : (
                      <Trash2 className="size-4" />
                    )}
                  </button>
                </div>
              )}
            </div>
          ))
        )}
      </div>

      <Card>
        <CardContent className="space-y-3">
          <p className="text-sm font-medium">Add a passkey</p>
          <div className="space-y-1.5">
            <Label htmlFor="passkey-label">Nickname (optional)</Label>
            <Input
              id="passkey-label"
              className="h-11 text-base"
              placeholder="e.g. This iPhone"
              value={newLabel}
              onChange={(e) => setNewLabel(e.target.value)}
              disabled={!supported || adding}
            />
          </div>
          <Button className="h-11 w-full text-base" disabled={!supported || adding} onClick={() => void handleAdd()}>
            {adding ? <Loader2 className="size-4 animate-spin" /> : <Plus className="size-4" />}
            {adding ? "Waiting for device…" : "Add passkey"}
          </Button>
        </CardContent>
      </Card>
    </div>
  )
}
