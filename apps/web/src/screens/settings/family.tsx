import * as React from "react"
import { Navigate } from "react-router-dom"
import { toast } from "sonner"
import { Copy, Link2, Loader2, Share2, UserMinus, UserPlus, UserCheck } from "lucide-react"
import { TopBar } from "@/components/nav/top-bar"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog"
import { useSession } from "@/contexts/session-context"
import {
  listMembers,
  deactivateMember,
  reactivateMember,
  listInvites,
  createInvite,
  revokeInvite,
  ApiError,
} from "@/lib/api-client"
import type { Member, Invite } from "shared"

function formatDate(ms: number) {
  return new Date(ms).toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" })
}

export function Family() {
  const { user } = useSession()

  const [members, setMembers] = React.useState<Member[] | null>(null)
  const [invites, setInvites] = React.useState<Invite[] | null>(null)
  const [busyId, setBusyId] = React.useState<string | null>(null)

  const [dialogOpen, setDialogOpen] = React.useState(false)
  const [label, setLabel] = React.useState("")
  const [creating, setCreating] = React.useState(false)
  const [joinUrl, setJoinUrl] = React.useState<string | null>(null)

  const loadMembers = React.useCallback(() => {
    listMembers()
      .then((r) => setMembers(r.members))
      .catch(() => toast.error("Couldn't load family members"))
  }, [])

  const loadInvites = React.useCallback(() => {
    listInvites()
      .then((r) => setInvites(r.invites))
      .catch(() => toast.error("Couldn't load invites"))
  }, [])

  React.useEffect(() => {
    loadMembers()
    loadInvites()
  }, [loadMembers, loadInvites])

  if (user && user.role !== "owner") return <Navigate to="/settings" replace />

  async function handleDeactivate(member: Member) {
    setBusyId(member.id)
    try {
      await deactivateMember(member.id)
      toast.success(`${member.username} signed out and deactivated`)
      loadMembers()
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : "Couldn't deactivate that member")
    } finally {
      setBusyId(null)
    }
  }

  async function handleReactivate(member: Member) {
    setBusyId(member.id)
    try {
      await reactivateMember(member.id)
      toast.success(`${member.username} can sign in again`)
      loadMembers()
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : "Couldn't reactivate that member")
    } finally {
      setBusyId(null)
    }
  }

  async function handleCreateInvite() {
    setCreating(true)
    try {
      const result = await createInvite(label.trim() ? { label: label.trim() } : {})
      setJoinUrl(result.joinUrl)
      loadInvites()
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : "Couldn't create an invite")
    } finally {
      setCreating(false)
    }
  }

  // navigator.share is typed as always-present but is absent on desktop browsers.
  const canShare = "share" in navigator

  async function handleShare(url: string) {
    if (canShare) {
      try {
        await navigator.share({ title: "Join us on Gymfolio", url })
        return
      } catch {
        // user cancelled the share sheet — fall through to clipboard
      }
    }
    await navigator.clipboard.writeText(url)
    toast.success("Invite link copied")
  }

  function closeDialog() {
    setDialogOpen(false)
    setLabel("")
    setJoinUrl(null)
  }

  const pendingInvites = invites?.filter((i) => i.usedAt === null && i.expiresAt > Date.now()) ?? []
  const invitesHistory = invites?.filter((i) => i.usedAt !== null || i.expiresAt <= Date.now()) ?? []

  return (
    <div>
      <TopBar title="Family & Access" back />
      <div className="space-y-6 px-4 py-4">
        <div>
          <div className="mb-2 flex items-center justify-between">
            <h3 className="text-sm font-semibold">Members</h3>
          </div>
          {!members ? (
            <div className="flex justify-center py-6">
              <Loader2 className="size-5 animate-spin text-muted-foreground" />
            </div>
          ) : (
            <div className="overflow-hidden rounded-xl border border-border">
              {members.map((m, i) => (
                <div
                  key={m.id}
                  className={`flex items-center gap-3 bg-card px-4 py-3 ${i > 0 ? "border-t border-border" : ""}`}
                >
                  <div className="min-w-0 flex-1">
                    <p className="flex items-center gap-1.5 text-sm font-medium">
                      {m.username}
                      {m.role === "owner" && (
                        <Badge variant="secondary" className="text-[10px]">
                          Admin
                        </Badge>
                      )}
                      {m.deactivated && (
                        <Badge variant="outline" className="text-[10px] text-muted-foreground">
                          Deactivated
                        </Badge>
                      )}
                    </p>
                    <p className="text-xs text-muted-foreground">Joined {formatDate(m.createdAt)}</p>
                  </div>
                  {m.id !== user?.id &&
                    (m.deactivated ? (
                      <Button
                        variant="outline"
                        size="sm"
                        className="h-8"
                        disabled={busyId === m.id}
                        onClick={() => handleReactivate(m)}
                      >
                        {busyId === m.id ? <Loader2 className="size-3.5 animate-spin" /> : <UserCheck className="size-3.5" />}
                        Reactivate
                      </Button>
                    ) : (
                      <button
                        aria-label={`Deactivate ${m.username}`}
                        disabled={busyId === m.id}
                        onClick={() => handleDeactivate(m)}
                        className="flex size-9 shrink-0 items-center justify-center rounded-md text-muted-foreground hover:bg-destructive/10 hover:text-destructive disabled:opacity-50"
                      >
                        {busyId === m.id ? <Loader2 className="size-4 animate-spin" /> : <UserMinus className="size-4" />}
                      </button>
                    ))}
                </div>
              ))}
            </div>
          )}
        </div>

        <div>
          <div className="mb-2 flex items-center justify-between">
            <h3 className="text-sm font-semibold">Invites</h3>
            <Dialog
              open={dialogOpen}
              onOpenChange={(open) => {
                setDialogOpen(open)
                if (!open) closeDialog()
              }}
            >
              <DialogTrigger
                render={
                  <Button size="sm" className="h-8">
                    <UserPlus className="size-3.5" /> Send invite
                  </Button>
                }
              />
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>Invite a family member</DialogTitle>
                  <DialogDescription>
                    Creates a one-time link that expires in 7 days. Only whoever opens it can create an
                    account.
                  </DialogDescription>
                </DialogHeader>

                {!joinUrl ? (
                  <div className="space-y-1.5">
                    <Label htmlFor="invite-label">Nickname (optional)</Label>
                    <Input
                      id="invite-label"
                      placeholder="Mom"
                      value={label}
                      onChange={(e) => setLabel(e.target.value)}
                      className="h-11 text-base"
                    />
                  </div>
                ) : (
                  <div className="space-y-2">
                    <Label>Invite link</Label>
                    <div className="flex items-center gap-2 rounded-lg border border-border bg-muted/40 px-3 py-2">
                      <Link2 className="size-4 shrink-0 text-muted-foreground" />
                      <p className="truncate text-xs">{joinUrl}</p>
                    </div>
                  </div>
                )}

                <DialogFooter>
                  {!joinUrl ? (
                    <Button onClick={handleCreateInvite} disabled={creating} className="w-full">
                      {creating ? <Loader2 className="size-4 animate-spin" /> : "Create link"}
                    </Button>
                  ) : (
                    <div className="flex w-full gap-2">
                      <Button variant="outline" className="flex-1" onClick={() => handleShare(joinUrl)}>
                        {canShare ? <Share2 className="size-4" /> : <Copy className="size-4" />}
                        {canShare ? "Share" : "Copy link"}
                      </Button>
                      <Button className="flex-1" onClick={closeDialog}>
                        Done
                      </Button>
                    </div>
                  )}
                </DialogFooter>
              </DialogContent>
            </Dialog>
          </div>

          {pendingInvites.length > 0 && (
            <div className="mb-3 overflow-hidden rounded-xl border border-border">
              {pendingInvites.map((invite, i) => (
                <div
                  key={invite.id}
                  className={`flex items-center gap-3 bg-card px-4 py-3 ${i > 0 ? "border-t border-border" : ""}`}
                >
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-medium">{invite.label ?? "Pending invite"}</p>
                    <p className="text-xs text-muted-foreground">Expires {formatDate(invite.expiresAt)}</p>
                  </div>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-8 text-muted-foreground hover:text-destructive"
                    onClick={() =>
                      revokeInvite(invite.id)
                        .then(loadInvites)
                        .catch(() => toast.error("Couldn't revoke that invite"))
                    }
                  >
                    Revoke
                  </Button>
                </div>
              ))}
            </div>
          )}

          {invites && pendingInvites.length === 0 && (
            <p className="mb-3 text-xs text-muted-foreground">No pending invites.</p>
          )}

          {invitesHistory.length > 0 && (
            <details className="text-xs text-muted-foreground">
              <summary className="cursor-pointer select-none">Invite history ({invitesHistory.length})</summary>
              <div className="mt-2 space-y-1.5">
                {invitesHistory.map((invite) => (
                  <div key={invite.id} className="flex items-center justify-between">
                    <span>{invite.label ?? "Invite"}</span>
                    <span>{invite.usedAt ? `Used ${formatDate(invite.usedAt)}` : "Expired"}</span>
                  </div>
                ))}
              </div>
            </details>
          )}
        </div>
      </div>
    </div>
  )
}
