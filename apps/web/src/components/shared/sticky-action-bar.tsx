import * as React from "react"
import { createPortal } from "react-dom"
import { TAB_BAR_CLEARANCE } from "@/components/nav/bottom-tab-bar"
import { cn } from "@/lib/utils"

/**
 * §1.6 — primary actions belong in the thumb-zone bottom third. This sits just above
 * the persistent tab bar and never overlaps it (checked per §1.7).
 *
 * Portaled to document.body rather than rendered in place: any ancestor with an active
 * `transform` (a page-transition animation, a future swipe gesture, a blurred modal
 * backdrop) becomes a new containing block for `position: fixed` children, which silently
 * detaches this bar from the viewport and mispositions it. Portaling out of the route tree
 * makes that entire bug class structurally impossible here, the same way BottomTabBar is
 * safe today simply by being a sibling of the animated route wrapper, not a descendant.
 */
export function StickyActionBar({ children, className }: { children: React.ReactNode; className?: string }) {
  return createPortal(
    <div
      className={cn(
        "fixed inset-x-0 z-30 border-t border-border bg-background/95 px-4 py-3 backdrop-blur supports-[backdrop-filter]:bg-background/85",
        className,
      )}
      style={{ bottom: TAB_BAR_CLEARANCE }}
    >
      <div className="mx-auto max-w-2xl">{children}</div>
    </div>,
    document.body,
  )
}
