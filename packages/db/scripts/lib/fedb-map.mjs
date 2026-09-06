/** Maps free-exercise-db fields into this app's exercise schema. */

const MUSCLE_MAP = {
  abdominals: "core",
  chest: "chest",
  quadriceps: "legs",
  hamstrings: "legs",
  glutes: "glutes",
  shoulders: "shoulders",
  biceps: "arms",
  triceps: "arms",
  forearms: "arms",
  lats: "back",
  "middle back": "back",
  "lower back": "back",
  traps: "back",
  calves: "legs",
  adductors: "legs",
  abductors: "legs",
  neck: "shoulders",
}

const EQUIPMENT_MAP = {
  "body only": "bodyweight",
  barbell: "barbell",
  dumbbell: "dumbbell",
  cable: "cable-machine",
  machine: "cable-machine",
  kettlebells: "kettlebell",
  bands: "resistance-band",
  "e-z curl bar": "barbell",
  "medicine ball": "bodyweight",
  "exercise ball": "bodyweight",
  "foam roll": "bodyweight",
  other: "bodyweight",
  null: "bodyweight",
}

const LEVEL_MAP = {
  beginner: "beginner",
  intermediate: "intermediate",
  expert: "advanced",
}

/** Stub seed names (ex-1..ex-40) → free-exercise-db `id` field. */
export const LEGACY_STUB_MAP = {
  "ex-1": "Barbell_Full_Squat",
  "ex-2": "Barbell_Bench_Press_-_Medium_Grip",
  "ex-3": "Barbell_Deadlift",
  "ex-4": "Dumbbell_Shoulder_Press",
  "ex-5": "Pullups",
  "ex-6": "One-Arm_Dumbbell_Row",
  "ex-7": "Kettlebell_Swing",
  "ex-8": "Triceps_Pushdown",
  "ex-9": "Dumbbell_Lunges",
  "ex-10": "Plank",
  "ex-11": "Incline_Dumbbell_Press",
  "ex-12": "Wide-Grip_Lat_Pulldown",
  "ex-13": "Romanian_Deadlift",
  "ex-14": "Face_Pull",
  "ex-15": "Goblet_Squat",
  "ex-16": "Pushups",
  "ex-17": "Barbell_Shoulder_Press",
  "ex-18": "Seated_Cable_Rows",
  "ex-19": "Dumbbell_Bicep_Curl",
  "ex-20": "Hanging_Leg_Raise",
  "ex-21": "Barbell_Hip_Thrust",
  "ex-22": "Band_Pull_Apart",
  "ex-23": "Bulgarian_Split_Squat",
  "ex-24": "Farmers_Walk",
  "ex-25": "Dumbbell_Flyes",
  "ex-26": "Dips_-_Triceps_Version",
  "ex-27": "Standing_Calf_Raises",
  "ex-28": "Side_Plank",
  "ex-29": "Good_Morning",
  "ex-30": "Arnold_Dumbbell_Press",
  "ex-31": "Hammer_Curls",
  "ex-32": "Cable_Crunch",
  "ex-33": "Box_Squat",
  "ex-34": "Pendlay_Row",
  "ex-35": "Front_Barbell_Squat",
  "ex-36": "Sumo_Deadlift",
  "ex-37": "Side_Lateral_Raise",
  "ex-38": "Chin-Up",
  "ex-39": "Barbell_Glute_Bridge",
  "ex-40": "Mountain_Climbers",
}

export function fedbIdToSlug(id) {
  return id.toLowerCase().replace(/_/g, "-")
}

export function mapMuscles(primary = [], secondary = []) {
  const out = new Set()
  for (const m of [...primary, ...secondary]) {
    const mapped = MUSCLE_MAP[m?.toLowerCase?.() ?? m]
    if (mapped) out.add(mapped)
  }
  if (out.size === 0) out.add("core")
  return [...out]
}

export function mapEquipment(raw, exerciseName = "") {
  const key = raw == null ? "null" : String(raw).toLowerCase()
  const mapped = EQUIPMENT_MAP[key] ?? "bodyweight"
  const extras = []
  const n = exerciseName.toLowerCase()
  if (mapped === "barbell" && /squat|overhead|front|good morning/.test(n)) extras.push("squat-rack")
  if ((mapped === "barbell" || mapped === "dumbbell") && /bench|press|fly|row|curl|skull/.test(n))
    extras.push("bench")
  if (mapped === "bodyweight" && /pull|chin|hanging|muscle-up/.test(n)) extras.push("pull-up-bar")
  return [...new Set([mapped, ...extras])]
}

export function mapDifficulty(level) {
  return LEVEL_MAP[level] ?? "intermediate"
}

export function sqlString(value) {
  // Flatten newlines — wrangler `d1 execute --remote --file` often stalls/retries
  // on large SQL files that contain multiline string literals.
  const flat = String(value)
    .replace(/\r\n/g, "\n")
    .replace(/\n+/g, " ")
    .replace(/\s+/g, " ")
    .trim()
  return `'${flat.replace(/'/g, "''")}'`
}
