import fs from "node:fs"
import path from "node:path"
import type { Page } from "@playwright/test"

export type JourneyStep = {
  index: number
  id: string
  title: string
  detail?: string
  path: string
  screenshot: string
  ok: boolean
  error?: string
  at: string
}

const OUT_DIR = path.resolve(process.cwd(), "e2e-output/journey")
const SHOTS_DIR = path.join(OUT_DIR, "screenshots")

export function ensureJourneyDirs() {
  fs.mkdirSync(SHOTS_DIR, { recursive: true })
  const manifest = path.join(OUT_DIR, "steps.json")
  if (!fs.existsSync(manifest)) fs.writeFileSync(manifest, "[]")
}

export function clearJourneyArtifacts() {
  fs.rmSync(OUT_DIR, { recursive: true, force: true })
  ensureJourneyDirs()
}

function readSteps(): JourneyStep[] {
  ensureJourneyDirs()
  try {
    return JSON.parse(fs.readFileSync(path.join(OUT_DIR, "steps.json"), "utf8")) as JourneyStep[]
  } catch {
    return []
  }
}

function writeSteps(steps: JourneyStep[]) {
  fs.writeFileSync(path.join(OUT_DIR, "steps.json"), JSON.stringify(steps, null, 2))
}

/** Capture a named screenshot and append to the journey manifest. */
export async function shot(
  page: Page,
  id: string,
  title: string,
  opts?: { detail?: string; fullPage?: boolean },
) {
  ensureJourneyDirs()
  const steps = readSteps()
  const index = steps.length + 1
  const file = `${String(index).padStart(2, "0")}-${id}.png`
  const abs = path.join(SHOTS_DIR, file)
  let ok = true
  let error: string | undefined
  try {
    await page.waitForTimeout(250)
    await page.screenshot({ path: abs, fullPage: opts?.fullPage ?? true })
  } catch (err) {
    ok = false
    error = err instanceof Error ? err.message : String(err)
  }
  steps.push({
    index,
    id,
    title,
    detail: opts?.detail,
    path: page.url(),
    screenshot: `screenshots/${file}`,
    ok,
    error,
    at: new Date().toISOString(),
  })
  writeSteps(steps)
  return steps[steps.length - 1]
}

/** Close dialogs / sheets that block the bottom tab bar. */
export async function dismissOverlays(page: Page) {
  for (let i = 0; i < 3; i++) {
    const dialog = page.getByRole("dialog")
    if (!(await dialog.count())) break
    const done = dialog.getByRole("button", { name: /^Done$/i })
    if (await done.count()) {
      await done.first().click({ force: true }).catch(() => {})
    } else {
      await page.keyboard.press("Escape").catch(() => {})
    }
    await page.waitForTimeout(200)
  }
}

const TAB_PATHS: Record<string, string> = {
  Today: "/today",
  Train: "/train",
  Log: "/log",
  Progress: "/progress",
  Settings: "/settings",
}

export async function tab(page: Page, label: string) {
  await dismissOverlays(page)
  const link = page.getByRole("navigation", { name: "Primary" }).getByRole("link", { name: label })
  try {
    await link.click({ timeout: 5_000 })
  } catch {
    const path = TAB_PATHS[label]
    if (!path) throw new Error(`Unknown tab: ${label}`)
    await page.goto(path)
  }
}

/** Drive active workout UI until Finish, or finish via API if still in progress. */
export async function finishInProgressWorkout(page: Page) {
  if (!page.url().includes("/train/workout")) {
    const resume = page.getByRole("button", { name: /Resume/i })
    if (await resume.count()) {
      await resume.first().click()
      await page.waitForURL("**/train/workout", { timeout: 10_000 }).catch(() => {})
    } else {
      await page.goto("/train/workout")
    }
  }

  for (let i = 0; i < 48; i++) {
    const finishBtn = page.getByRole("button", { name: /Finish workout/i })
    if (await finishBtn.count()) {
      await finishBtn.click()
      await page.waitForURL("**/today", { timeout: 15_000 }).catch(() => {})
      break
    }
    const next = page.getByRole("button", { name: /Next exercise/i })
    if (await next.count()) {
      await next.click()
      await page.waitForTimeout(250)
      continue
    }
    const logSet = page.getByRole("button", { name: /Log set|Retry/i })
    if (await logSet.count()) {
      await logSet.first().click()
      await page.waitForTimeout(350)
      continue
    }
    break
  }

  // API fallback — Finish is only shown after every set on the last exercise.
  await page.evaluate(async () => {
    const r = await fetch("/api/workouts/in-progress", { credentials: "include" })
    if (!r.ok) return
    const data = (await r.json()) as { workout: { id: string } | null }
    if (!data.workout) return
    await fetch(`/api/workouts/${data.workout.id}/finish`, {
      method: "POST",
      credentials: "include",
      headers: { "Content-Type": "application/json" },
    })
  })
  await page.goto("/today")
  await page.waitForTimeout(400)
  // Resume bar should be gone; if not, one more finish attempt.
  if (await page.getByRole("button", { name: /Resume/i }).count()) {
    await page.evaluate(async () => {
      const r = await fetch("/api/workouts/in-progress", { credentials: "include" })
      const data = (await r.json()) as { workout: { id: string } | null }
      if (data.workout) {
        await fetch(`/api/workouts/${data.workout.id}/finish`, {
          method: "POST",
          credentials: "include",
          headers: { "Content-Type": "application/json" },
        })
      }
    })
    await page.reload()
    await page.waitForTimeout(500)
  }
}

export function writeHtmlReport(meta?: { status?: string }) {
  const steps = readSteps()
  const passed = steps.filter((s) => s.ok).length
  const failed = steps.filter((s) => !s.ok).length
  const html = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>GymApp — E2E journey report</title>
  <style>
    :root { color-scheme: light dark; --bg: #0b0b0c; --card: #161618; --text: #f2f2f3; --muted: #9a9aa0; --ok: #3ecf8e; --bad: #f07178; --line: #2a2a2e; }
    @media (prefers-color-scheme: light) {
      :root { --bg: #f6f5f2; --card: #fff; --text: #16161a; --muted: #666; --line: #e6e4df; }
    }
    * { box-sizing: border-box; }
    body { margin: 0; font-family: ui-sans-serif, system-ui, -apple-system, Segoe UI, sans-serif; background: var(--bg); color: var(--text); }
    .wrap { max-width: 920px; margin: 0 auto; padding: 32px 20px 80px; }
    h1 { font-size: 1.5rem; margin: 0 0 8px; }
    .meta { color: var(--muted); font-size: 0.9rem; line-height: 1.5; margin-bottom: 28px; }
    .stats { display: flex; gap: 12px; flex-wrap: wrap; margin-bottom: 28px; }
    .stat { background: var(--card); border: 1px solid var(--line); border-radius: 12px; padding: 12px 16px; min-width: 120px; }
    .stat b { display: block; font-size: 1.4rem; }
    .stat span { color: var(--muted); font-size: 0.75rem; text-transform: uppercase; letter-spacing: 0.04em; }
    .step { background: var(--card); border: 1px solid var(--line); border-radius: 16px; padding: 16px; margin-bottom: 20px; }
    .step header { display: flex; gap: 12px; align-items: baseline; margin-bottom: 8px; }
    .step .idx { font-variant-numeric: tabular-nums; color: var(--muted); font-size: 0.85rem; }
    .step h2 { font-size: 1.05rem; margin: 0; flex: 1; }
    .badge { font-size: 0.7rem; font-weight: 600; text-transform: uppercase; padding: 2px 8px; border-radius: 999px; }
    .badge.ok { background: color-mix(in oklab, var(--ok) 20%, transparent); color: var(--ok); }
    .badge.bad { background: color-mix(in oklab, var(--bad) 20%, transparent); color: var(--bad); }
    .detail { color: var(--muted); font-size: 0.85rem; margin: 0 0 12px; }
    .path { font-family: ui-monospace, SFMono-Regular, Menlo, monospace; font-size: 0.75rem; color: var(--muted); margin-bottom: 12px; word-break: break-all; }
    img { width: 100%; max-width: 390px; border-radius: 12px; border: 1px solid var(--line); display: block; background: #000; }
    .toc { margin-bottom: 32px; }
    .toc a { color: inherit; text-decoration: none; display: block; padding: 6px 0; border-bottom: 1px solid var(--line); font-size: 0.9rem; }
    .toc a:hover { color: var(--ok); }
  </style>
</head>
<body>
  <div class="wrap">
    <h1>GymApp — full user journey</h1>
    <p class="meta">
      Automated Playwright walkthrough covering registration, onboarding, every primary screen,
      and key actions. Generated ${new Date().toISOString()}
      ${meta?.status ? `· test status: <strong>${escapeHtml(meta.status)}</strong>` : ""}.
    </p>
    <div class="stats">
      <div class="stat"><b>${steps.length}</b><span>Steps</span></div>
      <div class="stat"><b style="color:var(--ok)">${passed}</b><span>Shots OK</span></div>
      <div class="stat"><b style="color:var(--bad)">${failed}</b><span>Shot errors</span></div>
    </div>
    <nav class="toc">
      ${steps.map((s) => `<a href="#step-${s.index}">${String(s.index).padStart(2, "0")}. ${escapeHtml(s.title)}</a>`).join("")}
    </nav>
    ${steps
      .map(
        (s) => `
    <article class="step" id="step-${s.index}">
      <header>
        <span class="idx">${String(s.index).padStart(2, "0")}</span>
        <h2>${escapeHtml(s.title)}</h2>
        <span class="badge ${s.ok ? "ok" : "bad"}">${s.ok ? "ok" : "error"}</span>
      </header>
      ${s.detail ? `<p class="detail">${escapeHtml(s.detail)}</p>` : ""}
      <p class="path">${escapeHtml(s.path)}</p>
      ${s.ok ? `<img src="${s.screenshot}" alt="${escapeHtml(s.title)}" />` : `<p class="detail">${escapeHtml(s.error ?? "screenshot failed")}</p>`}
    </article>`,
      )
      .join("\n")}
  </div>
</body>
</html>`
  fs.writeFileSync(path.join(OUT_DIR, "index.html"), html)
  return path.join(OUT_DIR, "index.html")
}

function escapeHtml(s: string) {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;")
}
