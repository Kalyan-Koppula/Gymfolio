import * as React from "react"
import { ClipboardList, Filter, Search, Settings2, X } from "lucide-react"
import { Link } from "react-router-dom"
import { TopBar } from "@/components/nav/top-bar"
import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { ExerciseCard } from "@/components/shared/exercise-card"
import { EmptyState } from "@/components/shared/empty-state"
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetFooter,
  SheetTrigger,
} from "@/components/ui/sheet"
import { EQUIPMENT_LABELS, type Equipment, type MuscleGroup } from "@/lib/stub-data"
import { useExercises } from "@/hooks/use-exercises"
import { Skeleton } from "@/components/ui/skeleton"

const MUSCLE_GROUPS: MuscleGroup[] = ["chest", "back", "shoulders", "legs", "arms", "core", "glutes"]
const EQUIPMENT = Object.keys(EQUIPMENT_LABELS) as Equipment[]

export function ExerciseLibrary() {
  const { exercises, loading } = useExercises()
  const [query, setQuery] = React.useState("")
  const [muscleFilter, setMuscleFilter] = React.useState<Set<MuscleGroup>>(new Set())
  const [equipmentFilter, setEquipmentFilter] = React.useState<Set<Equipment>>(new Set())

  const filtered = (exercises ?? []).filter((ex) => {
    const matchesQuery = ex.name.toLowerCase().includes(query.toLowerCase())
    const matchesMuscle = muscleFilter.size === 0 || ex.muscleGroups.some((m) => muscleFilter.has(m))
    const matchesEquipment = equipmentFilter.size === 0 || ex.equipment.some((e) => equipmentFilter.has(e))
    return matchesQuery && matchesMuscle && matchesEquipment
  })

  const activeFilterCount = muscleFilter.size + equipmentFilter.size

  function toggle<T>(set: Set<T>, setSet: (s: Set<T>) => void, val: T) {
    const next = new Set(set)
    if (next.has(val)) next.delete(val)
    else next.add(val)
    setSet(next)
  }

  return (
    <div>
      <TopBar
        title="Exercise library"
        action={
          <Button variant="ghost" size="icon" className="size-11" render={<Link to="/train/routine" />} nativeButton={false} aria-label="My routine">
            <ClipboardList className="size-5" />
          </Button>
        }
      />
      {!loading && exercises && (
        <p className="px-4 pt-3 text-xs text-muted-foreground">{exercises.length} exercises · photos cached for offline reference</p>
      )}
      <div className="space-y-4 px-4 py-4 md:px-6 lg:px-8">
        <div className="flex gap-2">
          <div className="relative flex-1">
            <Search className="absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search exercises…"
              className="h-11 pl-9 text-base"
            />
          </div>
          <Sheet>
            <SheetTrigger
              render={
                <Button variant="outline" className="relative h-11 w-11 shrink-0 px-0">
                  <Filter className="size-4" />
                </Button>
              }
            >
              {activeFilterCount > 0 && (
                <span className="absolute -top-1 -right-1 flex size-4 items-center justify-center rounded-full bg-primary text-[10px] text-primary-foreground">
                  {activeFilterCount}
                </span>
              )}
            </SheetTrigger>
            <SheetContent side="bottom" className="max-h-[80vh] overflow-y-auto rounded-t-2xl">
              <SheetHeader>
                <SheetTitle>Filter exercises</SheetTitle>
              </SheetHeader>
              <div className="space-y-5 px-4">
                <div>
                  <p className="mb-2 text-xs font-medium tracking-wide text-muted-foreground uppercase">
                    Muscle group
                  </p>
                  <div className="flex flex-wrap gap-2">
                    {MUSCLE_GROUPS.map((m) => (
                      <FilterChip
                        key={m}
                        active={muscleFilter.has(m)}
                        onClick={() => toggle(muscleFilter, setMuscleFilter, m)}
                        label={m}
                      />
                    ))}
                  </div>
                </div>
                <div>
                  <p className="mb-2 text-xs font-medium tracking-wide text-muted-foreground uppercase">
                    Equipment (from your profile)
                  </p>
                  <div className="flex flex-wrap gap-2">
                    {EQUIPMENT.map((e) => (
                      <FilterChip
                        key={e}
                        active={equipmentFilter.has(e)}
                        onClick={() => toggle(equipmentFilter, setEquipmentFilter, e)}
                        label={EQUIPMENT_LABELS[e]}
                      />
                    ))}
                  </div>
                </div>
              </div>
              <SheetFooter className="flex-row">
                <Button
                  variant="ghost"
                  className="h-11 flex-1"
                  onClick={() => {
                    setMuscleFilter(new Set())
                    setEquipmentFilter(new Set())
                  }}
                >
                  <X className="size-4" /> Clear
                </Button>
                <Button variant="outline" className="h-11 flex-1" render={<Link to="/train/equipment" />} nativeButton={false}>
                  <Settings2 className="size-4" /> Manage equipment
                </Button>
              </SheetFooter>
            </SheetContent>
          </Sheet>
        </div>

        {activeFilterCount > 0 && (
          <div className="flex flex-wrap gap-1.5">
            {[...muscleFilter].map((m) => (
              <Badge key={m} variant="secondary" className="capitalize">
                {m}
              </Badge>
            ))}
            {[...equipmentFilter].map((e) => (
              <Badge key={e} variant="secondary">
                {EQUIPMENT_LABELS[e]}
              </Badge>
            ))}
          </div>
        )}

        {loading ? (
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4">
            <Skeleton className="h-28 w-full" />
            <Skeleton className="h-28 w-full" />
          </div>
        ) : filtered.length > 0 ? (
          // Keyed by the filter selection (not the search text, so typing doesn't re-fire this
          // on every keystroke) — applying/clearing a filter chip fades the result set in.
          <div
            key={`${[...muscleFilter].join(",")}|${[...equipmentFilter].join(",")}`}
            className="grid grid-cols-1 gap-3 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 animate-in fade-in duration-200 ease-out"
          >
            {filtered.map((ex) => (
              <ExerciseCard key={ex.id} exercise={ex} />
            ))}
          </div>
        ) : (
          <EmptyState
            icon={Search}
            title="No exercises match"
            description="Try clearing a filter or searching a different term."
          />
        )}
      </div>
    </div>
  )
}

function FilterChip({ active, onClick, label }: { active: boolean; onClick: () => void; label: string }) {
  return (
    <button
      onClick={onClick}
      className="h-9 rounded-full border px-3 text-sm font-medium capitalize transition-all duration-150 active:scale-95"
      style={{
        borderColor: active ? "var(--primary)" : "var(--border)",
        backgroundColor: active ? "var(--primary)" : "transparent",
        color: active ? "var(--primary-foreground)" : "var(--foreground)",
      }}
    >
      {label}
    </button>
  )
}
