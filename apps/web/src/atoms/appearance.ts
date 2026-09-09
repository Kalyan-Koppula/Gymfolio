import { atom } from "jotai"
import type { ThemeMode, ThemePalette, FontPairing } from "shared"

export type Palette = ThemePalette
export type FontPairingLocal = FontPairing

export const STORAGE_KEY = "gymfolio:appearance"

export type StoredAppearance = {
  palette: Palette
  radius: number
  fontPairing: FontPairingLocal
  mode?: ThemeMode
}

export function readStoredAppearance(): StoredAppearance | null {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) return null
    return JSON.parse(raw) as StoredAppearance
  } catch {
    return null
  }
}

export function writeStoredAppearance(data: StoredAppearance & { mode: ThemeMode }) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(data))
}

const stored = typeof window !== "undefined" ? readStoredAppearance() : null

export const appearancePaletteAtom = atom<Palette>(stored?.palette ?? "zinc")
export const appearanceRadiusAtom = atom(stored?.radius ?? 0.625)
export const appearanceFontPairingAtom = atom<FontPairingLocal>(stored?.fontPairing ?? "sans")
export const appearanceModeDraftAtom = atom<ThemeMode | null>(stored?.mode ?? null)
export const appearanceDirtyAtom = atom(false)
export const appearanceSavingAtom = atom(false)
export const appearanceSaveErrorAtom = atom<string | null>(null)
export const appearanceHydratedAtom = atom(false)

/** Last persisted snapshot — module ref so hydrate/save don't fight React. */
export const appearanceCommitted = {
  current: {
    palette: (stored?.palette ?? "zinc") as Palette,
    radius: stored?.radius ?? 0.625,
    fontPairing: (stored?.fontPairing ?? "sans") as FontPairingLocal,
    mode: (stored?.mode as ThemeMode | undefined) ?? ("system" as ThemeMode),
  },
}

export const appearanceModeTouched = {
  current: Boolean(stored?.mode && stored.mode !== "system"),
}

export const appearanceHydratedOnce = { current: false }

export function applyAppearancePreview(
  palette: Palette,
  radius: number,
  fontPairing: FontPairingLocal,
) {
  const root = document.documentElement
  if (palette === "zinc") root.removeAttribute("data-palette")
  else root.setAttribute("data-palette", palette)
  root.style.setProperty("--radius", `${radius}rem`)
  if (fontPairing === "sans") root.removeAttribute("data-font-pairing")
  else root.setAttribute("data-font-pairing", fontPairing)
}
