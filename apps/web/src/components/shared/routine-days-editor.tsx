import * as React from "react"
import { History, Plus, Trash2 } from "lucide-react"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from "@/components/ui/sheet"
import { Input } from "@/components/ui/input"
import { NumberStepper } from "@/components/shared/number-stepper"
import { EXERCISES, exerciseById, suggestNextWeight, type RoutineDay } from "@/lib/stub-data"

function parseLeadingInt(s: string, fallback: number) {
  const m = s.match(/\d+/)
  return m ? Number(m[0]) : fallback
}

/**
 * The day-tabs + per-exercise sets/reps/weight editor, shared between the persistent
 * Routine Builder screen and the new-routine wizard's review step — same editing
 * behavior either way, so a routine built from a preset is exactly as editable as one
 * that's already active.
 */
export function RoutineDaysEditor({
  days,
  setDays,
  activeDay,
  onActiveDayChange,
}: {
  days: RoutineDay[]
  setDays: React.Dispatch<React.SetStateAction<RoutineDay[]>>
  activeDay: string
  onActiveDayChange: (id: string) => void
}) {
  function updateExercise(
    dayId: string,
    exerciseId: string,
    patch: Partial<{ targetSets: number; targetReps: string; targetWeightKg: number | null }>,
  ) {
    setDays((prev) =>
      prev.map((d) =>
        d.id !== dayId
          ? d
          : { ...d, exercises: d.exercises.map((e) => (e.exerciseId === exerciseId ? { ...e, ...patch } : e)) },
      ),
    )
  }

  function removeExercise(dayId: string, exerciseId: string) {
    setDays((prev) =>
      prev.map((d) => (d.id !== dayId ? d : { ...d, exercises: d.exercises.filter((e) => e.exerciseId !== exerciseId) })),
    )
  }

  function addExercise(dayId: string, exerciseId: string) {
    setDays((prev) =>
      prev.map((d) =>
        d.id !== dayId
          ? d
          : {
              ...d,
              exercises: [...d.exercises, { exerciseId, targetSets: 3, targetReps: "10", targetWeightKg: 20 }],
            },
      ),
    )
  }

  if (days.length === 0) return null

  return (
    <Tabs value={activeDay} onValueChange={onActiveDayChange}>
      <TabsList className="w-full">
        {days.map((d) => (
          <TabsTrigger key={d.id} value={d.id} className="h-full text-sm">
            {d.label}
          </TabsTrigger>
        ))}
      </TabsList>

      {days.map((day) => (
        <TabsContent key={day.id} value={day.id} className="mt-4 space-y-3">
          {day.exercises.map((re) => {
            const ex = exerciseById(re.exerciseId)
            if (!ex) return null
            const suggested = suggestNextWeight(re)
            return (
              <Card key={re.exerciseId} className="py-3">
                <CardContent className="space-y-3 px-3.5">
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <p className="text-sm font-medium leading-tight">{ex.name}</p>
                      {re.lastPerformance && (
                        <p className="mt-0.5 flex items-center gap-1 text-xs text-muted-foreground">
                          <History className="size-3" />
                          Last time: {re.lastPerformance.reps} × {re.lastPerformance.weightKg}kg
                          {suggested !== re.lastPerformance.weightKg && (
                            <span className="font-medium text-success">→ {suggested}kg suggested</span>
                          )}
                        </p>
                      )}
                    </div>
                    <button
                      aria-label={`Remove ${ex.name}`}
                      onClick={() => removeExercise(day.id, re.exerciseId)}
                      className="flex size-8 shrink-0 items-center justify-center rounded-md text-muted-foreground hover:bg-destructive/10 hover:text-destructive"
                    >
                      <Trash2 className="size-4" />
                    </button>
                  </div>
                  <div className="flex items-center justify-between gap-2">
                    <StepperField
                      label="Sets"
                      value={re.targetSets}
                      onChange={(v) => updateExercise(day.id, re.exerciseId, { targetSets: v })}
                      min={1}
                    />
                    <StepperField
                      label="Reps"
                      value={parseLeadingInt(re.targetReps, 10)}
                      onChange={(v) => updateExercise(day.id, re.exerciseId, { targetReps: String(v) })}
                      min={1}
                    />
                    <StepperField
                      label="Weight"
                      value={re.targetWeightKg ?? 0}
                      onChange={(v) => updateExercise(day.id, re.exerciseId, { targetWeightKg: v })}
                      step={2.5}
                      suffix="kg"
                    />
                  </div>
                </CardContent>
              </Card>
            )
          })}

          <AddExerciseSheet onAdd={(id) => addExercise(day.id, id)} />
        </TabsContent>
      ))}
    </Tabs>
  )
}

function StepperField({
  label,
  value,
  onChange,
  min = 0,
  step = 1,
  suffix,
}: {
  label: string
  value: number
  onChange: (v: number) => void
  min?: number
  step?: number
  suffix?: string
}) {
  return (
    <div className="flex flex-1 flex-col items-center gap-1">
      <span className="text-[10px] font-medium tracking-wide text-muted-foreground uppercase">{label}</span>
      <NumberStepper value={value} onChange={onChange} min={min} step={step} suffix={suffix} size="compact" />
    </div>
  )
}

function AddExerciseSheet({ onAdd }: { onAdd: (exerciseId: string) => void }) {
  const [query, setQuery] = React.useState("")
  const [open, setOpen] = React.useState(false)
  const results = EXERCISES.filter((e) => e.name.toLowerCase().includes(query.toLowerCase())).slice(0, 20)

  return (
    <Sheet open={open} onOpenChange={setOpen}>
      <SheetTrigger
        render={
          <Button variant="outline" className="h-11 w-full border-dashed text-sm">
            <Plus className="size-4" /> Add exercise
          </Button>
        }
      />
      <SheetContent side="bottom" className="max-h-[85vh] overflow-y-auto rounded-t-2xl">
        <SheetHeader>
          <SheetTitle>Add from your available pool</SheetTitle>
        </SheetHeader>
        <div className="space-y-3 px-4 pb-4">
          <Input
            autoFocus
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search exercises…"
            className="h-11 text-base"
          />
          <div className="space-y-1">
            {results.map((ex) => (
              <button
                key={ex.id}
                onClick={() => {
                  onAdd(ex.id)
                  setOpen(false)
                  setQuery("")
                }}
                className="flex w-full items-center justify-between rounded-lg px-2 py-2.5 text-left text-sm hover:bg-muted"
              >
                <span>{ex.name}</span>
                <Plus className="size-4 text-muted-foreground" />
              </button>
            ))}
          </div>
        </div>
      </SheetContent>
    </Sheet>
  )
}
