import type { CapacitorConfig } from "@capacitor/cli"

/**
 * Capacitor shell for Play + OS agents (AppFunctions → WebMCP).
 * Loads the hosted PWA by default so session cookies match staging/prod.
 * For local device testing, set CAP_SERVER_URL=http://<lan-ip>:5173
 */
const serverUrl = process.env.CAP_SERVER_URL

const config: CapacitorConfig = {
  appId: "app.gymfolio.android",
  appName: "Gymfolio",
  webDir: "www",
  server: serverUrl
    ? { url: serverUrl, cleartext: serverUrl.startsWith("http://") }
    : {
        // Point at staging until prod cutover; override with CAP_SERVER_URL.
        url: "https://gymfolio-web-staging.pages.dev",
        cleartext: false,
      },
  android: {
    allowMixedContent: Boolean(serverUrl?.startsWith("http://")),
  },
}

export default config
