// TODO: Sidepanel UI (Surface B)
import "./surface-b.css";
import { SidePanelLayout } from "./layout/SidePanelLayout";
import { SurfaceB } from "./features/surface-b";

export function App() {
  return (
    <SidePanelLayout>
      <SurfaceB />
    </SidePanelLayout>
  );
}