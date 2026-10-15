# WebMCP (browser + OS AI agents)

Gymfolio exposes structured tools via the experimental
[WebMCP](https://developer.chrome.com/docs/ai/webmcp) API. Tools run in page JS
and reuse the existing session cookie (`credentials: "include"`).

**No server MCP** — agents need the app open (desktop tab, installed PWA, or the
Android Capacitor shell with a live WebView).

## Local testing (no Chrome WebMCP flag required)

1. Start API + web from the repo root:

```bash
pnpm --filter api dev
pnpm --filter web dev
```

2. Sign in at `http://localhost:5173`.

3. Open **Settings → AI agents**. Keep **Allow AI agents** on.

4. Tap **Invoke get_today_overview**, or in DevTools:

```js
await __GYMFOLIO_WEBMCP__.tools
await __GYMFOLIO_WEBMCP__.invoke("get_today_overview", {})
await __GYMFOLIO_WEBMCP__.invoke("log_hydration", { amountMl: 250 })
await __GYMFOLIO_WEBMCP__.invoke("get_session", {})
```

The shim is mounted whenever you are inside the authenticated app shell.

### Chrome WebMCP API (optional)

When `document.modelContext.registerTool` exists (Chrome origin trial / flag), the
same catalog is also registered with the browser for agentic extensions.

## Session / gates

| State | Tool result |
| --- | --- |
| Signed out | `{ ok: false, error: "not_authenticated" }` |
| App lock showing | `{ ok: false, error: "app_locked" }` |
| Offline | `{ ok: false, error: "offline" }` |
| Toggle off | Tools unregistered / `{ error: "disabled" }` |

## Tool catalog (v1)

**Read:** `get_session`, `get_today_overview`, `get_in_progress_workout`,
`get_hydration`, `get_macros`, `get_sleep`, `get_body_metrics`, `get_routine`,
`search_exercises`, `get_last_performance`

**Write:** `log_hydration`, `log_macros`, `log_sleep`, `log_body_metric`,
`start_workout`, `log_set`, `finish_workout`, `skip_workout`

## Android OS agents (AppFunctions)

Desktop WebMCP only reaches in-browser agents. For **system / Gemini AppFunctions**,
use the Capacitor Android shell — it keeps a WebView so native code can call
`gymfolioNativeInvoke` → `__GYMFOLIO_WEBMCP__.invoke`.

See [`apps/android/README.md`](../apps/android/README.md).

Requires **Android 16 (API 36)+**. A TWA cannot expose WebMCP to OS agents (no
access to page JS).
