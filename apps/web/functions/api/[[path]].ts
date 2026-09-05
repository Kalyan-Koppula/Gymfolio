/**
 * Cloudflare Pages Function — proxies /api/* to the staging Worker so the browser
 * stays same-origin on *.pages.dev (cookies + WebAuthn). No purchased domain required.
 *
 * Set Pages project var GYMFOLIO_API_ORIGIN, e.g.:
 *   https://gymfolio-api-staging.<your-workers-subdomain>.workers.dev
 *
 * Deploy from apps/web:  wrangler pages deploy dist --project-name=gymfolio-web-staging
 */
type PagesEnv = {
  GYMFOLIO_API_ORIGIN: string
}

export const onRequest: PagesFunction<PagesEnv> = async (context) => {
  const origin = context.env.GYMFOLIO_API_ORIGIN?.replace(/\/$/, "")
  if (!origin) {
    return new Response(
      JSON.stringify({
        error: "GYMFOLIO_API_ORIGIN is not set on this Pages project",
        hint: "Dashboard → Workers & Pages → gymfolio-web-staging → Settings → Variables",
      }),
      { status: 503, headers: { "content-type": "application/json" } },
    )
  }

  const incoming = new URL(context.request.url)
  const target = new URL(incoming.pathname + incoming.search, origin)

  const headers = new Headers(context.request.headers)
  headers.delete("host")
  // Ensure the Worker sees the public Pages origin for absolute join links, etc.
  headers.set("x-forwarded-host", incoming.host)
  headers.set("x-forwarded-proto", "https")

  return fetch(target, {
    method: context.request.method,
    headers,
    body: context.request.body,
    redirect: "manual",
  })
}
