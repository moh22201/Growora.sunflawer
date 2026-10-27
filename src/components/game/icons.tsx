// Tiny inline pixel icons for crops/items (colors are game-art data, not theme colors).
import { getConfig } from "@/game/config";

const hex = (n: number) => "#" + n.toString(16).padStart(6, "0");

export function ItemIcon({ id, size = 28 }: { id: string; size?: number }) {
  const cfg = getConfig();
  const crop = cfg.crops.find((c) => c.id === id);
  const fish = cfg.fishing.fish.find((f) => f.id === id);
  let body: React.ReactNode;
  if (crop) {
    body = (
      <>
        <rect x="3" y="1" width="2" height="2" fill="#47a848" />
        <rect x="2" y="3" width="4" height="4" fill={hex(crop.color)} />
        <rect x="2" y="3" width="1" height="1" fill="#fff" />
      </>
    );
  } else if (fish) {
    body = (
      <>
        <rect x="1" y="3" width="5" height="2" fill={hex(fish.color)} />
        <rect x="2" y="2" width="3" height="4" fill={hex(fish.color)} />
        <rect x="6" y="2" width="1" height="4" fill={hex(fish.color)} />
        <rect x="2" y="3" width="1" height="1" fill="#222" />
      </>
    );
  } else if (id === "honey") {
    body = (
      <>
        <rect x="2" y="1" width="4" height="1" fill="#7a4a2a" />
        <rect x="1" y="2" width="6" height="5" fill="#f2c040" />
        <rect x="2" y="3" width="1" height="2" fill="#fff4b0" />
      </>
    );
  } else {
    body = (
      <>
        <rect x="3" y="1" width="2" height="1" fill="#fff4dc" />
        <rect x="2" y="2" width="4" height="4" fill="#fff4dc" />
        <rect x="3" y="6" width="2" height="1" fill="#e8d4b0" />
        <rect x="5" y="4" width="1" height="2" fill="#e8d4b0" />
      </>
    );
  }
  return (
    <svg viewBox="0 0 8 8" width={size} height={size} shapeRendering="crispEdges" className="shrink-0">
      {body}
    </svg>
  );
}

const AVATARS = ["#f2c94c", "#4fc0d8", "#e8384a", "#7ad35e"];
export function Avatar({ n, size = 36 }: { n: number; size?: number }) {
  const c = AVATARS[n % AVATARS.length];
  return (
    <svg viewBox="0 0 8 8" width={size} height={size} shapeRendering="crispEdges" className="shrink-0">
      <rect x="1" y="0" width="6" height="2" fill={c} />
      <rect x="0" y="1" width="8" height="1" fill={c} />
      <rect x="2" y="2" width="4" height="3" fill="#f5c89a" />
      <rect x="3" y="3" width="1" height="1" fill="#222" />
      <rect x="5" y="3" width="1" height="1" fill="#222" />
      <rect x="1" y="5" width="6" height="3" fill="#4a7ac8" />
      <rect x="2" y="5" width="1" height="2" fill="#2f5aa0" />
      <rect x="5" y="5" width="1" height="2" fill="#2f5aa0" />
    </svg>
  );
}
export const AVATAR_COUNT = AVATARS.length;
