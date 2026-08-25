import * as React from "react"

export type Palette = "zinc" | "slate" | "red" | "orange" | "green" | "blue" | "rose" | "violet"
export type FontPairing = "sans" | "serif"

type AppearanceState = {
  palette: Palette
  setPalette: (p: Palette) => void
  radius: number
  setRadius: (r: number) => void
  fontPairing: FontPairing
  setFontPairing: (f: FontPairing) => void
}

const AppearanceContext = React.createContext<AppearanceState | null>(null)

const STORAGE_KEY = "prototype:appearance"

function readStored() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) return null
    return JSON.parse(raw) as { palette: Palette; radius: number; fontPairing: FontPairing }
  } catch {
    return null
  }
}

export function AppearanceProvider({ children }: { children: React.ReactNode }) {
  const stored = readStored()
  const [palette, setPalette] = React.useState<Palette>(stored?.palette ?? "zinc")
  const [radius, setRadius] = React.useState<number>(stored?.radius ?? 0.625)
  const [fontPairing, setFontPairing] = React.useState<FontPairing>(stored?.fontPairing ?? "sans")

  React.useEffect(() => {
    const root = document.documentElement
    if (palette === "zinc") root.removeAttribute("data-palette")
    else root.setAttribute("data-palette", palette)
  }, [palette])

  React.useEffect(() => {
    document.documentElement.style.setProperty("--radius", `${radius}rem`)
  }, [radius])

  React.useEffect(() => {
    const root = document.documentElement
    if (fontPairing === "sans") root.removeAttribute("data-font-pairing")
    else root.setAttribute("data-font-pairing", fontPairing)
  }, [fontPairing])

  React.useEffect(() => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify({ palette, radius, fontPairing }))
  }, [palette, radius, fontPairing])

  const value = React.useMemo(
    () => ({ palette, setPalette, radius, setRadius, fontPairing, setFontPairing }),
    [palette, radius, fontPairing],
  )

  return <AppearanceContext.Provider value={value}>{children}</AppearanceContext.Provider>
}

export function useAppearance() {
  const ctx = React.useContext(AppearanceContext)
  if (!ctx) throw new Error("useAppearance must be used within AppearanceProvider")
  return ctx
}
