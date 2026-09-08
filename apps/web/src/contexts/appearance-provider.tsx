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
  /** Instant preview + persist mode (local + account when logged in). */
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

const STORAGE_KEY = "gymfolio:appearance"

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
  const [modeDraft, setModeDraft] = React.useState<ThemeMode | null>(stored?.mode ?? null)
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
  /** User tapped a mode this session — hydrate must not clobber it. */
  const modeTouched = React.useRef(Boolean(stored?.mode && stored.mode !== "system"))
  const hydratedOnce = React.useRef(false)

  const effectiveMode: ThemeMode =
    modeDraft ?? ((theme as ThemeMode | undefined) ?? "system")

  // Apply cached mode before D1 hydrate so Light/Dark survive reloads.
  React.useEffect(() => {
    if (stored?.mode) {
      setTheme(stored.mode)
      setModeDraft(stored.mode)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps -- cold start only
  }, [])

  // Instant CSS preview — never persists.
  React.useEffect(() => {
    applyPreview(palette, radius, fontPairing)
  }, [palette, radius, fontPairing])

  // Load from D1 once logged in; localStorage is paint cache only.
  React.useEffect(() => {
    if (sessionLoading) return
    if (!user) return
    if (hydratedOnce.current) return
    let cancelled = false
    getThemePreference()
      .then(({ theme: t }) => {
        if (cancelled) return
        hydratedOnce.current = true
        committed.current = {
          palette: t.themeId,
          radius: t.radius,
          fontPairing: t.fontPairing,
          mode: t.mode,
        }
        setPaletteState(t.themeId)
        setRadiusState(t.radius)
        setFontPairingState(t.fontPairing)
        // Don't overwrite a mode the user already chose (or cached locally).
        if (!modeTouched.current) {
          setTheme(t.mode)
          setModeDraft(t.mode)
          writeStored({
            palette: t.themeId,
            radius: t.radius,
            fontPairing: t.fontPairing,
            mode: t.mode,
          })
        } else {
          writeStored({
            palette: t.themeId,
            radius: t.radius,
            fontPairing: t.fontPairing,
            mode: modeDraft ?? t.mode,
          })
        }
        setDirty(false)
        setHydratedFromServer(true)
      })
      .catch(() => {
        setHydratedFromServer(false)
      })
    return () => {
      cancelled = true
    }
  }, [user, sessionLoading, setTheme, modeDraft])

  const markDirtyIfNeeded = React.useCallback(() => {
    const c = committed.current
    const mode = effectiveMode
    setDirty(
      palette !== c.palette ||
        radius !== c.radius ||
        fontPairing !== c.fontPairing ||
        mode !== c.mode,
    )
  }, [palette, radius, fontPairing, effectiveMode])

  React.useEffect(() => {
    markDirtyIfNeeded()
  }, [markDirtyIfNeeded])

  const setPalette = React.useCallback((p: Palette) => {
    setPaletteState(p)
  }, [])

  const setRadius = React.useCallback((r: number) => {
    setRadiusState(r)
  }, [])

  const setFontPairing = React.useCallback((f: FontPairingLocal) => {
    setFontPairingState(f)
  }, [])

  const setModePreview = React.useCallback(
    (mode: ThemeMode) => {
      modeTouched.current = true
      setModeDraft(mode)
      setTheme(mode)
      writeStored({ palette, radius, fontPairing, mode })
      // Persist mode to account immediately so hydrate / other devices don't snap back to system.
      if (user) {
        void saveThemePreference({
          themeId: palette,
          mode,
          radius,
          fontPairing,
        })
          .then(() => {
            committed.current = { ...committed.current, mode, palette, radius, fontPairing }
          })
          .catch(() => {
            /* Save bar still available for retry */
          })
      } else {
        committed.current = { ...committed.current, mode }
      }
    },
    [setTheme, palette, radius, fontPairing, user],
  )

  const saveAppearance = React.useCallback(async () => {
    const mode = effectiveMode
    const next = { palette, radius, fontPairing, mode }

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
  }, [palette, radius, fontPairing, effectiveMode, user])

  const value = React.useMemo(
    () => ({
      palette,
      setPalette,
      radius,
      setRadius,
      fontPairing,
      setFontPairing,
      setModePreview,
      mode: effectiveMode,
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
      effectiveMode,
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
