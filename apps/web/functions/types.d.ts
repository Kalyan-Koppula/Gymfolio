/**
 * Ambient types for Cloudflare Pages Functions (deploy-time only; not part of Vite build).
 * Avoids pulling @cloudflare/workers-types into the web app dependency tree.
 */
interface PagesFunction<Env = unknown> {
  (context: {
    request: Request
    env: Env
    params: Record<string, string | string[]>
    waitUntil: (promise: Promise<unknown>) => void
    next: (input?: Request | string, init?: RequestInit) => Promise<Response>
    data: Record<string, unknown>
  }): Response | Promise<Response>
}
