import { useParams } from "react-router-dom"
import { Plus, Search, MonitorPlay } from "lucide-react"
import { TopBar } from "@/components/nav/top-bar"
import { ExerciseThumb } from "@/components/shared/exercise-thumb"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { StickyActionBar } from "@/components/shared/sticky-action-bar"
import { EQUIPMENT_LABELS, exerciseById } from "@/lib/stub-data"

export function ExerciseDetail() {
  const { id } = useParams()
  const exercise = exerciseById(id ?? "")

  if (!exercise) return <div className="p-4 text-sm text-muted-foreground">Exercise not found.</div>

  return (
    <div>
      <TopBar title={exercise.name} back />
      <div className="space-y-5 px-4 py-4 pb-24">
        <ExerciseThumb hasGif={exercise.hasGif} className="w-full" />

        <div className="flex flex-wrap gap-1.5">
          {exercise.muscleGroups.map((m) => (
            <Badge key={m} className="capitalize">
              {m}
            </Badge>
          ))}
          {exercise.equipment.map((e) => (
            <Badge key={e} variant="secondary">
              {EQUIPMENT_LABELS[e]}
            </Badge>
          ))}
          <Badge variant="outline" className="capitalize">
            {exercise.difficulty}
          </Badge>
        </div>

        <div>
          <h3 className="mb-1.5 text-sm font-semibold">Instructions</h3>
          <p className="text-sm leading-relaxed text-muted-foreground">{exercise.instructions}</p>
        </div>

        <div>
          <h3 className="mb-2 flex items-center gap-1.5 text-sm font-semibold">
            <MonitorPlay className="size-4" /> Reference video
          </h3>
          <YoutubeState
            status={exercise.youtubeStatus}
            title={exercise.youtube?.title}
            channel={exercise.youtube?.channel}
            views={exercise.youtube?.views}
          />
        </div>
      </div>

      <StickyActionBar>
        <Button className="h-12 w-full text-base">
          <Plus className="size-4" /> Add to routine
        </Button>
      </StickyActionBar>
    </div>
  )
}

function YoutubeState({
  status,
  title,
  channel,
  views,
}: {
  status: "not_fetched" | "pending" | "ready"
  title?: string
  channel?: string
  views?: string
}) {
  if (status === "ready") {
    return (
      <Card className="overflow-hidden py-0">
        <div className="flex aspect-video items-center justify-center bg-black/85">
          <MonitorPlay className="size-10 text-white/70" />
        </div>
        <CardContent className="space-y-0.5 py-3">
          <p className="text-sm font-medium">{title}</p>
          <p className="text-xs text-muted-foreground">
            {channel} · {views}
          </p>
        </CardContent>
      </Card>
    )
  }

  // A calm, expected placeholder, not an error look. Most exercises sit here
  // until first added to a routine.
  return (
    <Card className="border-dashed py-6">
      <CardContent className="flex flex-col items-center gap-2 text-center">
        {status === "pending" ? (
          <>
            <Search className="size-6 animate-pulse text-muted-foreground" />
            <p className="text-sm font-medium">Fetching a reference video…</p>
            <p className="text-xs text-muted-foreground">Searched once this exercise was added to a routine.</p>
          </>
        ) : (
          <>
            <MonitorPlay className="size-6 text-muted-foreground" />
            <p className="text-sm font-medium">Not yet available</p>
            <p className="text-xs text-muted-foreground">
              Add this exercise to a routine to fetch a reference video.
            </p>
          </>
        )}
      </CardContent>
    </Card>
  )
}
