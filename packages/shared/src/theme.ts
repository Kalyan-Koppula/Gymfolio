import { z } from "zod"

export const ThemePaletteSchema = z.enum([
  "zinc",
  "slate",
  "red",
  "orange",
  "green",
  "blue",
  "rose",
  "violet",
])
export type ThemePalette = z.infer<typeof ThemePaletteSchema>

export const ThemeModeSchema = z.enum(["light", "dark", "system"])
export type ThemeMode = z.infer<typeof ThemeModeSchema>

export const FontPairingSchema = z.enum(["sans", "serif"])
export type FontPairing = z.infer<typeof FontPairingSchema>

export const ThemePreferenceSchema = z.object({
  themeId: ThemePaletteSchema,
  mode: ThemeModeSchema,
  radius: z.number().min(0).max(1.5),
  fontPairing: FontPairingSchema,
  updatedAt: z.number(),
})
export type ThemePreference = z.infer<typeof ThemePreferenceSchema>

export const UpsertThemePreferenceInputSchema = z.object({
  themeId: ThemePaletteSchema,
  mode: ThemeModeSchema,
  radius: z.number().min(0).max(1.5),
  fontPairing: FontPairingSchema,
})
export type UpsertThemePreferenceInput = z.infer<typeof UpsertThemePreferenceInputSchema>
