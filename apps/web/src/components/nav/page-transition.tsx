import { useLocation, useOutlet } from "react-router-dom"

/**
 * A light fade on every route change — keyed by pathname so the animation class replays
 * each navigation instead of only firing on first mount. Opacity-only, deliberately no
 * transform/slide: any `transform` here would create a new CSS containing block for every
 * `position: fixed` descendant (e.g. StickyActionBar), hijacking it away from the viewport
 * for the animation's duration — that's what caused fixed bottom bars to render mid-screen
 * on load before snapping into place. The global prefers-reduced-motion rule in index.css
 * collapses this to an instant cut when the user has that preference set.
 */
export function PageTransition() {
  const location = useLocation()
  const outlet = useOutlet()

  return (
    <div key={location.pathname} className="animate-in fade-in duration-300 ease-out">
      {outlet}
    </div>
  )
}
