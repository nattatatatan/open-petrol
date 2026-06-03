import type { StationOffer } from "../types";

type LatLng = [number, number];

/** Build a maps deep-link. In route mode the station is added as a WAYPOINT en
 *  route to the real destination (CLAUDE.md §7.5.5), not the final destination —
 *  so the app sends you to fill up *on the way*, then on to where you're going. */
export function navigateUrl(
  offer: StationOffer,
  origin: LatLng | null,
  destination: LatLng | null,
): string {
  const station = `${offer.latitude},${offer.longitude}`;
  const u = new URL("https://www.google.com/maps/dir/");
  u.searchParams.set("api", "1");
  if (origin) u.searchParams.set("origin", `${origin[0]},${origin[1]}`);
  u.searchParams.set("travelmode", "driving");

  if (destination) {
    // Fill up on the way: station is a via-waypoint, destination is the real end.
    u.searchParams.set("destination", `${destination[0]},${destination[1]}`);
    u.searchParams.set("waypoints", station);
  } else {
    // Near-me: the station is the destination.
    u.searchParams.set("destination", station);
  }
  return u.toString();
}
