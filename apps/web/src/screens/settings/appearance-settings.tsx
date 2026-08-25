import { useTheme } from "next-themes"
import { TopBar } from "@/components/nav/top-bar"
import { Card, CardContent } from "@/components/ui/card"
import { Label } from "@/components/ui/label"
import { Slider } from "@/components/ui/slider"
import { Check, Laptop, Moon, Sun } from "lucide-react"
import { useAppearance, type Palette } from "@/contexts/appearance-provider"
import { cn } from "@/lib/utils"

const PALETTES: Array<{ id: Palette; label: string; swatch: string }> = [
  { id: "zinc", label: "Zinc", swatch: "oklch(0.205 0 0)" },
  { id: "slate", label: "Slate", swatch: "oklch(0.29 0.03 255)" },
  { id: "red", label: "Red", swatch: "oklch(0.55 0.2 25)" },
  { id: "orange", label: "Orange", swatch: "oklch(0.62 0.17 55)" },
  { id: "green", label: "Green", swatch: "oklch(0.5 0.14 150)" },
  { id: "blue", label: "Blue", swatch: "oklch(0.5 0.19 258)" },
  { id: "violet", label: "Violet", swatch: "oklch(0.5 0.22 293)" },
  { id: "rose", label: "Rose", swatch: "oklch(0.55 0.22 15)" },
]

export function AppearanceSettings() {
  const { theme, setTheme } = useTheme()
  const { palette, setPalette, radius, setRadius, fontPairing, setFontPairing } = useAppearance()

  return (
    <div>
      <TopBar title="Appearance" back />
      <div className="space-y-5 px-4 py-4">
        <p className="text-xs text-muted-foreground">
          Every control here applies instantly — no save/reload. This is the runtime surface of the
          shadcn CSS-variable theming system (architecture §5).
        </p>

        <Card>
          <CardContent className="space-y-3">
            <Label>Mode</Label>
            <div className="grid grid-cols-3 gap-2">
              {[
                { id: "light", label: "Light", icon: Sun },
                { id: "dark", label: "Dark", icon: Moon },
                { id: "system", label: "System", icon: Laptop },
              ].map((m) => (
                <button
                  key={m.id}
                  onClick={() => setTheme(m.id)}
                  className="flex h-16 flex-col items-center justify-center gap-1 rounded-lg border text-xs font-medium transition-all duration-150 active:scale-95"
                  style={{
                    borderColor: theme === m.id ? "var(--primary)" : "var(--border)",
                    backgroundColor: theme === m.id ? "var(--accent)" : "transparent",
                  }}
                >
                  <m.icon className={cn("size-4 transition-transform duration-200", theme === m.id && "scale-110")} />
                  {m.label}
                </button>
              ))}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="space-y-3">
            <div className="flex items-baseline justify-between">
              <Label>Color preset</Label>
              <span className="text-xs text-muted-foreground">{PALETTES.length} presets</span>
            </div>
            <div className="grid grid-cols-4 gap-2">
              {PALETTES.map((p) => (
                <button
                  key={p.id}
                  onClick={() => setPalette(p.id)}
                  aria-label={p.label}
                  aria-pressed={palette === p.id}
                  className="flex flex-col items-center gap-1.5 rounded-lg border p-2.5 transition-all duration-150 active:scale-95"
                  style={{ borderColor: palette === p.id ? "var(--primary)" : "var(--border)" }}
                >
                  <div className="relative flex size-7 items-center justify-center rounded-full ring-1 ring-black/5" style={{ backgroundColor: p.swatch }}>
                    {palette === p.id && <Check className="size-3.5 text-white animate-in zoom-in-50 duration-200 ease-out" />}
                  </div>
                  <span className="text-[11px] font-medium">{p.label}</span>
                </button>
              ))}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="space-y-3">
            <div className="flex items-center justify-between">
              <Label>Corner radius</Label>
              <span className="text-xs text-muted-foreground">{radius.toFixed(2)}rem</span>
            </div>
            <Slider
              value={[radius * 100]}
              onValueChange={(v) => setRadius((Array.isArray(v) ? v[0] : v) / 100)}
              min={0}
              max={100}
              step={5}
            />
            <div className="flex gap-2 pt-1 *:transition-[border-radius] *:duration-200 *:ease-out">
              <div className="flex h-10 flex-1 items-center justify-center rounded-lg border border-border bg-muted text-xs">
                Card
              </div>
              <div className="flex h-10 flex-1 items-center justify-center rounded-lg bg-primary text-xs text-primary-foreground">
                Button
              </div>
              <div className="h-10 flex-1 rounded-lg border border-border" />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="space-y-3">
            <Label>Font pairing</Label>
            <div className="grid grid-cols-2 gap-2">
              <button
                onClick={() => setFontPairing("sans")}
                className="rounded-lg border p-3 text-left transition-all duration-150 active:scale-95"
                style={{ borderColor: fontPairing === "sans" ? "var(--primary)" : "var(--border)" }}
              >
                <p className="font-heading text-lg" style={{ fontFamily: "'Geist Variable', sans-serif" }}>
                  Today's workout
                </p>
                <p className="mt-1 text-xs text-muted-foreground">Geist — sans only</p>
              </button>
              <button
                onClick={() => setFontPairing("serif")}
                className="rounded-lg border p-3 text-left transition-all duration-150 active:scale-95"
                style={{ borderColor: fontPairing === "serif" ? "var(--primary)" : "var(--border)" }}
              >
                <p className="text-lg" style={{ fontFamily: "'Fraunces Variable', ui-serif, serif" }}>
                  Today's workout
                </p>
                <p className="mt-1 text-xs text-muted-foreground">Fraunces heading + Geist body</p>
              </button>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
