// TODO: Sidepanel UI (Surface B)
import "./surface-b.css";
import { SidePanelLayout } from "./layout/SidePanelLayout";
import { SurfaceB } from "./features/surface-b";
import { OnboardingFlow } from "./features/onboarding/OnboardingFlow";
import { useSidepanelRuntime } from "./runtime/RuntimeContext";

export function App() {
  const { runtimeState } = useSidepanelRuntime();
  const { identityStatus } = runtimeState;

  if (identityStatus === 'loading') {
    return <div style={{ padding: '20px' }}>Loading Cognis...</div>;
  }

  if (identityStatus === 'error') {
    return <div style={{ padding: '20px', color: 'red' }}>System Error: Unable to fetch profile.</div>;
  }

  return (
    <SidePanelLayout>
      {identityStatus === 'onboarded' ? <SurfaceB /> : <OnboardingFlow />}
    </SidePanelLayout>
  );
}