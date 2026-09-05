import * as React from "react"
import { ChevronDown, ChevronUp, Plus } from "lucide-react"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from "@/components/ui/sheet"
import { ExerciseMediaQuickView } from "@/components/shared/exercise-media-quick-view"
import {
  activeDays,
  describeDayFocus,
  exerciseMatchesDayFocus,
  filterExercisesForDay,
  resolveDayMuscleFocus,
  type Equipment,
  type RoutineDay,
} from "@/lib/stub-data"
import type { Exercise } from "shared"

type CommonProps = {
  /** Controlled open state — omit to let the sheet manage its own (with `trigger`). */
  open?: boolean
  onOpenChange?: (open: boolean) => void
  trigger?: React.ReactElement
  disabled?: boolean
}

/** Fixed day, pick an exercise for it. */
type PickExerciseProps = CommonProps & {
  mode: "pick-exercise"
  dayLabel: string
  exercises: Exercise[]
  equipment?: Equipment[]
  excludeIds?: string[]
  onAdd: (exerciseId: string) => void
}

/** Fixed exercise, pick which routine day it goes on. */
type PickDayProps = CommonProps & {
  mode: "pick-day"
  exercise: Exercise
  days: RoutineDay[]
  onAdd: (dayId: string) => void
}

export type AddExerciseSheetProps = PickExerciseProps | PickDayProps

/**
 * One picker for both directions of "put this exercise on that day" — from the routine
 * editor (day fixed) and from an exercise's detail screen (exercise fixed). Both sides sort
 * by muscle-focus match so the split's intent survives whichever way the user came in.
 */
export function AddExerciseSheet(props: AddExerciseSheetProps) {
  const [internalOpen, setInternalOpen] = React.useState(false)
  const open = props.open ?? internalOpen

  const setOpen = React.useCallback(
    (next: boolean) => {
      setInternalOpen(next)
      props.onOpenChange?.(next)
    },
    [props],
  )

  const defaultTrigger =
    props.mode === "pick-exercise" ? (
      <Button variant="outline" className="h-11 w-full border-dashed text-sm">
        <Plus className="size-4" /> Add exercise
      </Button>
    ) : null

  const trigger = props.trigger ?? defaultTrigger

  return (
    <Sheet open={open} onOpenChange={setOpen}>
      {trigger ? <SheetTrigger render={trigger} /> : null}
      <SheetContent side="bottom" className="max-h-[90vh] overflow-y-auto rounded-t-2xl">
        {props.mode === "pick-exercise" ? (
          <PickExerciseBody {...props} open={open} onPicked={() => setOpen(false)} />
        ) : (
          <PickDayBody {...props} onPicked={() => setOpen(false)} />
        )}
      </SheetContent>
    </Sheet>
  )
}

function PickExerciseBody({
  dayLabel,
  exercises,
  equipment = [],
  excludeIds = [],
  onAdd,
  open,
  onPicked,
}: PickExerciseProps & { open: boolean; onPicked: () => void }) {
  const [query, setQuery] = React.useState("")
  const [showAll, setShowAll] = React.useState(false)

  React.useEffect(() => {
    if (!open) {
      setQuery("")
      setShowAll(false)
    }
  }, [open])

  const { recommended, all } = filterExercisesForDay(exercises, dayLabel, { equipment, excludeIds })
  const q = query.trim().toLowerCase()

  function matchesSearch(ex: Exercise) {
    return !q || ex.name.toLowerCase().includes(q)
  }

  const recommendedFiltered = recommended.filter(matchesSearch)
  const otherFiltered = all.filter(matchesSearch).filter((ex) => !recommended.some((r) => r.id === ex.id))
  const focusLabel = describeDayFocus(dayLabel)

  function pick(id: string) {
    onAdd(id)
    onPicked()
  }

  return (
    <>
      <SheetHeader>
        <SheetTitle>Add to {dayLabel}</SheetTitle>
        <p className="text-left text-xs text-muted-foreground">
          Showing exercises for <span className="font-medium text-foreground">{focusLabel}</span>
          {equipment.length > 0 ? " · matching your equipment" : ""}
        </p>
      </SheetHeader>
      <div className="space-y-3 px-4 pb-4">
        <Input
          autoFocus
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search exercises…"
          className="h-11 text-base"
        />

        {recommendedFiltered.length > 0 ? (
          <ExercisePickerSection
            title={`Recommended (${recommendedFiltered.length})`}
            items={recommendedFiltered}
            onAdd={pick}
          />
        ) : (
          <p className="py-4 text-center text-sm text-muted-foreground">
            No matching exercises for this day{q ? " with that search" : ""}.
          </p>
        )}

        {otherFiltered.length > 0 ? (
          <div className="space-y-2 border-t border-border pt-3">
            <Button
              type="button"
              variant="ghost"
              className="h-9 w-full justify-between px-2 text-sm text-muted-foreground"
              onClick={() => setShowAll((v) => !v)}
            >
              {showAll ? "Hide all exercises" : `Show all exercises (${otherFiltered.length} more)`}
              {showAll ? <ChevronUp className="size-4" /> : <ChevronDown className="size-4" />}
            </Button>
            {showAll ? (
              <ExercisePickerSection
                title="All exercises"
                items={otherFiltered}
                onAdd={pick}
              />
            ) : null}
          </div>
        ) : null}
      </div>
    </>
  )
}

function PickDayBody({
  exercise,
  days,
  onAdd,
  disabled,
  onPicked,
}: PickDayProps & { onPicked: () => void }) {
  const trainingDays = activeDays(days).filter((d) => d.dayType !== "rest")

  const ranked = trainingDays
    .map((day) => {
      const focus = resolveDayMuscleFocus(day.label)
      return {
        day,
        suggested: focus ? exerciseMatchesDayFocus(exercise, focus) : false,
        already: day.exercises.some((e) => e.exerciseId === exercise.id),
      }
    })
    .sort((a, b) => Number(b.suggested) - Number(a.suggested))

  function pick(dayId: string) {
    onAdd(dayId)
    onPicked()
  }

  return (
    <>
      <SheetHeader>
        <SheetTitle>Add {exercise.name} to…</SheetTitle>
        <p className="text-left text-xs text-muted-foreground">
          Days that train {exercise.muscleGroups.join(", ")} come first.
        </p>
      </SheetHeader>
      <div className="space-y-1 px-4 pb-4">
        {ranked.length === 0 ? (
          <p className="py-4 text-center text-sm text-muted-foreground">
            No training days on your routine yet — add one from the routine builder first.
          </p>
        ) : (
          ranked.map(({ day, suggested, already }) => (
            <button
              key={day.id}
              type="button"
              disabled={already || disabled}
              onClick={() => pick(day.id)}
              className="flex w-full items-center justify-between rounded-lg px-3 py-3 text-left text-sm hover:bg-muted disabled:opacity-50"
            >
              <span className="flex items-center gap-2">
                {day.label}
                {suggested ? (
                  <Badge variant="secondary" className="text-[10px]">
                    Suggested
                  </Badge>
                ) : null}
              </span>
              <span className="text-xs text-muted-foreground">
                {already ? "Added" : `${day.exercises.length} exercises`}
              </span>
            </button>
          ))
        )}
      </div>
    </>
  )
}

function ExercisePickerSection({
  title,
  items,
  onAdd,
}: {
  title: string
  items: Exercise[]
  onAdd: (id: string) => void
}) {
  return (
    <div className="space-y-1">
      <p className="text-xs font-medium tracking-wide text-muted-foreground uppercase">{title}</p>
      {items.map((ex) => (
        <ExercisePickerRow key={ex.id} exercise={ex} onAdd={() => onAdd(ex.id)} />
      ))}
    </div>
  )
}

function ExercisePickerRow({ exercise, onAdd }: { exercise: Exercise; onAdd: () => void }) {
  return (
    <div className="rounded-lg border border-transparent hover:border-border">
      <div className="flex items-center gap-3 p-2">
        <ExerciseMediaQuickView exercise={exercise} className="w-20 shrink-0" />
        <button
          type="button"
          onClick={onAdd}
          className="min-w-0 flex-1 py-1 text-left text-sm leading-snug hover:underline"
        >
          {exercise.name}
        </button>
        <Button
          type="button"
          variant="ghost"
          size="icon"
          className="size-8 shrink-0"
          onClick={onAdd}
          aria-label={`Add ${exercise.name}`}
        >
          <Plus className="size-4" />
        </Button>
      </div>
    </div>
  )
}
