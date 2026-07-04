// TODO: Sidepanel UI (Surface B)

import { SidePanelLayout } from "./layout/SidePanelLayout";
import { SurfaceB } from "./features/surface-b";

export function App() {
  console.log("App rendered");
  return (
    <SidePanelLayout>
      <SurfaceB />
    </SidePanelLayout>
  );
}