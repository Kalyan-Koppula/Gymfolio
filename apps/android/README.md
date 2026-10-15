# Gymfolio Android (Capacitor + AppFunctions → WebMCP)

Play Store shell that embeds the Gymfolio web app in a **WebView** (Capacitor), then
exposes the same in-page WebMCP tool catalog to **OS-level AI agents** via Jetpack
[AppFunctions](https://developer.android.com/ai/appfunctions) (Android 16+ / API 36).

Trusted Web Activity cannot reach page JS, so agents cannot call WebMCP from a TWA.
This project replaces the old `apps/android-twa` Bubblewrap path.

## Architecture

```
OS agent (Gemini / AppFunctions)
        │
        ▼
GymfolioAppFunctionService  (@AppFunctionDeclaration)
        │
        ▼
WebMcpBridge  (bring up MainActivity + wait for registry)
        │
        ▼
WebView  →  gymfolioNativeInvoke(name, argsJson)
        │
        ▼
window.__GYMFOLIO_WEBMCP__.invoke  (same tools as desktop WebMCP)
```

## Prerequisites

- JDK 17+
- Android SDK (compileSdk / targetSdk **36**)
- Device or emulator on **Android 16+** for AppFunctions
- Node 20+ / pnpm (monorepo)

## First-time setup

```bash
# from repo root
pnpm install
# android/ is checked in (Capacitor + AppFunctions). After regenerating:
#   pnpm --filter android exec npx cap add android
#   pnpm --filter android merge-native
pnpm --filter android sync
pnpm --filter android open
```

Authoritative Kotlin / manifest overlays live in [`android-src/`](./android-src/).
`pnpm --filter android merge-native` copies them into `android/` and wires the
AppFunction service into the Capacitor manifest. Gradle SDK 36 + AppFunctions deps
are already applied under `android/`.

### Server URL

Default loads staging (`https://gymfolio-web-staging.pages.dev`). For LAN/dev:

```bash
CAP_SERVER_URL=http://192.168.1.10:5173 pnpm --filter android sync
```

## AppFunctions (OS agents)

- Package: `app.gymfolio.android`
- Service entry: `app.gymfolio.android.appfunctions.GymfolioAppFunctionService`
- Tools bridge into WebMCP names (`get_today_overview`, `log_hydration`, …) plus generic `invokeWebMcpTool`.

Verify on a API 36 device:

```bash
adb shell cmd app_function list-app-functions
adb shell "cmd app_function execute-app-function \
  --package app.gymfolio.android \
  --function 'app.gymfolio.android.appfunctions.GymfolioAppFunctionService#getTodayOverview' \
  --parameters '{}'"
```

**Gemini / assistant discovery** may still be EAP-gated; AppFunctions + `adb` work without it.

Cold start: the first AppFunction call starts `MainActivity`, waits until WebMCP marks ready
(user must be signed in with **Settings → AI agents** enabled), then invokes JS.

## Digital Asset Links

Update [`../web/public/.well-known/assetlinks.json`](../web/public/.well-known/assetlinks.json)
with package `app.gymfolio.android` and your release SHA-256, then redeploy web.

## Browser-only WebMCP

You do **not** need this APK to test tools in Chrome — see [`docs/WEBMCP.md`](../../docs/WEBMCP.md).
