import * as React from "react"
import { useAtom, useSetAtom } from "jotai"
import { useTheme } from "next-themes"
import { getThemePreference, saveThemePreference } from "@/lib/api-client"
import { useSession } from "@/hooks/use-session"
import type { ThemeMode } from "shared"
import {
  appearanceCommitted,
  appearanceDirtyAtom,
  appearanceFontPairingAtom,
  appearanceHydratedAtom,
  appearanceHydratedOnce,
  appearanceModeDraftAtom,
  appearanceModeTouched,
  appearancePaletteAtom,
  appearanceRadiusAtom,
  appearanceSaveErrorAtom,
  appearanceSavingAtom,
  applyAppearancePreview,
  writeStoredAppearance,
  type FontPairingLocal,
  type Palette,
} from "@/atoms/appearance"

export type { Palette, FontPairingLocal }

/**
 * Appearance draft (Jotai) + next-themes mode. Mount `<AppearanceBootstrap />` once
 * for CSS preview + D1 hydrate.
 */
export function useAppearance() {
  const { theme, setTheme } = useTheme()
  const { user } = useSession()
  const [palette, setPaletteState] = useAtom(appearancePaletteAtom)
  const [radius, setRadiusState] = useAtom(appearanceRadiusAtom)
  const [fontPairing, setFontPairingState] = useAtom(appearanceFontPairingAtom)
  const [modeDraft, setModeDraft] = useAtom(appearanceModeDraftAtom)
  const [dirty, setDirty] = useAtom(appearanceDirtyAtom)
  const [saving, setSaving] = useAtom(appearanceSavingAtom)
  const [saveError, setSaveError] = useAtom(appearanceSaveErrorAtom)
  const [hydratedFromServer] = useAtom(appearanceHydratedAtom)
  const saveAbort = React.useRef<AbortController | null>(null)

  const effectiveMode: ThemeMode = modeDraft ?? ((theme as ThemeMode | undefined) ?? "system")

  React.useEffect(() => {
    const c = appearanceCommitted.current
    setDirty(
      palette !== c.palette ||
        radius !== c.radius ||
        fontPairing !== c.fontPairing ||
        effectiveMode !== c.mode,
    )
  }, [palette, radius, fontPairing, effectiveMode, setDirty])

  const setPalette = React.useCallback((p: Palette) => setPaletteState(p), [setPaletteState])
  const setRadius = React.useCallback((r: number) => setRadiusState(r), [setRadiusState])
  const setFontPairing = React.useCallback(
    (f: FontPairingLocal) => setFontPairingState(f),
    [setFontPairingState],
  )

  const setModePreview = React.useCallback(
    (mode: ThemeMode) => {
      appearanceModeTouched.current = true
      setModeDraft(mode)
      setTheme(mode)
      writeStoredAppearance({ palette, radius, fontPairing, mode })
      if (user) {
        void saveThemePreference({
          themeId: palette,
          mode,
          radius,
          fontPairing,
        })
          .then(() => {
            appearanceCommitted.current = {
              ...appearanceCommitted.current,
              mode,
              palette,
              radius,
              fontPairing,
            }
          })
          .catch(() => {
            /* Save bar still available for retry */
          })
      } else {
        appearanceCommitted.current = { ...appearanceCommitted.current, mode }
      }
    },
    [setTheme, palette, radius, fontPairing, user, setModeDraft],
  )

  const saveAppearance = React.useCallback(async () => {
    const mode = effectiveMode
    const next = { palette, radius, fontPairing, mode }

    writeStoredAppearance(next)

    if (!user) {
      appearanceCommitted.current = next
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
      appearanceCommitted.current = next
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
  }, [palette, radius, fontPairing, effectiveMode, user, setDirty, setSaving, setSaveError])

  return {
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
  }
}

/** Mount once under ModeProvider — CSS preview + server hydrate. */
export function AppearanceBootstrap() {
  const { setTheme } = useTheme()
  const { user, loading: sessionLoading } = useSession()
  const [palette] = useAtom(appearancePaletteAtom)
  const [radius] = useAtom(appearanceRadiusAtom)
  const [fontPairing] = useAtom(appearanceFontPairingAtom)
  const [modeDraft, setModeDraft] = useAtom(appearanceModeDraftAtom)
  const setPalette = useSetAtom(appearancePaletteAtom)
  const setRadius = useSetAtom(appearanceRadiusAtom)
  const setFontPairing = useSetAtom(appearanceFontPairingAtom)
  const setDirty = useSetAtom(appearanceDirtyAtom)
  const setHydrated = useSetAtom(appearanceHydratedAtom)

  // Apply cached mode before D1 hydrate so Light/Dark survive reloads.
  React.useEffect(() => {
    const stored = modeDraft
    if (stored) {
      setTheme(stored)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps -- cold start only
  }, [])

  React.useEffect(() => {
    applyAppearancePreview(palette, radius, fontPairing)
  }, [palette, radius, fontPairing])

  React.useEffect(() => {
    if (sessionLoading) return
    if (!user) return
    if (appearanceHydratedOnce.current) return
    let cancelled = false
    getThemePreference()
      .then(({ theme: t }) => {
        if (cancelled) return
        appearanceHydratedOnce.current = true
        appearanceCommitted.current = {
          palette: t.themeId,
          radius: t.radius,
          fontPairing: t.fontPairing,
          mode: t.mode,
        }
        setPalette(t.themeId)
        setRadius(t.radius)
        setFontPairing(t.fontPairing)
        if (!appearanceModeTouched.current) {
          setTheme(t.mode)
          setModeDraft(t.mode)
          writeStoredAppearance({
            palette: t.themeId,
            radius: t.radius,
            fontPairing: t.fontPairing,
            mode: t.mode,
          })
        } else {
          writeStoredAppearance({
            palette: t.themeId,
            radius: t.radius,
            fontPairing: t.fontPairing,
            mode: modeDraft ?? t.mode,
          })
        }
        setDirty(false)
        setHydrated(true)
      })
      .catch(() => {
        setHydrated(false)
      })
    return () => {
      cancelled = true
    }
  }, [
    user,
    sessionLoading,
    setTheme,
    modeDraft,
    setPalette,
    setRadius,
    setFontPairing,
    setModeDraft,
    setDirty,
    setHydrated,
  ])

  return null
}
