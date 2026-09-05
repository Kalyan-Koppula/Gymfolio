import { test, expect } from "@playwright/test"
import { execSync } from "node:child_process"
import path from "node:path"
import {
  clearJourneyArtifacts,
  dismissOverlays,
  finishInProgressWorkout,
  shot,
  tab,
} from "./helpers/journey.ts"

const USER = `e2e_${Date.now().toString(36)}`
const PASS = "playwright-e2e-12chars"

test.beforeAll(() => {
  clearJourneyArtifacts()
  execSync("node e2e/helpers/reset-local-db.mjs", {
    cwd: path.resolve(process.cwd()),
    stdio: "inherit",
  })
})

test("full user journey — register through every screen", async ({ page }) => {
  test.setTimeout(360_000)

  // ── 1. Entry / register ──────────────────────────────────────────────
  await page.goto("/")
  await page.waitForURL(/\/(onboarding|login)/)
  if (page.url().includes("/login")) {
    // Reset should have cleared users; force onboarding if redirect raced.
    await page.goto("/onboarding")
  }
  await expect(page.getByRole("heading", { name: /Create the family admin account/i })).toBeVisible()
  await shot(page, "onboarding-account", "Onboarding — create account", {
    detail: `Registering owner ${USER}`,
  })

  await page.locator("#ob-username").fill(USER)
  await page.locator("#ob-password").fill(PASS)
  await shot(page, "onboarding-account-filled", "Onboarding — account form filled")
  await page.getByRole("button", { name: "Continue" }).click()

  // ── 2. Hydration ─────────────────────────────────────────────────────
  await expect(page.getByRole("heading", { name: /hydration goal/i })).toBeVisible()
  await shot(page, "onboarding-hydration", "Onboarding — hydration goal")
  await page.getByRole("button", { name: "3.0 L" }).click()
  await page.getByRole("button", { name: "Continue" }).click()

  // ── 3. Macros ────────────────────────────────────────────────────────
  await expect(page.getByRole("heading", { name: /protein\/macro/i })).toBeVisible()
  await shot(page, "onboarding-macros", "Onboarding — macro targets")
  await page.locator("#bw").fill("80")
  await page.getByRole("button", { name: "Continue" }).click()

  // ── 4. Equipment ─────────────────────────────────────────────────────
  await expect(page.getByRole("heading", { name: /equipment/i })).toBeVisible()
  await shot(page, "onboarding-equipment", "Onboarding — equipment profile")
  for (const label of ["Dumbbell", "Barbell", "Bench", "Bodyweight"]) {
    const chip = page.getByRole("button", { name: label })
    if (await chip.count()) await chip.first().click()
  }
  await shot(page, "onboarding-equipment-selected", "Onboarding — equipment selected")
  await page.getByRole("button", { name: "Finish setup" }).click()

  // ── 5. Today (empty routine) ─────────────────────────────────────────
  await page.waitForURL("**/today")
  await expect(page.getByRole("heading", { name: /Good (morning|afternoon|evening)/i })).toBeVisible({
    timeout: 20_000,
  })
  await shot(page, "today-empty", "Today — no routine yet (empty state)")

  // ── 6. Routine wizard ────────────────────────────────────────────────
  await page.getByRole("button", { name: "Build a routine" }).click()
  await page.waitForURL("**/train/routine/new")
  await expect(page.getByRole("heading", { name: /Choose a split/i })).toBeVisible()
  await shot(page, "wizard-split", "Routine wizard — choose split")
  await page.getByRole("button", { name: /Push \/ Pull \/ Legs/i }).click()
  await shot(page, "wizard-split-selected", "Routine wizard — PPL selected")
  await page.getByRole("button", { name: "Continue" }).click()

  await expect(page.getByRole("heading", { name: /^Schedule$/i })).toBeVisible()
  await shot(page, "wizard-schedule", "Routine wizard — schedule")
  await page.getByRole("button", { name: "Continue" }).click()

  await expect(page.getByRole("heading", { name: /Review & edit days/i })).toBeVisible({ timeout: 60_000 })
  await shot(page, "wizard-review", "Routine wizard — review days (autofilled)")
  // Open add-exercise sheet on first day
  const addEx = page.getByRole("button", { name: "Add exercise" }).first()
  if (await addEx.isVisible()) {
    await addEx.click()
    await expect(page.getByRole("heading", { name: /Add to/i })).toBeVisible()
    await shot(page, "wizard-add-exercise-sheet", "Routine wizard — add exercise sheet (day-aware)")
    await page.keyboard.press("Escape")
  }
  await page.getByRole("button", { name: "Save as active routine" }).click()
  await page.waitForURL("**/train/routine")
  await shot(page, "routine-builder", "Routine builder — active routine saved")

  // ── 7. Today with routine ────────────────────────────────────────────
  await tab(page, "Today")
  await page.waitForURL("**/today")
  await shot(page, "today-with-routine", "Today — next training day")

  // ── 8. Start workout (full screen) + resume bar ──────────────────────
  const startBtn = page.getByRole("button", { name: /Start workout|Mark rest day done/i })
  await expect(startBtn).toBeVisible()
  const startLabel = await startBtn.innerText()
  if (/rest/i.test(startLabel)) {
    await startBtn.click()
    await page.waitForTimeout(800)
    await shot(page, "today-after-rest", "Today — after marking rest day")
  }
  // Ensure we have a training day for workout flow
  for (let i = 0; i < 6; i++) {
    const btn = page.getByRole("button", { name: /Start workout/i })
    if (await btn.count()) break
    const skip = page.getByRole("button", { name: /Skip today|Mark rest day done/i })
    if (await skip.count()) {
      await skip.click()
      await page.waitForTimeout(600)
    } else break
  }
  await shot(page, "today-ready-to-train", "Today — ready to start workout")
  await page.getByRole("button", { name: /Start workout/i }).click()
  await page.waitForURL("**/train/workout")
  await shot(page, "active-workout", "Active workout — full screen")

  // Log first set if steppers present
  const logSet = page.getByRole("button", { name: /Log set/i })
  if (await logSet.count()) {
    await logSet.first().click()
    await page.waitForTimeout(500)
    await shot(page, "active-workout-logged-set", "Active workout — set logged")
  }

  // Leave mid-session to show resume bar
  await page.goto("/train")
  await page.waitForURL("**/train")
  await shot(page, "resume-bar", "Train library — resume workout mini-bar visible")
  const resume = page.getByRole("button", { name: /Resume/i })
  if (await resume.count()) {
    await resume.click()
    await page.waitForURL("**/train/workout")
    await shot(page, "active-workout-resumed", "Active workout — resumed from mini-bar")
  } else {
    await page.goto("/train/workout")
  }

  // Finish requires every set on the last exercise — drive UI, then API fallback.
  await finishInProgressWorkout(page)
  await shot(page, "today-after-workout", "Today — after finishing workout")

  // ── 9. Train — library, detail, equipment ────────────────────────────
  await tab(page, "Train")
  await page.waitForURL("**/train")
  await expect(page.getByText(/exercise/i).first()).toBeVisible({ timeout: 30_000 })
  await shot(page, "exercise-library", "Train — exercise library")

  const filterBtn = page.getByRole("button", { name: /Filter/i })
  if (await filterBtn.count()) {
    await filterBtn.click()
    await shot(page, "exercise-library-filters", "Train — library filters sheet")
    await page.keyboard.press("Escape")
  }

  const firstCard = page.locator('a[href*="/train/exercise/"]').first()
  await expect(firstCard).toBeVisible({ timeout: 30_000 })
  await firstCard.click()
  await page.waitForURL("**/train/exercise/**")
  await shot(page, "exercise-detail", "Train — exercise detail + media player")

  const addToRoutine = page.getByRole("button", { name: /Add to routine/i })
  if (await addToRoutine.count()) {
    await addToRoutine.click({ force: true })
    await page.waitForTimeout(500)
    await shot(page, "exercise-detail-add-to-routine", "Exercise detail — pick day sheet")
    await page.keyboard.press("Escape")
  }

  // Equipment via top bar / library link
  await page.goto("/train/equipment")
  await shot(page, "equipment-profile", "Train — equipment profile")

  await page.goto("/train/routine")
  await shot(page, "routine-builder-again", "Train — routine builder")

  // Change split dialog
  const menu = page.getByRole("button", { name: /Routine actions/i })
  if (await menu.count()) {
    await menu.click()
    await page.getByRole("menuitem", { name: /Change split/i }).click()
    await shot(page, "change-split-dialog", "Routine builder — change split (in place)")
    await page.keyboard.press("Escape")
  }

  // Soft helpers — never abort the whole journey on a non-critical UI miss
  async function softClick(locator: ReturnType<typeof page.getByRole>, label: string) {
    try {
      if (await locator.count()) await locator.first().click({ force: true, timeout: 5_000 })
    } catch (err) {
      console.warn(`softClick skipped (${label}):`, err instanceof Error ? err.message : err)
    }
  }

  // ── 10. Log hub — all tabs ───────────────────────────────────────────
  await tab(page, "Log")
  await page.waitForURL("**/log")
  await shot(page, "log-weight", "Log — weight tab")
  await page.locator("#weight-input").fill("79.5")
  await softClick(page.getByRole("button", { name: /^Save$/i }), "save weight")
  await page.waitForTimeout(600)
  await shot(page, "log-weight-saved", "Log — weight saved")

  await page.getByRole("tab", { name: /Hydration/i }).click()
  await shot(page, "log-hydration", "Log — hydration tab")
  await softClick(page.getByRole("button", { name: /\+ 250 ml/i }), "hydration +250")
  await page.waitForTimeout(400)
  await shot(page, "log-hydration-logged", "Log — hydration logged")

  await page.getByRole("tab", { name: /Sleep/i }).click()
  await shot(page, "log-sleep", "Log — sleep tab")
  await softClick(page.getByRole("button", { name: /^Save$/i }), "save sleep")
  await page.waitForTimeout(500)
  await shot(page, "log-sleep-saved", "Log — sleep saved")

  await page.getByRole("tab", { name: /Macros/i }).click()
  await shot(page, "log-macros", "Log — macros tab")
  await softClick(page.getByRole("button", { name: /^Save$/i }), "save macros")
  await page.waitForTimeout(500)
  await shot(page, "log-macros-saved", "Log — macros saved")

  // ── 11. Progress ─────────────────────────────────────────────────────
  await tab(page, "Progress")
  await page.waitForURL("**/progress")
  await shot(page, "progress-metrics", "Progress — body metrics trend")
  await page.goto("/progress/adherence")
  await shot(page, "progress-adherence", "Progress — adherence & history")

  // ── 12. Settings ─────────────────────────────────────────────────────
  await tab(page, "Settings")
  await page.waitForURL("**/settings")
  await shot(page, "settings-home", "Settings — home")

  await page.goto("/settings/appearance")
  await shot(page, "settings-appearance", "Settings — appearance")
  await softClick(page.getByRole("button", { name: /^Dark$/i }), "dark mode")
  await shot(page, "settings-appearance-dark", "Settings — dark mode applied")
  await softClick(page.getByRole("button", { name: /^Blue$/i }), "blue palette")
  await shot(page, "settings-appearance-blue", "Settings — blue palette")

  await page.goto("/settings/ai")
  await shot(page, "settings-ai", "Settings — AI provider (BYOK)")

  await page.goto("/settings/account")
  await shot(page, "settings-account", "Settings — account & sessions")

  await page.goto("/settings/family")
  await shot(page, "settings-family", "Settings — family & access")
  await page.getByRole("button", { name: /Send invite/i }).click()
  await expect(page.getByRole("dialog")).toBeVisible()
  await page.locator("#invite-label").fill("Partner")
  await page.getByRole("button", { name: /Create link/i }).click()
  await expect(page.getByRole("button", { name: /^Done$/i })).toBeVisible({ timeout: 10_000 })
  await shot(page, "settings-family-invite", "Settings — family invite link created")
  await page.getByRole("button", { name: /^Done$/i }).click()
  await dismissOverlays(page)

  // ── 13. Skip day action ──────────────────────────────────────────────
  await page.goto("/today")
  await page.waitForURL("**/today")
  await softClick(page.getByRole("button", { name: /Skip today/i }), "skip today")
  await page.waitForTimeout(700)
  await shot(page, "today-final", "Today — final state")

  await expect(page).not.toHaveURL(/login/)
})
