import * as React from "react"
import { useTheme } from "next-themes"
import { getThemePreference, saveThemePreference } from "@/lib/api-client"
import { useSession } from "@/contexts/session-context"
import type { ThemeMode, ThemePalette, FontPairing } from "shared"

export type Palette = ThemePalette
export type FontPairingLocal = FontPairing

type AppearanceState = {
  palette: Palette
  setPalette: (p: Palette) => void
  radius: number
  setRadius: (r: number) => void
  fontPairing: FontPairingLocal
  setFontPairing: (f: FontPairingLocal) => void
  /** Instant local preview only — does not hit the network. */
  setModePreview: (mode: ThemeMode) => void
  mode: ThemeMode
  /** True when draft differs from last persisted / server snapshot. */
  dirty: boolean
  saving: boolean
  saveError: string | null
  /** Persist draft to D1 (AbortController cancels any prior in-flight save). */
  saveAppearance: () => Promise<boolean>
  hydratedFromServer: boolean
}

const AppearanceContext = React.createContext<AppearanceState | null>(null)

const STORAGE_KEY = "fitness-tracker:appearance"

type StoredAppearance = {
  palette: Palette
  radius: number
  fontPairing: FontPairingLocal
  mode?: ThemeMode
}

function readStored(): StoredAppearance | null {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) return null
    return JSON.parse(raw)
  } catch {
    return null
  }
}

function writeStored(data: StoredAppearance & { mode: ThemeMode }) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(data))
}

function applyPreview(palette: Palette, radius: number, fontPairing: FontPairingLocal) {
  const root = document.documentElement
  if (palette === "zinc") root.removeAttribute("data-palette")
  else root.setAttribute("data-palette", palette)
  root.style.setProperty("--radius", `${radius}rem`)
  if (fontPairing === "sans") root.removeAttribute("data-font-pairing")
  else root.setAttribute("data-font-pairing", fontPairing)
}

export function AppearanceProvider({ children }: { children: React.ReactNode }) {
  const stored = readStored()
  const { theme, setTheme } = useTheme()
  const { user, loading: sessionLoading } = useSession()
  const [palette, setPaletteState] = React.useState<Palette>(stored?.palette ?? "zinc")
  const [radius, setRadiusState] = React.useState<number>(stored?.radius ?? 0.625)
  const [fontPairing, setFontPairingState] = React.useState<FontPairingLocal>(stored?.fontPairing ?? "sans")
  const [hydratedFromServer, setHydratedFromServer] = React.useState(false)
  const [dirty, setDirty] = React.useState(false)
  const [saving, setSaving] = React.useState(false)
  const [saveError, setSaveError] = React.useState<string | null>(null)

  const committed = React.useRef<{
    palette: Palette
    radius: number
    fontPairing: FontPairingLocal
    mode: ThemeMode
  }>({
    palette: stored?.palette ?? "zinc",
    radius: stored?.radius ?? 0.625,
    fontPairing: stored?.fontPairing ?? "sans",
    mode: (stored?.mode as ThemeMode) ?? "system",
  })
  const saveAbort = React.useRef<AbortController | null>(null)

  // Instant CSS preview — never persists.
  React.useEffect(() => {
    applyPreview(palette, radius, fontPairing)
  }, [palette, radius, fontPairing])

  // Load from D1 once logged in; localStorage is paint cache only.
  React.useEffect(() => {
    if (sessionLoading) return
    if (!user) return
    let cancelled = false
    getThemePreference()
      .then(({ theme: t }) => {
        if (cancelled) return
        committed.current = {
          palette: t.themeId,
          radius: t.radius,
          fontPairing: t.fontPairing,
          mode: t.mode,
        }
        setPaletteState(t.themeId)
        setRadiusState(t.radius)
        setFontPairingState(t.fontPairing)
        setTheme(t.mode)
        writeStored({
          palette: t.themeId,
          radius: t.radius,
          fontPairing: t.fontPairing,
          mode: t.mode,
        })
        setDirty(false)
        setHydratedFromServer(true)
      })
      .catch(() => {
        setHydratedFromServer(false)
      })
    return () => {
      cancelled = true
    }
  }, [user, sessionLoading, setTheme])

  const markDirtyIfNeeded = React.useCallback(() => {
    const c = committed.current
    const mode = (theme as ThemeMode) ?? "system"
    setDirty(
      palette !== c.palette ||
        radius !== c.radius ||
        fontPairing !== c.fontPairing ||
        mode !== c.mode,
    )
  }, [palette, radius, fontPairing, theme])

  React.useEffect(() => {
    markDirtyIfNeeded()
  }, [markDirtyIfNeeded])

  const setPalette = React.useCallback((p: Palette) => {
    setPaletteState(p)
    // Preview only — localStorage updated on Save so a reload before Save restores committed.
  }, [])

  const setRadius = React.useCallback((r: number) => {
    setRadiusState(r)
  }, [])

  const setFontPairing = React.useCallback((f: FontPairingLocal) => {
    setFontPairingState(f)
  }, [])

  const setModePreview = React.useCallback(
    (mode: ThemeMode) => {
      setTheme(mode)
    },
    [setTheme],
  )

  const saveAppearance = React.useCallback(async () => {
    const mode = (theme as ThemeMode) ?? "system"
    const next = { palette, radius, fontPairing, mode }

    // Always update paint cache on explicit save (even if logged out — rare).
    writeStored(next)

    if (!user) {
      committed.current = next
      setDirty(false)
      return true
    }

    saveAbort.current?.abort()
    const ac = new AbortController()
    saveAbort.current = ac
    setSaving(true)
    setSaveError(null)

    try {
      await saveThemePreference(
        {
          themeId: next.palette,
          mode: next.mode,
          radius: next.radius,
          fontPairing: next.fontPairing,
        },
        { signal: ac.signal },
      )
      if (ac.signal.aborted) return false
      committed.current = next
      setDirty(false)
      setSaving(false)
      return true
    } catch (err) {
      if (ac.signal.aborted || (err instanceof DOMException && err.name === "AbortError")) {
        return false
      }
      setSaving(false)
      setSaveError(err instanceof Error ? err.message : "Couldn't save appearance")
      return false
    }
  }, [palette, radius, fontPairing, theme, user])

  const value = React.useMemo(
    () => ({
      palette,
      setPalette,
      radius,
      setRadius,
      fontPairing,
      setFontPairing,
      setModePreview,
      mode: ((theme as ThemeMode) ?? "system") as ThemeMode,
      dirty,
      saving,
      saveError,
      saveAppearance,
      hydratedFromServer,
    }),
    [
      palette,
      setPalette,
      radius,
      setRadius,
      fontPairing,
      setFontPairing,
      setModePreview,
      theme,
      dirty,
      saving,
      saveError,
      saveAppearance,
      hydratedFromServer,
    ],
  )

  return <AppearanceContext.Provider value={value}>{children}</AppearanceContext.Provider>
}

export function useAppearance() {
  const ctx = React.useContext(AppearanceContext)
  if (!ctx) throw new Error("useAppearance must be used within AppearanceProvider")
  return ctx
}
