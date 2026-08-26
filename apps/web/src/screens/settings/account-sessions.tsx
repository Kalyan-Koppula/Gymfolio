import * as React from "react"
import { TopBar } from "@/components/nav/top-bar"
import { Card, CardContent } from "@/components/ui/card"
import { Label } from "@/components/ui/label"
import { Input } from "@/components/ui/input"
import { Badge } from "@/components/ui/badge"
import { Skeleton } from "@/components/ui/skeleton"
import { SaveButton } from "@/components/shared/save-button"
import { useApiWrite } from "@/hooks/use-api-write"
import { changePassword, listSessions, revokeSession } from "@/lib/api-client"
import type { SessionListItem } from "shared"
import { Laptop, LogOut } from "lucide-react"
import { toast } from "sonner"

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
      <div className="space-y-6 px-4 py-4">
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
