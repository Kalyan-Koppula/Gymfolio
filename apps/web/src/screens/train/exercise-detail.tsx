import * as React from "react"
import { useNavigate, useParams } from "react-router-dom"
import { Plus, Search, MonitorPlay } from "lucide-react"
import { toast } from "sonner"
import { TopBar } from "@/components/nav/top-bar"
import { ExerciseMediaPlayer } from "@/components/shared/exercise-media-player"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { Skeleton } from "@/components/ui/skeleton"
import { StickyActionBar } from "@/components/shared/sticky-action-bar"
import { AddExerciseSheet } from "@/components/shared/add-exercise-sheet"
import { useApiWrite } from "@/hooks/use-api-write"
import { EQUIPMENT_LABELS, toSaveRoutineDays } from "@/lib/stub-data"
import { useExercises, ensureExerciseYoutube } from "@/hooks/use-exercises"
import { getRoutine, saveRoutine } from "@/lib/api-client"
import type { Exercise, Routine, RoutineDay } from "shared"

export function ExerciseDetail() {
  const navigate = useNavigate()
  const { id } = useParams()
  const { byId, loading, applyExercise } = useExercises()
  const [exercise, setExercise] = React.useState<Exercise | undefined>()
  const [routine, setRoutine] = React.useState<Routine | null | undefined>(undefined)
  const [pickerOpen, setPickerOpen] = React.useState(false)
  const { status, run } = useApiWrite<{ routine: Routine }>("Added to routine")
  const base = id ? byId(id) : undefined
  const youtubeStatus = base?.youtubeStatus

  React.useEffect(() => {
    getRoutine()
      .then((res) => setRoutine(res.routine))
      .catch(() => setRoutine(null))
  }, [])

  React.useEffect(() => {
    if (base) setExercise(base)
  }, [base])

  // YouTube lazy-fetch: at most once per exercise id (module-level gate in ensureExerciseYoutube).
  // Depend only on id + status primitive — never on `base` object or `refresh`.
  React.useEffect(() => {
    if (!id || !youtubeStatus) return
    if (youtubeStatus === "ready" || youtubeStatus === "pending") return
    let cancelled = false
    void ensureExerciseYoutube(id)
      .then((updated) => {
        if (!cancelled && updated) {
          setExercise(updated)
          applyExercise(updated)
        }
      })
      .catch(() => {
        // Leave not_fetched — photo reference still works; do not retry (quota).
      })
    return () => {
      cancelled = true
    }
  }, [id, youtubeStatus, applyExercise])

  if (loading) {
    return (
      <div className="space-y-4 px-4 py-4">
        <Skeleton className="h-8 w-48" />
        <Skeleton className="aspect-video w-full" />
      </div>
    )
  }

  const shown = exercise ?? base
  if (!shown) return <div className="p-4 text-sm text-muted-foreground">Exercise not found.</div>

  function openAddFlow() {
    if (routine === undefined) return
    if (!routine) {
      toast.message("Create a routine first", {
        description: "Pick a split, then you can add exercises from the library.",
      })
      navigate("/train/routine/new")
      return
    }
    setPickerOpen(true)
  }

  function addToDay(dayId: string) {
    if (!routine || !shown) return
    const day = routine.days.find((d) => d.id === dayId)
    if (!day) return
    if (day.exercises.some((e) => e.exerciseId === shown.id)) {
      toast.message("Already on this day", { description: `${shown.name} is already on ${day.label}.` })
      setPickerOpen(false)
      return
    }

    const days: RoutineDay[] = routine.days.map((d) =>
      d.id !== dayId
        ? d
        : {
            ...d,
            exercises: [
              ...d.exercises,
              {
                exerciseId: shown.id,
                targetSets: 3,
                targetReps: "10",
                targetWeightKg: shown.equipment.length === 1 && shown.equipment[0] === "bodyweight" ? null : 20,
                orderIndex: d.exercises.length,
              },
            ],
          },
    )

    run(
      () =>
        saveRoutine({
          name: routine.name,
          splitType: routine.splitType,
          schedule: routine.schedule,
          days: toSaveRoutineDays(days),
        }),
      (res) => {
        setRoutine(res.routine)
        setPickerOpen(false)
      },
    )
  }

  return (
    <div>
      <TopBar title={shown.name} back />
      <div className="space-y-5 px-4 py-4 pb-24">
        <ExerciseMediaPlayer hasGif={shown.hasGif} exerciseId={shown.id} />

        <div className="flex flex-wrap gap-1.5">
          {shown.muscleGroups.map((m) => (
            <Badge key={m} className="capitalize">
              {m}
            </Badge>
          ))}
          {shown.equipment.map((e) => (
            <Badge key={e} variant="secondary">
              {EQUIPMENT_LABELS[e]}
            </Badge>
          ))}
          <Badge variant="outline" className="capitalize">
            {shown.difficulty}
          </Badge>
        </div>

        <div>
          <h3 className="mb-1.5 text-sm font-semibold">Instructions</h3>
          <p className="whitespace-pre-line text-sm leading-relaxed text-muted-foreground">{shown.instructions}</p>
        </div>

        <div>
          <h3 className="mb-2 flex items-center gap-1.5 text-sm font-semibold">
            <MonitorPlay className="size-4" /> Reference video
          </h3>
          <YoutubeState
            status={shown.youtubeStatus}
            videoId={shown.youtube?.videoId}
            title={shown.youtube?.title}
            channel={shown.youtube?.channel}
            views={shown.youtube?.views}
          />
        </div>
      </div>

      <StickyActionBar>
        <Button
          className="h-12 w-full text-base"
          onClick={openAddFlow}
          disabled={routine === undefined || status === "saving"}
        >
          <Plus className="size-4" /> {routine ? "Add to routine" : "Create routine to add"}
        </Button>
      </StickyActionBar>

      <AddExerciseSheet
        mode="pick-day"
        exercise={shown}
        days={routine?.days ?? []}
        open={pickerOpen}
        onOpenChange={setPickerOpen}
        disabled={status === "saving"}
        onAdd={addToDay}
      />
    </div>
  )
}

function YoutubeState({
  status,
  videoId,
  title,
  channel,
  views,
}: {
  status: "not_fetched" | "pending" | "ready"
  videoId?: string
  title?: string
  channel?: string
  views?: string
}) {
  if (status === "ready" && videoId) {
    return (
      <Card className="overflow-hidden py-0">
        <div className="aspect-video bg-black">
          <iframe
            title={title ?? "Exercise reference video"}
            src={`https://www.youtube-nocookie.com/embed/${videoId}`}
            className="size-full border-0"
            allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
            allowFullScreen
          />
        </div>
        <CardContent className="space-y-0.5 py-3">
          <p className="text-sm font-medium">{title}</p>
          <p className="text-xs text-muted-foreground">
            {channel}
            {views ? ` · ${views}` : ""}
          </p>
        </CardContent>
      </Card>
    )
  }

  return (
    <Card className="border-dashed py-6">
      <CardContent className="flex flex-col items-center gap-2 text-center">
        {status === "pending" ? (
          <>
            <Search className="size-6 animate-pulse text-muted-foreground" />
            <p className="text-sm font-medium">Fetching a reference video…</p>
            <p className="text-xs text-muted-foreground">Loaded from YouTube when you open this exercise.</p>
          </>
        ) : (
          <>
            <MonitorPlay className="size-6 text-muted-foreground" />
            <p className="text-sm font-medium">Video not available yet</p>
            <p className="text-xs text-muted-foreground">
              Set YOUTUBE_API_KEY on the API worker to enable lazy YouTube lookup.
            </p>
          </>
        )}
      </CardContent>
    </Card>
  )
}
