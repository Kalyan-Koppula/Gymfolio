import * as React from "react"
import { TopBar } from "@/components/nav/top-bar"
import { Card, CardContent } from "@/components/ui/card"
import { Label } from "@/components/ui/label"
import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import { CheckCircle2, Eye, EyeOff, Loader2, ShieldAlert, ShieldCheck } from "lucide-react"
import { useSimulator } from "@/contexts/simulator-provider"
import { AI_PROVIDERS } from "@/lib/stub-data"

export function AiProviderSettings() {
  const { aiConfigured, setAiConfigured } = useSimulator()
  const [provider, setProvider] = React.useState<(typeof AI_PROVIDERS)[number]["id"]>("anthropic")
  const [apiKey, setApiKey] = React.useState(aiConfigured ? "sk-ant-••••••••••••••••7f2a" : "")
  const [showKey, setShowKey] = React.useState(false)
  const [endpoint, setEndpoint] = React.useState("")
  const [testStatus, setTestStatus] = React.useState<"idle" | "testing" | "ok" | "fail">("idle")

  const current = AI_PROVIDERS.find((p) => p.id === provider)!

  function test() {
    setTestStatus("testing")
    window.setTimeout(() => {
      const ok = apiKey.trim().length > 0
      setTestStatus(ok ? "ok" : "fail")
      setAiConfigured(ok)
    }, 1100)
  }

  return (
    <div>
      <TopBar title="AI provider" back />
      <div className="space-y-5 px-4 py-4">
        <Alert>
          <ShieldCheck className="size-4" />
          <AlertTitle>No key configured is a normal, supported state</AlertTitle>
          <AlertDescription>
            Equipment detection and AI routine generation fall back to their manual equivalents everywhere
            in the app until you add one (FR-9.4).
          </AlertDescription>
        </Alert>

        <Card>
          <CardContent className="space-y-4">
            <div className="space-y-1.5">
              <Label>Provider</Label>
              <Select
                value={provider}
                onValueChange={(v) => setProvider(v as typeof provider)}
                items={Object.fromEntries(AI_PROVIDERS.map((p) => [p.id, p.label]))}
              >
                <SelectTrigger className="h-11 w-full text-base">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {AI_PROVIDERS.map((p) => (
                    <SelectItem key={p.id} value={p.id}>
                      {p.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <p className="text-xs text-muted-foreground">Models: {current.models.join(", ")}</p>
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="api-key">API key</Label>
              <div className="relative">
                <Input
                  id="api-key"
                  type={showKey ? "text" : "password"}
                  value={apiKey}
                  onChange={(e) => {
                    setApiKey(e.target.value)
                    setTestStatus("idle")
                  }}
                  placeholder="Paste your provider key"
                  className="h-11 pr-11 text-base"
                />
                <button
                  type="button"
                  onClick={() => setShowKey((v) => !v)}
                  aria-label={showKey ? "Hide key" : "Show key"}
                  className="absolute inset-y-0 right-0 flex w-11 items-center justify-center text-muted-foreground hover:text-foreground"
                >
                  {showKey ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
                </button>
              </div>
              <p className="text-xs text-muted-foreground">Encrypted at rest, never logged (FR-9.2).</p>
            </div>

            {provider === "local" && (
              <div className="space-y-1.5">
                <Label htmlFor="endpoint">Endpoint override</Label>
                <Input
                  id="endpoint"
                  value={endpoint}
                  onChange={(e) => setEndpoint(e.target.value)}
                  placeholder="http://localhost:11434"
                  className="h-11 text-base"
                />
              </div>
            )}

            <Button variant="outline" className="h-11 w-full text-base" onClick={test} disabled={testStatus === "testing"}>
              {testStatus === "testing" ? (
                <>
                  <Loader2 className="size-4 animate-spin" /> Testing connection…
                </>
              ) : (
                "Test connection"
              )}
            </Button>

            {testStatus === "ok" && (
              <div className="flex items-center gap-2 rounded-lg bg-success/15 px-3 py-2 text-sm text-success animate-in fade-in zoom-in-95 duration-200 ease-out">
                <CheckCircle2 className="size-4 animate-in zoom-in-50 duration-300 ease-out" /> Connected —{" "}
                {current.label} is ready to use.
              </div>
            )}
            {testStatus === "fail" && (
              <div className="flex items-center gap-2 rounded-lg bg-destructive/10 px-3 py-2 text-sm text-destructive animate-in fade-in zoom-in-95 duration-200 ease-out">
                <ShieldAlert className="size-4" /> Couldn't connect — check the key and try again.
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
