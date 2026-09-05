import { Link } from "react-router-dom"
import { ChevronRight, KeyRound, Palette, ShieldCheck, Users } from "lucide-react"
import { TopBar } from "@/components/nav/top-bar"
import { useSession } from "@/contexts/session-context"

const ITEMS = [
  { to: "/settings/ai", icon: KeyRound, label: "AI provider", desc: "Bring-your-own-key configuration" },
  { to: "/settings/appearance", icon: Palette, label: "Appearance", desc: "Theme, radius, font pairing" },
  { to: "/settings/account", icon: ShieldCheck, label: "Account & sessions", desc: "Passkeys, password, active devices" },
]

const OWNER_ITEM = {
  to: "/settings/family",
  icon: Users,
  label: "Family & Access",
  desc: "Invite members, manage who can sign in",
}

export function SettingsHome() {
  const { user } = useSession()
  const items = user?.role === "owner" ? [...ITEMS, OWNER_ITEM] : ITEMS

  return (
    <div>
      <TopBar title="Settings" />
      <div className="px-4 py-4 md:px-6 lg:max-w-3xl">
        <div className="overflow-hidden rounded-xl border border-border">
          {items.map((item, i) => (
            <Link
              key={item.to}
              to={item.to}
              className={`flex items-center gap-3 bg-card px-4 py-3.5 transition-colors hover:bg-muted/50 ${i > 0 ? "border-t border-border" : ""}`}
            >
              <div className="flex size-9 shrink-0 items-center justify-center rounded-full bg-muted">
                <item.icon className="size-4 text-muted-foreground" />
              </div>
              <div className="min-w-0 flex-1">
                <p className="text-sm font-medium">{item.label}</p>
                <p className="text-xs text-muted-foreground">{item.desc}</p>
              </div>
              <ChevronRight className="size-4 shrink-0 text-muted-foreground" />
            </Link>
          ))}
        </div>
      </div>
    </div>
  )
}
