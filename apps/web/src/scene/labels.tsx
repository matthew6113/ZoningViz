import { Html } from "@react-three/drei";
import { createContext, useContext, type RefObject } from "react";

// drei's <Html> re-creates its React root when the canvas's event target
// changes, which can leave labels empty. Every label is pinned to one wrapper
// element (its `portal`) so the target never changes.
export const LabelLayer = createContext<RefObject<HTMLDivElement | null> | null>(null);

export function Label({
  position,
  className,
  children,
}: {
  position: [number, number, number];
  className: string;
  children: React.ReactNode;
}) {
  const portal = useContext(LabelLayer);
  return (
    <Html position={position} center className={className} zIndexRange={[10, 0]} portal={(portal ?? undefined) as RefObject<HTMLElement> | undefined}>
      {children}
    </Html>
  );
}
