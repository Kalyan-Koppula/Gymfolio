import * as React from "react"
import { TopBar } from "@/components/nav/top-bar"
import { Card, CardContent } from "@/components/ui/card"
import { Label } from "@/components/ui/label"
import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import { CheckCircle2, Eye, EyeOff, ExternalLink, Loader2, ShieldAlert, ShieldCheck } from "lucide-react"
import { useAiProvider } from "@/hooks/use-ai-provider"
import { AI_PROVIDERS } from "@/lib/stub-data"
import { saveAiConfig, testAiConfig } from "@/lib/api-client"
import { DEFAULT_OPENROUTER_MODEL, type AiProviderId } from "shared"
import { toast } from "sonner"

const OPENROUTER_PRIVACY_URL = "https://openrouter.ai/docs/guides/privacy"

function isFreeModelSlug(slug: string): boolean {
  const s = slug.trim().toLowerCase()
  return s === DEFAULT_OPENROUTER_MODEL || s.includes(":free") || s.endsWith("/free")
}

export function AiProviderSettings() {
  const {
    configured,
    setConfigured,
    provider,
    setProvider,
    modelSlug,
    setModelSlug,
    endpointOverride,
    setEndpointOverride,
    refresh,
  } = useAiProvider()
  const [apiKey, setApiKey] = React.useState("")
  const [showKey, setShowKey] = React.useState(false)
  const [testStatus, setTestStatus] = React.useState<"idle" | "testing" | "ok" | "fail">("idle")

  const current = AI_PROVIDERS.find((p) => p.id === provider) ?? AI_PROVIDERS[0]!
  const showPrivacyNote = provider === "openrouter" && isFreeModelSlug(modelSlug)

  async function saveAndTest() {
    setTestStatus("testing")
    try {
      await saveAiConfig({
        provider,
        apiKey,
        modelSlug: modelSlug.trim() || DEFAULT_OPENROUTER_MODEL,
        endpointOverride: provider === "local" ? endpointOverride : "",
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
                onValueChange={(v) => {
                  const next = v as AiProviderId
                  setProvider(next)
                  if (next === "openrouter" && !modelSlug.trim()) {
                    setModelSlug(DEFAULT_OPENROUTER_MODEL)
                  }
                }}
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
              <Label htmlFor="model-slug">Model</Label>
              <Input
                id="model-slug"
                className="h-11 text-base"
                placeholder={provider === "openrouter" ? DEFAULT_OPENROUTER_MODEL : "llama3.3"}
                value={modelSlug}
                onChange={(e) => setModelSlug(e.target.value)}
              />
              <p className="text-xs text-muted-foreground">
                {provider === "openrouter"
                  ? `Default ${DEFAULT_OPENROUTER_MODEL} auto-routes to a free model. Pinned :free slugs can disappear without warning.`
                  : `Examples: ${current.models.join(", ")}`}
              </p>
            </div>

            {showPrivacyNote && (
              <Alert variant="destructive">
                <ShieldAlert className="size-4" />
                <AlertTitle>Before enabling free models</AlertTitle>
                <AlertDescription>
                  Free models may be logged or retained for training by their underlying providers.{" "}
                  <a
                    href={OPENROUTER_PRIVACY_URL}
                    target="_blank"
                    rel="noreferrer"
                    className="inline-flex items-center gap-1 font-medium underline underline-offset-2"
                  >
                    OpenRouter privacy docs
                    <ExternalLink className="size-3.5" />
                  </a>
                </AlertDescription>
              </Alert>
            )}

            <div className="space-y-1.5">
              <Label htmlFor="api-key">API key</Label>
              <div className="relative">
                <Input
                  id="api-key"
                  type={showKey ? "text" : "password"}
                  className="h-11 pr-10 text-base"
                  placeholder={
                    provider === "openrouter" ? "Paste your OpenRouter key" : "Paste your API key"
                  }
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
            </div>

            {provider === "local" && (
              <div className="space-y-1.5">
                <Label htmlFor="endpoint">Endpoint</Label>
                <Input
                  id="endpoint"
                  className="h-11 text-base"
                  placeholder="http://localhost:11434/v1"
                  value={endpointOverride}
                  onChange={(e) => setEndpointOverride(e.target.value)}
                />
              </div>
            )}

            <Button
              className="h-11 w-full"
              onClick={() => void saveAndTest()}
              disabled={testStatus === "testing" || !apiKey.trim()}
            >
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
            {testStatus === "fail" && (
              <p className="text-sm text-destructive">Couldn’t verify the key — try again.</p>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
