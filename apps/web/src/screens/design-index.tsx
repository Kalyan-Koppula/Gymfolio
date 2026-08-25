import { Link } from "react-router-dom"
import { useTheme } from "next-themes"
import { ArrowRight, Moon, Sun } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { SimulatorTriggerButton } from "@/components/simulator/simulator-sheet"
import { useAppearance } from "@/contexts/appearance-provider"

const GROUPS: Array<{ title: string; items: Array<{ to: string; label: string; note?: string }> }> = [
  {
    title: "First run",
    items: [
      { to: "/onboarding", label: "Onboarding", note: "FR-2.2, FR-5, FR-8.2, FR-9.4" },
      { to: "/login", label: "Login", note: "FR-10.1" },
    ],
  },
  {
    title: "Today",
    items: [{ to: "/today", label: "Today (home dashboard)", note: "FR-7.1, FR-6.4" }],
  },
  {
    title: "Log",
    items: [{ to: "/log", label: "Log hub — weight, hydration, sleep, macros", note: "FR-1, FR-2, FR-3, FR-8" }],
  },
  {
    title: "Train",
    items: [
      { to: "/train/library", label: "Exercise library", note: "FR-4.1–4.3" },
      { to: "/train/exercise/ex-1", label: "Exercise detail", note: "FR-4.4–4.7" },
      { to: "/train/equipment", label: "Equipment profile", note: "FR-5" },
      { to: "/train/routine", label: "Routine builder", note: "FR-6" },
      { to: "/train/workout", label: "Active workout logging", note: "FR-7.1–7.3" },
    ],
  },
  {
    title: "Progress",
    items: [
      { to: "/progress/metrics", label: "Body metrics trend", note: "FR-1.3–1.5" },
      { to: "/progress/adherence", label: "Adherence & history", note: "FR-7.4–7.5" },
    ],
  },
  {
    title: "Settings",
    items: [
      { to: "/settings", label: "Settings home", note: "" },
      { to: "/settings/ai", label: "AI provider (BYOK)", note: "FR-9.1–9.4" },
      { to: "/settings/appearance", label: "Appearance / theme", note: "runtime theming" },
      { to: "/settings/account", label: "Account & sessions", note: "FR-10, multi-session" },
    ],
  },
]

export function DesignIndex() {
  const { theme, setTheme } = useTheme()
  const { palette, setPalette } = useAppearance()

  return (
    <div className="mx-auto min-h-svh max-w-2xl px-4 py-8 animate-in fade-in duration-300 ease-out">
      <div className="mb-8 flex items-start justify-between gap-4">
        <div>
          <p className="text-xs font-medium tracking-wide text-primary uppercase">Design validation prototype</p>
          <h1 className="font-heading mt-1 text-2xl font-semibold tracking-tight">Fitness Tracker — v0</h1>
          <p className="mt-2 max-w-md text-sm text-muted-foreground">
            Built from real shadcn/ui components, mobile-first (390px baseline). Stub data only — no
            backend. Use the controls below or the flask icon on any screen to switch theme/mode and
            simulate offline / BYOK / quota states.
          </p>
        </div>
        <div className="flex shrink-0 gap-2">
          <Button
            variant="outline"
            size="icon"
            className="size-11"
            aria-label="Toggle dark mode"
            onClick={() => setTheme(theme === "dark" ? "light" : "dark")}
          >
            <Sun className="size-5 dark:hidden" />
            <Moon className="hidden size-5 dark:block" />
          </Button>
          <SimulatorTriggerButton />
        </div>
      </div>

      <div className="mb-8 flex flex-wrap items-center gap-2 rounded-xl border border-border bg-card p-3">
        <span className="text-xs font-medium text-muted-foreground">Color preset:</span>
        {(["zinc", "slate", "red", "orange", "green", "blue", "violet", "rose"] as const).map((p) => (
          <button
            key={p}
            onClick={() => setPalette(p)}
            className="rounded-full border px-3 py-1 text-xs font-medium capitalize transition-all duration-150 active:scale-95"
            style={{
              borderColor: palette === p ? "var(--primary)" : "var(--border)",
              backgroundColor: palette === p ? "var(--primary)" : "transparent",
              color: palette === p ? "var(--primary-foreground)" : "var(--foreground)",
            }}
          >
            {p === "zinc" ? "Zinc (default)" : p}
          </button>
        ))}
      </div>

      <div className="space-y-6">
        {GROUPS.map((group) => (
          <div key={group.title}>
            <h2 className="mb-2 text-xs font-semibold tracking-wide text-muted-foreground uppercase">
              {group.title}
            </h2>
            <div className="overflow-hidden rounded-xl border border-border">
              {group.items.map((item, i) => (
                <Link
                  key={item.to}
                  to={item.to}
                  className={`flex items-center justify-between gap-3 bg-card px-4 py-3 text-sm transition-colors hover:bg-muted/60 ${i > 0 ? "border-t border-border" : ""}`}
                >
                  <div className="min-w-0">
                    <p className="font-medium">{item.label}</p>
                    {item.note && (
                      <Badge variant="outline" className="mt-1 text-[10px] text-muted-foreground">
                        {item.note}
                      </Badge>
                    )}
                  </div>
                  <ArrowRight className="size-4 shrink-0 text-muted-foreground" />
                </Link>
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
