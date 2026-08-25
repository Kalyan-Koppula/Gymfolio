import { ArrowUpDown, Check, LayoutGrid, PersonStanding, Shuffle, Wrench } from "lucide-react"
import { SPLIT_PRESETS, type SplitType } from "@/lib/stub-data"

const SPLIT_ICONS: Record<SplitType, typeof PersonStanding> = {
  full_body: PersonStanding,
  upper_lower: ArrowUpDown,
  push_pull_legs: Shuffle,
  bro_split: LayoutGrid,
  custom: Wrench,
}

/** Shared by the standalone Routine Wizard ("change split") and Onboarding's workout-setup
 * steps, so both stay visually and behaviorally identical rather than drifting as two copies. */
export function SplitPicker({ value, onChange }: { value: SplitType | null; onChange: (id: SplitType) => void }) {
  return (
    <div className="space-y-2.5">
      {SPLIT_PRESETS.map((preset) => {
        const Icon = SPLIT_ICONS[preset.id]
        const selected = value === preset.id
        return (
          <button
            key={preset.id}
            onClick={() => onChange(preset.id)}
            className="flex w-full items-start gap-3 rounded-xl border p-3.5 text-left transition-all duration-150 active:scale-[0.99]"
            style={{
              borderColor: selected ? "var(--primary)" : "var(--border)",
              backgroundColor: selected ? "var(--accent)" : "transparent",
            }}
          >
            <div className="flex size-10 shrink-0 items-center justify-center rounded-full bg-primary/10 text-primary">
              <Icon className="size-5" />
            </div>
            <div className="min-w-0 flex-1">
              <div className="flex items-center justify-between gap-2">
                <p className="font-medium">{preset.label}</p>
                {selected && <Check className="size-4 shrink-0 text-primary" />}
              </div>
              <p className="text-sm text-muted-foreground">{preset.description}</p>
              <p className="mt-1 text-xs font-medium text-muted-foreground">{preset.recommendedDays}</p>
            </div>
          </button>
        )
      })}
    </div>
  )
}
