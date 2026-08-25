import { Routes, Route } from "react-router-dom"
import { AppShell } from "@/components/nav/app-shell"
import { SimulatorSheetRoot } from "@/components/simulator/simulator-sheet"

import { DesignIndex } from "@/screens/design-index"
import { Onboarding } from "@/screens/onboarding"
import { Login } from "@/screens/login"
import { Today } from "@/screens/today"
import { LogHub } from "@/screens/log-hub"
import { ExerciseLibrary } from "@/screens/train/exercise-library"
import { ExerciseDetail } from "@/screens/train/exercise-detail"
import { EquipmentProfile } from "@/screens/train/equipment-profile"
import { RoutineBuilder } from "@/screens/train/routine-builder"
import { RoutineWizard } from "@/screens/train/routine-wizard"
import { ActiveWorkout } from "@/screens/train/active-workout"
import { BodyMetricsTrend } from "@/screens/progress/body-metrics-trend"
import { AdherenceHistory } from "@/screens/progress/adherence-history"
import { SettingsHome } from "@/screens/settings/settings-home"
import { AiProviderSettings } from "@/screens/settings/ai-provider-settings"
import { AppearanceSettings } from "@/screens/settings/appearance-settings"
import { AccountSessions } from "@/screens/settings/account-sessions"

function App() {
  return (
    <>
      <SimulatorSheetRoot />
      <Routes>
        <Route path="/" element={<DesignIndex />} />
        <Route path="/onboarding" element={<Onboarding />} />
        <Route path="/login" element={<Login />} />

        <Route element={<AppShell />}>
          <Route path="/today" element={<Today />} />
          <Route path="/log" element={<LogHub />} />
          <Route path="/train" element={<ExerciseLibrary />} />
          <Route path="/train/library" element={<ExerciseLibrary />} />
          <Route path="/train/exercise/:id" element={<ExerciseDetail />} />
          <Route path="/train/equipment" element={<EquipmentProfile />} />
          <Route path="/train/routine" element={<RoutineBuilder />} />
          <Route path="/train/routine/new" element={<RoutineWizard />} />
          <Route path="/train/workout" element={<ActiveWorkout />} />
          <Route path="/progress" element={<BodyMetricsTrend />} />
          <Route path="/progress/metrics" element={<BodyMetricsTrend />} />
          <Route path="/progress/adherence" element={<AdherenceHistory />} />
          <Route path="/settings" element={<SettingsHome />} />
          <Route path="/settings/ai" element={<AiProviderSettings />} />
          <Route path="/settings/appearance" element={<AppearanceSettings />} />
          <Route path="/settings/account" element={<AccountSessions />} />
        </Route>
      </Routes>
    </>
  )
}

export default App
