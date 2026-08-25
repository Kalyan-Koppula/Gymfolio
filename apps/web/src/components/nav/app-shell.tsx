import { BottomTabBar, TAB_BAR_CLEARANCE } from "@/components/nav/bottom-tab-bar"
import { PageTransition } from "@/components/nav/page-transition"

export function AppShell() {
  return (
    <div className="mx-auto flex min-h-svh max-w-2xl flex-col bg-background">
      <div className="flex-1" style={{ paddingBottom: TAB_BAR_CLEARANCE }}>
        <PageTransition />
      </div>
      <BottomTabBar />
    </div>
  )
}
