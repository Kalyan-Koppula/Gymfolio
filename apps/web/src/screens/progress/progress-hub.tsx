import { NavLink, Outlet, useLocation } from "react-router-dom"
import { TopBar } from "@/components/nav/top-bar"
import { cn } from "@/lib/utils"

const SEGMENTS = [
  { to: "/progress", end: true, label: "Body", match: (p: string) => p === "/progress" || p === "/progress/metrics" },
  { to: "/progress/training", end: false, label: "Training", match: (p: string) => p.startsWith("/progress/training") },
  { to: "/progress/health", end: false, label: "Health", match: (p: string) => p.startsWith("/progress/health") },
] as const

export function ProgressHub() {
  const { pathname } = useLocation()

  return (
    <div>
      <TopBar title="Progress" />
      <div className="border-b border-border px-4 pt-3">
        <nav className="flex gap-1" aria-label="Progress segments">
          {SEGMENTS.map((s) => {
            const active = s.match(pathname)
            return (
              <NavLink
                key={s.to}
                to={s.to}
                end={s.end}
                className={cn(
                  "relative flex-1 rounded-lg px-3 py-2.5 text-center text-sm font-medium transition-colors",
                  active ? "bg-muted text-foreground" : "text-muted-foreground hover:text-foreground",
                )}
              >
                {s.label}
              </NavLink>
            )
          })}
        </nav>
      </div>
      <Outlet />
    </div>
  )
}
