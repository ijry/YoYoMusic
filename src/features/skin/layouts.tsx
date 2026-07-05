import type { PlayerLayoutProps } from "./layoutTypes";

function LayoutShell({ className }: { className: string }) {
  return <main className={`app-shell skin-layout ${className}`} />;
}

export function ClassicBlueSilverLayout(_props: PlayerLayoutProps) {
  return <LayoutShell className="skin-layout--classic-blue-silver" />;
}

export function DarkVinylLayout(_props: PlayerLayoutProps) {
  return <LayoutShell className="skin-layout--dark-vinyl" />;
}

export function TransparentCrystalLayout(_props: PlayerLayoutProps) {
  return <LayoutShell className="skin-layout--transparent-crystal" />;
}

export function MetalRackLayout(_props: PlayerLayoutProps) {
  return <LayoutShell className="skin-layout--metal-rack" />;
}

export function WarmWoodLayout(_props: PlayerLayoutProps) {
  return <LayoutShell className="skin-layout--warm-wood" />;
}
