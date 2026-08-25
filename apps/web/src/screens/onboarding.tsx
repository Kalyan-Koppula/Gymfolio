import * as React from "react"
import { useNavigate } from "react-router-dom"
import { AlertCircle, Camera, Check, Dumbbell, Loader2, Sparkles } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Progress } from "@/components/ui/progress"
import { Card, CardContent } from "@/components/ui/card"
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import { AiDegradedAlert } from "@/components/shared/ai-degraded-alert"
import { SimulatorTriggerButton } from "@/components/simulator/simulator-sheet"
import { useSimulator } from "@/contexts/simulator-provider"
import { EQUIPMENT_LABELS, type Equipment } from "@/lib/stub-data"
import { register, ApiError } from "@/lib/api-client"

const STEPS = ["Account", "Hydration goal", "Macro target", "Equipment"]
const ALL_EQUIPMENT = Object.keys(EQUIPMENT_LABELS) as Equipment[]

export function Onboarding() {
  const navigate = useNavigate()
  const { aiConfigured, online } = useSimulator()
  const [step, setStep] = React.useState(0)
  const [username, setUsername] = React.useState("")
  const [password, setPassword] = React.useState("")
  const [accountStatus, setAccountStatus] = React.useState<"idle" | "saving" | "error">("idle")
  const [accountError, setAccountError] = React.useState("")
  const [hydrationGoal, setHydrationGoal] = React.useState(3000)
  const [macroMode, setMacroMode] = React.useState<"computed" | "manual">("computed")
  const [bodyweight, setBodyweight] = React.useState(78)
  const [detectState, setDetectState] = React.useState<"idle" | "detecting" | "done">("idle")
  const [selectedEquipment, setSelectedEquipment] = React.useState<Set<Equipment>>(new Set())

  const proteinTarget = Math.round(bodyweight * 2.0)

  async function createAccount() {
    if (!online) {
      setAccountStatus("error")
      setAccountError("You're offline — check your connection and try again.")
      return
    }
    setAccountStatus("saving")
    try {
      await register({ username, password })
      setAccountStatus("idle")
      setStep(1)
    } catch (err) {
      setAccountStatus("error")
      setAccountError(err instanceof ApiError ? err.message : "Couldn't create your account — try again.")
    }
  }

  function next() {
    if (step === 0) {
      void createAccount()
      return
    }
    if (step === STEPS.length - 1) navigate("/today")
    else setStep((s) => s + 1)
  }

  function runDetection() {
    setDetectState("detecting")
    window.setTimeout(() => {
      setSelectedEquipment(new Set<Equipment>(["barbell", "dumbbell", "bench", "squat-rack"]))
      setDetectState("done")
    }, 1600)
  }

  function toggleEquipment(eq: Equipment) {
    setSelectedEquipment((prev) => {
      const next = new Set(prev)
      if (next.has(eq)) next.delete(eq)
      else next.add(eq)
      return next
    })
  }

  return (
    <div className="mx-auto flex min-h-svh max-w-md flex-col px-6 py-8" style={{ paddingTop: "var(--safe-top)" }}>
      <div className="mb-6 space-y-3">
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-2 text-sm font-medium text-muted-foreground">
            <Dumbbell className="size-4" />
            <span>
              Step {step + 1} of {STEPS.length} — {STEPS[step]}
            </span>
          </div>
          <SimulatorTriggerButton />
        </div>
        <Progress value={((step + 1) / STEPS.length) * 100} />
      </div>

      <div key={step} className="flex-1 space-y-5 animate-in fade-in slide-in-from-right-3 duration-200 ease-out">
        {step === 0 && (
          <div className="space-y-4">
            <h1 className="font-heading text-xl font-semibold">Create your account</h1>
            <p className="text-sm text-muted-foreground">
              Single user, self-hosted — no email verification, no social login.
            </p>
            {accountStatus === "error" && (
              <Alert variant="destructive">
                <AlertCircle className="size-4" />
                <AlertTitle>Couldn't create your account</AlertTitle>
                <AlertDescription>{accountError}</AlertDescription>
              </Alert>
            )}
            <div className="space-y-1.5">
              <Label htmlFor="ob-username">Username</Label>
              <Input
                id="ob-username"
                className="h-11 text-base"
                placeholder="kalyan"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="ob-password">Password</Label>
              <Input
                id="ob-password"
                type="password"
                className="h-11 text-base"
                placeholder="At least 12 characters"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
              />
            </div>
          </div>
        )}

        {step === 1 && (
          <div className="space-y-4">
            <h1 className="font-heading text-xl font-semibold">Set a daily hydration goal</h1>
            <p className="text-sm text-muted-foreground">You can change this anytime in Log → Hydration.</p>
            <div className="grid grid-cols-3 gap-2">
              {[2000, 2500, 3000, 3500, 4000].map((ml) => (
                <button
                  key={ml}
                  onClick={() => setHydrationGoal(ml)}
                  className="h-11 rounded-lg border text-sm font-medium transition-all duration-150 active:scale-95"
                  style={{
                    borderColor: hydrationGoal === ml ? "var(--primary)" : "var(--border)",
                    backgroundColor: hydrationGoal === ml ? "var(--primary)" : "transparent",
                    color: hydrationGoal === ml ? "var(--primary-foreground)" : "var(--foreground)",
                  }}
                >
                  {(ml / 1000).toFixed(1)} L
                </button>
              ))}
              <Input
                type="number"
                value={hydrationGoal}
                onChange={(e) => setHydrationGoal(Number(e.target.value))}
                className="h-11 text-center text-base"
              />
            </div>
          </div>
        )}

        {step === 2 && (
          <div className="space-y-4">
            <h1 className="font-heading text-xl font-semibold">Set a daily protein/macro target</h1>
            <div className="flex gap-2">
              <Button
                variant={macroMode === "computed" ? "default" : "outline"}
                size="sm"
                className="h-9 flex-1"
                onClick={() => setMacroMode("computed")}
              >
                Compute from bodyweight
              </Button>
              <Button
                variant={macroMode === "manual" ? "default" : "outline"}
                size="sm"
                className="h-9 flex-1"
                onClick={() => setMacroMode("manual")}
              >
                Set manually
              </Button>
            </div>
            {macroMode === "computed" ? (
              <div className="space-y-3">
                <div className="space-y-1.5">
                  <Label htmlFor="bw">Bodyweight (kg)</Label>
                  <Input
                    id="bw"
                    type="number"
                    value={bodyweight}
                    onChange={(e) => setBodyweight(Number(e.target.value))}
                    className="h-11 text-base"
                  />
                </div>
                <Card className="bg-muted/40 py-3">
                  <CardContent className="text-sm">
                    Protein target at 2.0 g/kg: <span className="font-semibold">{proteinTarget}g/day</span>
                  </CardContent>
                </Card>
              </div>
            ) : (
              <div className="grid grid-cols-2 gap-3">
                {["Calories", "Protein (g)", "Carbs (g)", "Fat (g)"].map((label) => (
                  <div key={label} className="space-y-1.5">
                    <Label className="text-xs">{label}</Label>
                    <Input type="number" className="h-11 text-base" placeholder="0" />
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {step === 3 && (
          <div className="space-y-4">
            <h1 className="font-heading text-xl font-semibold">What equipment do you have?</h1>
            <p className="text-sm text-muted-foreground">
              This filters the exercise library and routine builder to what you can actually use.
            </p>

            {!aiConfigured && (
              <AiDegradedAlert reason="no_key" />
            )}

            {aiConfigured && detectState !== "done" && (
              <Card className="border-dashed py-6">
                <CardContent className="flex flex-col items-center gap-3 text-center">
                  {detectState === "detecting" ? (
                    <>
                      <Loader2 className="size-6 animate-spin text-primary" />
                      <p className="text-sm font-medium">Analyzing your photo…</p>
                      <p className="text-xs text-muted-foreground">Detecting equipment against a fixed taxonomy</p>
                    </>
                  ) : (
                    <>
                      <div className="flex size-12 items-center justify-center rounded-full bg-primary/10">
                        <Camera className="size-6 text-primary" />
                      </div>
                      <p className="text-sm font-medium">Upload a photo of your gym/home setup</p>
                      <Button onClick={runDetection} className="h-11 px-5 text-base">
                        <Camera className="size-4" /> Take or upload photo
                      </Button>
                    </>
                  )}
                </CardContent>
              </Card>
            )}

            {detectState === "done" && (
              <div className="flex items-center gap-2 rounded-lg bg-success/15 px-3 py-2 text-sm text-success">
                <Sparkles className="size-4" />
                Detected 4 items — review and adjust below.
              </div>
            )}

            <div>
              <p className="mb-2 text-xs font-medium tracking-wide text-muted-foreground uppercase">
                {aiConfigured ? "Confirm or adjust" : "Select manually"}
              </p>
              <div className="flex flex-wrap gap-2">
                {ALL_EQUIPMENT.map((eq) => {
                  const active = selectedEquipment.has(eq)
                  return (
                    <button
                      key={eq}
                      onClick={() => toggleEquipment(eq)}
                      className="flex h-9 items-center gap-1.5 rounded-full border px-3 text-sm font-medium transition-all duration-150 active:scale-95"
                      style={{
                        borderColor: active ? "var(--primary)" : "var(--border)",
                        backgroundColor: active ? "var(--primary)" : "transparent",
                        color: active ? "var(--primary-foreground)" : "var(--foreground)",
                      }}
                    >
                      {active && <Check className="size-3.5" />}
                      {EQUIPMENT_LABELS[eq]}
                    </button>
                  )
                })}
              </div>
            </div>
          </div>
        )}
      </div>

      <div className="mt-8 flex gap-3">
        {step > 0 && (
          <Button variant="ghost" className="h-11" onClick={() => setStep((s) => s - 1)}>
            Back
          </Button>
        )}
        <Button className="h-11 flex-1 text-base" onClick={next} disabled={accountStatus === "saving"}>
          {accountStatus === "saving" ? (
            <>
              <Loader2 className="size-4 animate-spin" /> Creating account…
            </>
          ) : step === STEPS.length - 1 ? (
            "Finish setup"
          ) : (
            "Continue"
          )}
        </Button>
      </div>
      {step === STEPS.length - 1 && (
        <button onClick={() => navigate("/today")} className="mt-3 text-center text-xs text-muted-foreground underline">
          Skip for now — I'll set this up later
        </button>
      )}
    </div>
  )
}
