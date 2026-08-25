/** Computes hours between two HH:MM times, assuming an overnight span when end <= start
 * (the normal case — bedtime is before midnight, wake time after). */
export function computeSleepHours(startTime: string, endTime: string): number {
  const [startH, startM] = startTime.split(":").map(Number)
  const [endH, endM] = endTime.split(":").map(Number)
  const startMinutes = startH * 60 + startM
  let endMinutes = endH * 60 + endM
  if (endMinutes <= startMinutes) endMinutes += 24 * 60
  return Math.round(((endMinutes - startMinutes) / 60) * 10) / 10
}
