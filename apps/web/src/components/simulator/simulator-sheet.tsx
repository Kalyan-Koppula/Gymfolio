import { FlaskConical, SkipForward } from "lucide-react"
import { Link } from "react-router-dom"
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
} from "@/components/ui/sheet"
import { Switch } from "@/components/ui/switch"
import { Label } from "@/components/ui/label"
import { Separator } from "@/components/ui/separator"
import { Button } from "@/components/ui/button"
import { useSimulator } from "@/contexts/simulator-provider"
import { ACTIVE_ROUTINE, getCurrentDay } from "@/lib/stub-data"

const SCREEN_INDEX = [
  { to: "/onboarding", label: "Onboarding (first run)" },
  { to: "/login", label: "Login" },
  { to: "/today", label: "Today (home dashboard)" },
  { to: "/log", label: "Log hub" },
  { to: "/train/library", label: "Exercise library" },
  { to: "/train/exercise/ex-1", label: "Exercise detail" },
  { to: "/train/equipment", label: "Equipment profile" },
  { to: "/train/routine", label: "Routine builder" },
  { to: "/train/routine/new", label: "New routine wizard (split/schedule)" },
  { to: "/train/workout", label: "Active workout logging" },
  { to: "/progress/metrics", label: "Body metrics trend" },
  { to: "/progress/adherence", label: "Adherence & history" },
  { to: "/settings", label: "Settings home" },
  { to: "/settings/ai", label: "AI provider (BYOK)" },
  { to: "/settings/appearance", label: "Appearance / theme" },
  { to: "/settings/account", label: "Account & sessions" },
]

/** One flask icon button, meant to sit inline in a screen's own header row (see TopBar) —
 *  deliberately not fixed-positioned, so it never collides with a screen's own header actions. */
export function SimulatorTriggerButton() {
  const { setSheetOpen } = useSimulator()
  return (
    <button
      onClick={() => setSheetOpen(true)}
      aria-label="Open prototype simulator controls"
      className="flex size-11 shrink-0 items-center justify-center rounded-full border border-dashed border-primary/50 text-primary"
    >
      <FlaskConical className="size-5" />
    </button>
  )
}

/** Rendered once at the app root; visibility is controlled via SimulatorTriggerButton elsewhere. */
export function SimulatorSheetRoot() {
  const sim = useSimulator()
  return (
    <Sheet open={sim.sheetOpen} onOpenChange={sim.setSheetOpen}>
      <SheetContent side="bottom" className="max-h-[85vh] overflow-y-auto rounded-t-2xl">
        <SheetHeader>
          <SheetTitle>Prototype simulator</SheetTitle>
          <SheetDescription>
            Not part of the product UI — lets you preview states that need a real backend or
            device condition (offline, BYOK not configured, quota pressure) for design review.
          </SheetDescription>
        </SheetHeader>
        <div className="space-y-4 px-4">
          <Row
            label="Network connection"
            description="Toggles the offline banner and write-failure states (§1.9)."
            checked={sim.online}
            onCheckedChange={sim.setOnline}
            onLabel="Online"
            offLabel="Offline"
          />
          <Row
            label="AI provider configured"
            description="Off shows the manual-fallback / AI-degraded states (FR-9.4)."
            checked={sim.aiConfigured}
            onCheckedChange={sim.setAiConfigured}
            onLabel="Configured"
            offLabel="Not configured"
          />
          <Row
            label="YouTube quota near cap"
            description="Shows the 'reference pending' degraded state (FR-4.6/NFR-5)."
            checked={sim.youtubeQuotaNearCap}
            onCheckedChange={sim.setYoutubeQuotaNearCap}
            onLabel="Near cap"
            offLabel="Healthy"
          />
          <Row
            label="Has an active routine"
            description="Off shows the Today dashboard's empty state."
            checked={sim.hasActiveRoutine}
            onCheckedChange={sim.setHasActiveRoutine}
            onLabel="Active"
            offLabel="None yet"
          />
          <div className="flex items-center justify-between gap-4">
            <div className="space-y-0.5">
              <p className="text-sm font-medium">Rotation position</p>
              <p className="text-xs text-muted-foreground">
                Advances "today's day" the same way finishing a workout would — currently{" "}
                <span className="font-medium text-foreground">
                  {getCurrentDay(ACTIVE_ROUTINE, sim.cycleStep).label}
                </span>
                .
              </p>
            </div>
            <Button variant="outline" size="sm" className="h-9 shrink-0" onClick={sim.advanceCycleStep}>
              <SkipForward className="size-3.5" /> Next day
            </Button>
          </div>
        </div>
        <Separator />
        <div className="space-y-2 px-4 pb-4">
          <p className="text-xs font-medium tracking-wide text-muted-foreground uppercase">
            Jump to any screen
          </p>
          <div className="grid grid-cols-1 gap-1">
            {SCREEN_INDEX.map((s) => (
              <Link
                key={s.to}
                to={s.to}
                className="rounded-md px-2 py-2 text-sm hover:bg-muted focus-visible:bg-muted focus-visible:outline-none"
              >
                {s.label}
              </Link>
            ))}
          </div>
        </div>
      </SheetContent>
    </Sheet>
  )
}

function Row({
  label,
  description,
  checked,
  onCheckedChange,
  onLabel,
  offLabel,
}: {
  label: string
  description: string
  checked: boolean
  onCheckedChange: (v: boolean) => void
  onLabel: string
  offLabel: string
}) {
  const id = label.replace(/\s+/g, "-").toLowerCase()
  return (
    <div className="flex items-start justify-between gap-4">
      <div className="space-y-0.5">
        <Label htmlFor={id} className="text-sm font-medium">
          {label}
        </Label>
        <p className="text-xs text-muted-foreground">{description}</p>
      </div>
      <div className="flex shrink-0 items-center gap-2">
        <span className="w-24 text-right text-xs text-muted-foreground">
          {checked ? onLabel : offLabel}
        </span>
        <Switch id={id} checked={checked} onCheckedChange={onCheckedChange} />
      </div>
    </div>
  )
}
