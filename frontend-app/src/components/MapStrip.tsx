import { useState } from "react";
import type { StationOffer } from "../types";
import { MapView } from "./MapView";
import { BottomSheet } from "./BottomSheet";
import { Icon } from "./Icon";

type LatLng = [number, number];

/** Tier-2 map context (STYLE_GUIDE §7): a STATIC, non-interactive strip for
 *  orientation — not a pannable pin-browser. Tap to expand the full interactive
 *  map in a bottom sheet. Keeps the answer glanceable and safe to re-glance. */
export function MapStrip({
  offers,
  origin,
  destination,
  route,
}: {
  offers: StationOffer[];
  origin: LatLng | null;
  destination: LatLng | null;
  route: LatLng[];
}) {
  const [open, setOpen] = useState(false);

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        aria-label="See on map"
        className="group relative block w-full overflow-hidden"
      >
        {/* pointer-events are disabled inside MapView when non-interactive, so the
            whole strip behaves as one tap target. */}
        <MapView
          offers={offers}
          origin={origin}
          destination={destination}
          route={route}
          interactive={false}
          heightClass="h-[132px]"
        />
        <span className="pointer-events-none absolute inset-0 z-[1] bg-gradient-to-t from-[color:var(--color-card)]/40 to-transparent" />
        <span className="pointer-events-none absolute right-2 top-2 z-[1] inline-flex items-center gap-1 rounded-full bg-[color:var(--color-card)]/85 px-2.5 py-1 text-xs text-text-secondary backdrop-blur-sm">
          <Icon name="expand" size={13} />
          See on map
        </span>
      </button>

      <BottomSheet open={open} onClose={() => setOpen(false)} title="On the map">
        <MapView
          offers={offers}
          origin={origin}
          destination={destination}
          route={route}
          heightClass="h-[60vh] rounded-lg"
        />
      </BottomSheet>
    </>
  );
}
