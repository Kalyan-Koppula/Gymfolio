import { atom } from "jotai"
import { atomWithStorage } from "jotai/utils"
import type { Equipment, MuscleGroup } from "@/lib/stub-data"

/** PWA install card: dismissed timestamp (ms), or null if never dismissed. */
export const pwaInstallDismissedAtAtom = atomWithStorage<number | null>(
  "gymfolio:pwa-install-dismissed-at",
  null,
)

export const exerciseSearchAtom = atom("")
export const exerciseMuscleFilterAtom = atom(new Set<MuscleGroup>())
export const exerciseEquipmentFilterAtom = atom(new Set<Equipment>())

export function toggleSetItem<T>(set: Set<T>, val: T): Set<T> {
  const next = new Set(set)
  if (next.has(val)) next.delete(val)
  else next.add(val)
  return next
}
