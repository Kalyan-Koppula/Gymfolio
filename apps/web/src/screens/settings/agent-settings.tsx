import * as React from "react"
import { useAtom } from "jotai"
import { toast } from "sonner"
import { Bot, Loader2 } from "lucide-react"
import { TopBar } from "@/components/nav/top-bar"
import { Card, CardContent } from "@/components/ui/card"
import { Label } from "@/components/ui/label"
import { Switch } from "@/components/ui/switch"
import { Button } from "@/components/ui/button"
import { webMcpEnabledAtom } from "@/atoms/webmcp"
import { isWebMcpSupported } from "@/webmcp/feature-detect"

export function AgentSettingsScreen() {
  const [enabled, setEnabled] = useAtom(webMcpEnabledAtom)
  const [supported, setSupported] = React.useState(false)
  const [busy, setBusy] = React.useState(false)
  const [lastResult, setLastResult] = React.useState<string | null>(null)

  React.useEffect(() => {
    setSupported(isWebMcpSupported())
  }, [])

  async function runLocalTest() {
    setBusy(true)
    setLastResult(null)
    try {
      const api = window.__GYMFOLIO_WEBMCP__
      if (!api) {
        toast.error("WebMCP shim not mounted — open an authenticated screen first")
        return
      }
      const result = await api.invoke("get_today_overview", {})
      setLastResult(JSON.stringify(result, null, 2))
      toast.success("Local tool invoke OK")
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Invoke failed"
      setLastResult(msg)
      toast.error(msg)
    } finally {
      setBusy(false)
    }
  }

  return (
    <div>
      <TopBar title="AI agents" back />
      <div className="space-y-5 px-4 py-4 pb-10">
        <p className="text-xs text-muted-foreground">
          WebMCP lets browser AI agents — and the Android app&apos;s OS agents (AppFunctions) —
          call Gymfolio tools while this app is open. Uses your existing sign-in cookie — no
          separate agent password.
        </p>

        <Card>
          <CardContent className="flex items-center justify-between gap-3 py-4">
            <div className="min-w-0">
              <p className="text-sm font-medium flex items-center gap-1.5">
                <Bot className="size-4" /> Allow AI agents (WebMCP)
              </p>
              <p className="text-xs text-muted-foreground">
                {supported
                  ? "Browser WebMCP API detected"
                  : "Browser WebMCP API not detected — local DevTools shim still works"}
              </p>
            </div>
            <Switch
              checked={enabled}
              onCheckedChange={(v) => {
                setEnabled(v)
                toast.message(v ? "AI agents enabled" : "AI agents disabled")
              }}
              aria-label="Allow AI agents"
            />
          </CardContent>
        </Card>

        <Card>
          <CardContent className="space-y-3 py-4">
            <Label>Local test</Label>
            <p className="text-xs text-muted-foreground">
              Runs <code className="text-foreground">get_today_overview</code> via{" "}
              <code className="text-foreground">window.__GYMFOLIO_WEBMCP__</code> (no Chrome flag
              required).
            </p>
            <Button
              type="button"
              className="h-11 w-full"
              disabled={!enabled || busy}
              onClick={() => void runLocalTest()}
            >
              {busy ? <Loader2 className="size-4 animate-spin" /> : <Bot className="size-4" />}
              {busy ? "Running…" : "Invoke get_today_overview"}
            </Button>
            {lastResult ? (
              <pre className="max-h-64 overflow-auto rounded-lg bg-muted p-3 text-[11px] leading-relaxed">
                {lastResult}
              </pre>
            ) : null}
          </CardContent>
        </Card>

        <p className="text-xs text-muted-foreground">
          Console:{" "}
          <code className="text-foreground">
            await __GYMFOLIO_WEBMCP__.invoke(&quot;log_hydration&quot;, {"{"} amountMl: 250 {"}"})
          </code>
          . Android Play build: see apps/android (AppFunctions → same tools).
        </p>
      </div>
    </div>
  )
}
