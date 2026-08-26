import * as React from "react"
import { TopBar } from "@/components/nav/top-bar"
import { Card, CardContent } from "@/components/ui/card"
import { Label } from "@/components/ui/label"
import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import { CheckCircle2, Eye, EyeOff, Loader2, ShieldCheck } from "lucide-react"
import { useAiProvider } from "@/contexts/ai-provider-context"
import { AI_PROVIDERS } from "@/lib/stub-data"
import { saveAiConfig, testAiConfig } from "@/lib/api-client"
import type { AiProviderId } from "shared"
import { toast } from "sonner"

export function AiProviderSettings() {
  const { configured, setConfigured, provider, setProvider, refresh } = useAiProvider()
  const [apiKey, setApiKey] = React.useState("")
  const [showKey, setShowKey] = React.useState(false)
  const [endpoint, setEndpoint] = React.useState("")
  const [testStatus, setTestStatus] = React.useState<"idle" | "testing" | "ok" | "fail">("idle")

  const current = AI_PROVIDERS.find((p) => p.id === provider)!

  async function saveAndTest() {
    setTestStatus("testing")
    try {
      await saveAiConfig({
        provider,
        apiKey,
        endpointOverride: provider === "local" ? endpoint : "",
      })
      const result = await testAiConfig()
      if (result.ok) {
        setTestStatus("ok")
        setConfigured(true)
        await refresh()
        toast.success("Provider saved")
      } else {
        setTestStatus("fail")
        toast.error(result.reason ?? "Test failed")
      }
    } catch (err) {
      setTestStatus("fail")
      toast.error(err instanceof Error ? err.message : "Couldn't save provider")
    }
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
            in the app until you add one. Keys are encrypted server-side — never stored in the browser.
          </AlertDescription>
        </Alert>

        {configured && testStatus === "idle" && (
          <div className="flex items-center gap-2 rounded-lg bg-success/15 px-3 py-2 text-sm text-success">
            <CheckCircle2 className="size-4" />A provider is configured for this account. Re-enter your key
            below only if you need to change it.
          </div>
        )}

        <Card>
          <CardContent className="space-y-4">
            <div className="space-y-1.5">
              <Label>Provider</Label>
              <Select
                value={provider}
                onValueChange={(v) => setProvider(v as AiProviderId)}
                items={Object.fromEntries(AI_PROVIDERS.map((p) => [p.id, p.label]))}
              >
                <SelectTrigger className="h-11 w-full">
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
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="api-key">API key</Label>
              <div className="relative">
                <Input
                  id="api-key"
                  type={showKey ? "text" : "password"}
                  className="h-11 pr-10 text-base"
                  placeholder="Paste your provider key"
                  value={apiKey}
                  onChange={(e) => setApiKey(e.target.value)}
                />
                <button
                  type="button"
                  className="absolute top-1/2 right-2 -translate-y-1/2 p-1 text-muted-foreground"
                  onClick={() => setShowKey((s) => !s)}
                  aria-label={showKey ? "Hide key" : "Show key"}
                >
                  {showKey ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
                </button>
              </div>
              <p className="text-xs text-muted-foreground">Models: {current.models.join(", ")}</p>
            </div>

            {provider === "local" && (
              <div className="space-y-1.5">
                <Label htmlFor="endpoint">Endpoint</Label>
                <Input
                  id="endpoint"
                  className="h-11 text-base"
                  placeholder="http://localhost:11434"
                  value={endpoint}
                  onChange={(e) => setEndpoint(e.target.value)}
                />
              </div>
            )}

            <Button className="h-11 w-full" onClick={() => void saveAndTest()} disabled={testStatus === "testing" || !apiKey.trim()}>
              {testStatus === "testing" ? (
                <>
                  <Loader2 className="size-4 animate-spin" /> Saving…
                </>
              ) : (
                "Save & test connection"
              )}
            </Button>

            {testStatus === "ok" && (
              <p className="flex items-center gap-1.5 text-sm text-success">
                <CheckCircle2 className="size-4" /> Connection confirmed
              </p>
            )}
            {testStatus === "fail" && <p className="text-sm text-destructive">Couldn’t verify the key — try again.</p>}
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
