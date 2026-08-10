// TODO: Sidepanel UI (Surface B)
import "./surface-b.css";
import { SidePanelLayout } from "./layout/SidePanelLayout";
import { SurfaceB } from "./features/surface-b";
import { OnboardingFlow } from "./features/onboarding/OnboardingFlow";

export function App() {
  return (
    <SidePanelLayout>
      <OnboardingFlow />
      <SurfaceB />
    </SidePanelLayout>
  );
}