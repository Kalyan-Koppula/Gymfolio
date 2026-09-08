import { Link } from "react-router-dom"
import { Badge } from "@/components/ui/badge"
import { ExerciseThumb } from "@/components/shared/exercise-thumb"
import { EQUIPMENT_LABELS, type Exercise } from "@/lib/stub-data"

export function ExerciseCard({ exercise }: { exercise: Exercise }) {
  return (
    <Link
      to={`/train/exercise/${exercise.id}`}
      className="flex gap-3 rounded-xl border border-border bg-card p-3 transition-all duration-150 hover:bg-muted/50 active:scale-[0.98] focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:outline-none"
    >
      <ExerciseThumb
        hasGif={exercise.hasGif}
        exerciseId={exercise.id}
        media={exercise.media}
        className="w-20 shrink-0"
      />
      <div className="min-w-0 flex-1 space-y-1.5">
        <p className="truncate font-medium leading-tight">{exercise.name}</p>
        <div className="flex flex-wrap gap-1">
          {exercise.equipment.slice(0, 2).map((eq) => (
            <Badge key={eq} variant="secondary" className="text-[10px]">
              {EQUIPMENT_LABELS[eq]}
            </Badge>
          ))}
          <Badge variant="outline" className="text-[10px] capitalize">
            {exercise.muscleGroups[0]}
          </Badge>
        </div>
      </div>
    </Link>
  )
}
