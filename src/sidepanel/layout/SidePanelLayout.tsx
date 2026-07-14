import type { ReactNode } from "react";

type SidePanelLayoutProps = {
  children: ReactNode;
};

export function SidePanelLayout({
  children,
}: SidePanelLayoutProps) {
  return (
    <main>
      {children}
    </main>
  );
}