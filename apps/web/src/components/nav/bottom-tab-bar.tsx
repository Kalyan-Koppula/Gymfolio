import { NavLink, useLocation } from "react-router-dom"
import { Dumbbell, Home, LineChart, NotebookPen, Settings } from "lucide-react"
import { cn } from "@/lib/utils"

const TABS = [
  { to: "/today", label: "Today", icon: Home },
  { to: "/train", label: "Train", icon: Dumbbell },
  { to: "/log", label: "Log", icon: NotebookPen },
  { to: "/progress", label: "Progress", icon: LineChart },
  { to: "/settings", label: "Settings", icon: Settings },
]

export function BottomTabBar() {
  const location = useLocation()
  const activeIndex = Math.max(
    0,
    TABS.findIndex((t) => location.pathname.startsWith(t.to)),
  )

  return (
    <nav
      aria-label="Primary"
      className="fixed inset-x-0 bottom-0 z-40 border-t border-border bg-card/95 backdrop-blur supports-[backdrop-filter]:bg-card/80"
      style={{ paddingBottom: "var(--safe-bottom)" }}
    >
      <div className="relative mx-auto flex h-14 max-w-2xl items-stretch justify-around">
        {/* Sliding active-tab indicator — one element that transitions position rather than
            re-rendering per tab, so the motion reads as one continuous slide (§1.8: purely
            decorative, motion-only — pairs with the icon/label state it accompanies, never
            the sole signal of which tab is active). */}
        <div
          aria-hidden="true"
          className="absolute top-1.5 left-0 h-9 w-1/5 transition-transform duration-300 ease-out"
          style={{ transform: `translateX(${activeIndex * 100}%)` }}
        >
          <div className="mx-auto h-full w-12 rounded-full bg-primary/10" />
        </div>

        {TABS.map(({ to, label, icon: Icon }) => (
          <NavLink
            key={to}
            to={to}
            className={({ isActive }) =>
              cn(
                "relative flex min-w-11 flex-1 flex-col items-center justify-center gap-0.5 text-[11px] font-medium transition-colors duration-200",
                isActive ? "text-primary" : "text-muted-foreground hover:text-foreground",
              )
            }
          >
            {({ isActive }) => (
              <>
                <Icon
                  className={cn("size-5 transition-transform duration-200 ease-out", isActive && "scale-110")}
                  strokeWidth={isActive ? 2.5 : 2}
                  aria-hidden="true"
                />
                <span>{label}</span>
              </>
            )}
          </NavLink>
        ))}
      </div>
    </nav>
  )
}

export const TAB_BAR_CLEARANCE = "calc(3.5rem + var(--safe-bottom))"
