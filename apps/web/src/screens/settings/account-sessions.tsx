import * as React from "react"
import { TopBar } from "@/components/nav/top-bar"
import { Card, CardContent } from "@/components/ui/card"
import { Label } from "@/components/ui/label"
import { Input } from "@/components/ui/input"
import { Badge } from "@/components/ui/badge"
import { SaveButton } from "@/components/shared/save-button"
import { useWriteStatus } from "@/hooks/use-write-status"
import { Laptop, LogOut, Smartphone, Tablet } from "lucide-react"
import { SESSIONS_LIST } from "@/lib/stub-data"

const DEVICE_ICON: Record<string, typeof Laptop> = {
  iPhone: Smartphone,
  iPad: Tablet,
}

export function AccountSessions() {
  const { status, run } = useWriteStatus("Password updated")
  const [sessions, setSessions] = React.useState(SESSIONS_LIST)

  return (
    <div>
      <TopBar title="Account & sessions" back />
      <div className="space-y-6 px-4 py-4">
        <Card>
          <CardContent className="space-y-4">
            <p className="text-sm font-semibold">Change password</p>
            <div className="space-y-1.5">
              <Label htmlFor="current-pw">Current password</Label>
              <Input id="current-pw" type="password" className="h-11 text-base" />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="new-pw">New password</Label>
              <Input id="new-pw" type="password" className="h-11 text-base" />
            </div>
            <SaveButton status={status} onClick={() => run()} idleLabel="Update password" className="w-full" />
          </CardContent>
        </Card>

        <div>
          <h3 className="mb-2 text-sm font-semibold">Active sessions</h3>
          <p className="mb-3 text-xs text-muted-foreground">
            One session per device — sign out anywhere you no longer recognize.
          </p>
          <div className="overflow-hidden rounded-xl border border-border">
            {sessions.map((s, i) => {
              const Icon = DEVICE_ICON[s.device.split(" ")[0]] ?? Laptop
              return (
                <div
                  key={s.id}
                  className={`flex items-center gap-3 bg-card px-4 py-3 ${i > 0 ? "border-t border-border" : ""}`}
                >
                  <div className="flex size-9 shrink-0 items-center justify-center rounded-full bg-muted">
                    <Icon className="size-4 text-muted-foreground" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="flex items-center gap-1.5 text-sm font-medium">
                      {s.device}
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
                      aria-label={`Sign out ${s.device}`}
                      onClick={() => setSessions((prev) => prev.filter((x) => x.id !== s.id))}
                      className="flex size-9 shrink-0 items-center justify-center rounded-md text-muted-foreground hover:bg-destructive/10 hover:text-destructive"
                    >
                      <LogOut className="size-4" />
                    </button>
                  )}
                </div>
              )
            })}
          </div>
        </div>
      </div>
    </div>
  )
}
