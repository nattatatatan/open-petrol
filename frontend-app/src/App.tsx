import { useCallback, useEffect, useRef, useState } from "react";
import { api, type GeoPlace } from "./api";
import { useGeolocation } from "./hooks/useGeolocation";
import { useUserModel } from "./hooks/useUserModel";
import type { CatalogPreset, Meta, NearMeResult, RouteResult, StationOffer } from "./types";
import { navigateUrl } from "./lib/navigate";
import { AnswerCard } from "./components/AnswerCard";
import { Advisor } from "./components/Advisor";
import { FuelChooser } from "./components/FuelChooser";
import { OfferList } from "./components/OfferList";
import { SettingsSheet } from "./components/SettingsSheet";
import { TrustBar } from "./components/TrustBar";
import { ModeToggle, type Mode } from "./components/ModeToggle";
import { Logo } from "./components/Logo";
import { Icon } from "./components/Icon";
import { PlaceSearch } from "./components/PlaceSearch";
import { Card, Skeleton, Spinner } from "./components/ui";

type Result = NearMeResult | RouteResult;

const FALLBACK_FUELS: Record<string, string> = {
  E10: "E10", U91: "U91", P95: "P95", P98: "P98", DL: "Diesel",
};

const isRoute = (r: Result | null): r is RouteResult =>
  !!r && "route_geometry" in r;

export default function App() {
  const { model, update } = useUserModel();
  const geo = useGeolocation();
  const [meta, setMeta] = useState<Meta | null>(null);
  const [catalog, setCatalog] = useState<CatalogPreset[]>([]);
  const [mode, setMode] = useState<Mode>("near"); // cold-open default (STYLE_GUIDE §3)
  const [destination, setDestination] = useState("");
  const [destPlace, setDestPlace] = useState<GeoPlace | null>(null);
  const [editingOrigin, setEditingOrigin] = useState(false);
  const [originQuery, setOriginQuery] = useState("");
  const [result, setResult] = useState<Result | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [settingsOpen, setSettingsOpen] = useState(false);

  const fuelTypes = meta?.fuel_types ?? FALLBACK_FUELS;

  useEffect(() => {
    api.meta().then(setMeta).catch(() => setError("Couldn't reach the price service."));
    api.catalog().then((c) => setCatalog(c.presets)).catch(() => {});
  }, []);

  // Least-clicks: ask for location on open so "near me now" answers with ~0 taps
  // (manual suburb fallback appears if denied). STYLE_GUIDE §8.
  useEffect(() => {
    geo.request();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const runSearch = useCallback(async () => {
    if (!geo.coords) return;
    setLoading(true);
    setError(null);
    try {
      const membership = {
        memberships: model.memberships,
        rateOverrides: model.rateOverrides,
        customRules: model.customRules,
      };
      const res =
        mode === "route"
          ? await api.onMyWay({
              originLat: geo.coords.lat, originLng: geo.coords.lng, dest: destination,
              destLat: destPlace?.latitude, destLng: destPlace?.longitude,
              fuel: model.fuelType, tank: model.tankL, usual: model.usualStation,
              membership,
            })
          : await api.nearMe({
              lat: geo.coords.lat, lng: geo.coords.lng, fuel: model.fuelType,
              tank: model.tankL, radius: 10, usual: model.usualStation,
              membership,
            });
      setResult(res);
      api.meta().then(setMeta).catch(() => {});
    } catch (e) {
      setResult(null);
      setError(e instanceof Error ? e.message : "Something went wrong.");
    } finally {
      setLoading(false);
    }
  }, [geo.coords, mode, destination, destPlace, model.fuelType, model.tankL, model.usualStation,
      model.memberships, model.rateOverrides, model.customRules]);

  const searchRef = useRef(runSearch);
  searchRef.current = runSearch;

  // Switching mode resets the answer — a near-me result must never masquerade as a
  // route result (and vice-versa).
  useEffect(() => {
    setResult(null);
    setError(null);
  }, [mode]);

  // Near-me needs no destination, so once we have a location it answers immediately
  // (the !result guard stops it re-firing). Route stays destination-driven.
  useEffect(() => {
    if (mode === "near" && geo.coords && !result && !loading) searchRef.current();
  }, [mode, geo.coords, result, loading]);

  // Route mode: picking a destination suggestion (or changing the origin while a
  // destination is set) answers immediately — no extra tap. Free-text + Enter/arrow
  // still goes through runSearch.
  useEffect(() => {
    if (mode === "route" && destPlace && geo.coords) searchRef.current();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [destPlace, geo.coords]);

  // Live re-query when the user model changes (fuel / tank / baseline / memberships)
  // and we already have an answer — keeps it scoped to their choices.
  const hasResult = !!result;
  useEffect(() => {
    if (hasResult) searchRef.current();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [model.fuelType, model.tankL, model.usualStation,
      model.memberships, model.rateOverrides, model.customRules]);

  const origin: [number, number] | null = geo.coords ? [geo.coords.lat, geo.coords.lng] : null;
  const destCoords = isRoute(result) ? result.destination : null;
  const offers = result?.offers ?? [];
  const recommended = result?.recommended ?? null;
  const usualName = offers.find((o) => o.station_code === model.usualStation)?.name ?? null;
  const activeMembershipLabels = [
    ...catalog.filter((p) => model.memberships.includes(p.key)).map((p) => p.label),
    ...model.customRules.filter((r) => r.brand).map((r) => r.brand),
  ];

  const navigate = (o: StationOffer) =>
    window.open(navigateUrl(o, origin, destCoords), "_blank", "noopener");

  const needsManual = geo.status === "denied" || geo.status === "unavailable";
  // Skeleton only while we're genuinely about to answer: a search is running, or
  // near-me is waiting on a location we can still get. Never when location is
  // blocked (then we prompt for a suburb instead of pulsing forever).
  const showSkeleton =
    loading ||
    (mode === "near" && !result && !error && !needsManual);

  return (
    <div className="mx-auto flex min-h-full max-w-md flex-col px-md pb-[env(safe-area-inset-bottom)]">
      <header className="flex items-center justify-between pt-[calc(16px+env(safe-area-inset-top))] pb-md">
        <div>
          <h1 className="leading-none"><Logo /></h1>
          <p className="cap mt-1.5 text-text-secondary">Your best fill-up, right now</p>
        </div>
        <button
          onClick={() => setSettingsOpen(true)}
          aria-label="Settings"
          className="inline-flex items-center gap-1.5 rounded-full border border-border px-3 py-2 text-sm text-text-secondary hover:border-border-strong"
        >
          {model.fuelType} · {model.tankL}L
          <Icon name="settings" size={16} />
        </button>
      </header>

      <ModeToggle mode={mode} onChange={setMode} />

      {/* Compact control row: origin (+ destination in route mode) */}
      <div className="mt-md space-y-2">
        {editingOrigin || (!geo.coords && needsManual) ? (
          <div className="space-y-1.5">
            <PlaceSearch
              value={originQuery}
              onChange={setOriginQuery}
              onPick={(p) => {
                geo.setManual({ lat: p.latitude, lng: p.longitude, label: placeLabel(p) });
                setEditingOrigin(false);
                setOriginQuery("");
                setResult(null); // re-answer from the new origin
              }}
              placeholder="Search a suburb or address"
              autoFocus
            />
            <div className="flex items-center justify-between px-1">
              <button
                className="inline-flex items-center gap-1 text-xs text-text hover:underline"
                onClick={() => { setEditingOrigin(false); setOriginQuery(""); geo.request(); }}
              >
                <Icon name="location" size={12} /> Use current location
              </button>
              {geo.coords && (
                <button
                  className="text-xs text-text-secondary hover:underline"
                  onClick={() => { setEditingOrigin(false); setOriginQuery(""); }}
                >
                  Cancel
                </button>
              )}
            </div>
          </div>
        ) : geo.coords ? (
          <div className="flex min-h-[44px] items-center justify-between rounded-lg border border-border px-4 py-2.5 text-sm">
            <span className="inline-flex items-center gap-2 text-text">
              <Icon name="location" size={15} className="text-[color:var(--color-success)]" />
              {geo.coords.label}
            </span>
            <button
              className="text-xs text-text hover:underline"
              onClick={() => setEditingOrigin(true)}
            >
              Change
            </button>
          </div>
        ) : (
          <div className="flex min-h-[44px] items-center gap-2 rounded-lg border border-border px-4 py-2.5 text-sm text-text-secondary">
            <Spinner /> Finding your location…
          </div>
        )}

        {mode === "route" && (
          <PlaceSearch
            value={destination}
            onChange={(v) => { setDestination(v); setDestPlace(null); }}
            onPick={setDestPlace}
            onEnter={() => geo.coords && destination.trim() && runSearch()}
            placeholder="Where are you headed?"
            suffix={
              <button
                aria-label="Find fill-up on the way"
                disabled={!geo.coords || !destination.trim()}
                onClick={runSearch}
                className="text-text disabled:opacity-40"
              >
                <Icon name="arrow" size={16} rotate={90} />
              </button>
            }
          />
        )}

        {error && (
          <p className="text-sm text-[color:var(--color-text-error)]">
            {error}
          </p>
        )}

        {/* Inline fuel refine — one tap, re-queries live (STYLE_GUIDE §7.3) */}
        <FuelChooser
          fuelTypes={fuelTypes}
          value={model.fuelType}
          onChange={(fuelType) => update({ fuelType })}
        />
      </div>

      <main className="mt-lg">
        {showSkeleton ? (
          <SkeletonAnswer />
        ) : recommended ? (
          <div className="space-y-md">
            <AnswerCard
              offer={recommended}
              baseline={result!.baseline}
              mode={mode}
              tankL={model.tankL}
              reference={result!.captured_at}
              isUsual={model.usualStation === recommended.station_code}
              onNavigate={() => navigate(recommended)}
              onSetUsual={() => {
                const isUsual = model.usualStation === recommended.station_code;
                update({
                  usualStation: isUsual ? null : recommended.station_code,
                  usualStationName: isUsual ? null : recommended.name,
                });
              }}
              map={{ offers, origin, destination: destCoords, route: isRoute(result) ? result.route_geometry : [] }}
            />

            {/* Timing verdict — a glanceable modifier directly under the answer,
                styled per the provided design (brand mark + mono caption).
                Hidden when the signal is too weak to act on (CLAUDE.md §6, §7.5). */}
            <Advisor
              fuel={model.fuelType}
              tank={model.tankL}
              recommendedCode={recommended.station_code}
            />

            <OfferList
              offers={offers}
              baseline={result!.baseline}
              mode={mode}
              usualStation={model.usualStation}
              onSelect={navigate}
            />

            <p className="px-1 text-xs text-text-secondary">
              {activeMembershipLabels.length > 0
                ? `Showing your effective price with ${activeMembershipLabels.join(" + ")}. Pump prices from FuelCheck.`
                : "Pump prices from FuelCheck — member/docket discounts (e.g. NRMA −5c, Coles/Woolies −4c) aren’t included. Add yours in settings."}
            </p>
          </div>
        ) : result && !recommended ? (
          <Card className="p-xl text-center">
            <p className="text-text">No stations found {mode === "route" ? "along this route" : "nearby"}.</p>
            <p className="mt-1 text-sm text-text-secondary">Try a wider search or a different fuel type.</p>
          </Card>
        ) : needsManual && !geo.coords ? (
          <Card className="p-xl text-center">
            <p className="text-text">Where are you?</p>
            <p className="mt-1 text-sm text-text-secondary">
              Enter your suburb above and we’ll find your cheapest fill-up nearby.
            </p>
          </Card>
        ) : mode === "route" ? (
          <Card className="p-xl text-center">
            <p className="text-text">Where are you headed?</p>
            <p className="mt-1 text-sm text-text-secondary">
              Enter a destination and we’ll find the best-value fill-up on your way.
            </p>
          </Card>
        ) : (
          <SkeletonAnswer />
        )}
      </main>

      <div className="mt-lg">
        <TrustBar meta={meta} />
      </div>

      <footer className="cap mt-auto pt-2xl pb-md text-center text-text-secondary">
        <div className="mb-3 flex justify-center opacity-40">
          <svg width="56" height="20" viewBox="0 0 99 35" fill="none" xmlns="http://www.w3.org/2000/svg" aria-label="open.">
            <path fillRule="evenodd" clipRule="evenodd" d="M50.3424 15.0593C50.057 12.906 49.2043 11.0227 47.5711 9.5745C45.1117 7.39539 42.2226 6.71848 39.0167 7.35156C36.9057 7.76748 35.1986 8.80894 34.0299 10.654C33.9834 10.7278 33.9137 10.7882 33.8557 10.8545C33.8175 10.8479 33.7794 10.8413 33.7412 10.8347V7.55778H30.7551V34.8454H34.4114V22.6536C34.4728 22.6735 34.5068 22.6735 34.5193 22.6901C34.5956 22.7886 34.6661 22.8906 34.7382 22.9917C35.7419 24.3894 37.0608 25.324 38.7512 25.7102C39.9888 25.9926 41.2414 26.049 42.4947 25.8683C45.3721 25.4524 47.6599 24.0862 49.1571 21.5567C50.3465 19.5482 50.6468 17.3551 50.3424 15.0593ZM40.5222 22.6494C37.123 22.6743 34.5566 20.0603 34.5342 16.5481C34.5126 13.2067 37.1653 10.5131 40.5089 10.4825C44.1271 10.4493 46.8088 13.0044 46.7964 16.51C46.7847 19.7719 44.7169 22.6486 40.5222 22.6494Z" fill="white"/>
            <path fillRule="evenodd" clipRule="evenodd" d="M71.9501 15.8877C71.8332 12.8155 70.5475 10.3549 67.9554 8.67785C65.6362 7.17739 63.0532 6.82112 60.3657 7.33563C57.5164 7.88081 55.3656 9.42435 54.0027 12.011C53.1475 13.6342 52.9178 15.384 53.0057 17.1828C53.1533 20.1862 54.3876 22.6312 56.8993 24.3429C58.4603 25.4076 60.2122 25.9121 62.1175 25.9369C63.9532 25.9619 65.7133 25.7198 67.3648 24.8665C68.998 24.0214 70.2693 22.8268 71.1418 21.1718C71.1634 21.1309 71.1848 21.0896 71.2059 21.0482C71.2215 21.0173 71.2371 20.9862 71.2526 20.955C71.0195 20.9285 70.8163 20.8862 70.6139 20.8845C69.7985 20.8771 68.9814 20.9102 68.1677 20.8721C67.4776 20.8406 66.9516 21.035 66.4076 21.5101C66.3286 21.5791 66.2375 21.6493 66.1463 21.7114C64.1763 23.0628 61.0616 23.0511 59.1131 21.66C57.8399 20.7512 57.0436 19.5465 56.925 17.896H71.9219C71.9369 17.8423 71.9501 17.8173 71.9501 17.7925C71.9518 17.1578 71.9742 16.5215 71.9501 15.8877ZM68.03 15.0078H56.9432C56.8868 13.1394 59.4723 10.3116 62.689 10.4352C65.374 10.5379 68.2291 12.8967 68.03 15.0078Z" fill="white"/>
            <path fillRule="evenodd" clipRule="evenodd" d="M91.0863 25.2655C91.0863 25.3326 91.0763 25.3988 91.0689 25.4892H87.3063C87.3063 25.3226 87.3072 25.1752 87.3063 25.0269C87.3005 21.8512 87.2997 18.6763 87.2864 15.5005C87.2806 14.2793 87.065 13.1094 86.2653 12.1267C85.0659 10.6536 82.8413 10.2418 81.1135 11.1764C79.4512 12.0761 78.489 13.493 78.4342 15.3605C78.3405 18.5593 78.3787 21.7625 78.3621 24.963C78.3604 25.1279 78.3613 25.292 78.3613 25.4933H74.87V7.57307C75.3926 7.5449 75.9234 7.50513 76.4543 7.49021C76.9777 7.47613 77.5019 7.4869 78.1066 7.4869V9.8308C78.0004 10.1838 78.0407 10.052 78.1171 10.1009C78.1735 9.97091 78.4226 9.69493 78.5097 9.59053C80.2442 7.50513 82.5003 6.78596 85.109 7.2574C87.7327 7.73214 89.5111 9.29723 90.4451 11.801C90.864 12.9246 91.0398 14.0952 91.0481 15.2859C91.0722 18.6125 91.0755 21.939 91.0863 25.2655Z" fill="white"/>
            <path fillRule="evenodd" clipRule="evenodd" d="M25.3467 19.4066C22.8259 24.1416 17.8374 26.0423 14.0989 25.9172V22.2211C14.7268 22.125 15.387 22.0712 16.0241 21.9187C19.4697 21.0935 21.6927 18.9618 22.5969 15.5457C23.4081 12.4826 22.9411 9.59858 20.986 7.06237C19.5966 5.26032 17.6822 4.27272 15.4435 3.90891C15.008 3.83774 14.5708 3.77891 14.1345 3.71346C14.1238 3.71172 14.1146 3.69772 14.0839 3.67286V0C17.9626 0.0712534 21.2415 1.43832 23.8187 4.36634C27.218 8.22645 27.9031 14.6053 25.3467 19.4066Z" fill="white"/>
            <path fillRule="evenodd" clipRule="evenodd" d="M12.7994 22.212V25.9056C11.8322 25.9926 10.8933 25.8575 9.96752 25.6546C4.64725 24.4871 0.993395 20.6263 0.184654 15.206C-0.422441 11.1388 0.440133 7.41787 3.17824 4.25289C5.19138 1.92473 7.7918 0.638856 10.8144 0.179851C11.3577 0.0969987 11.9102 0.0762856 12.4593 0.0324564C12.5522 0.0258282 12.6476 0.050684 12.7969 0.0663432V3.65727C11.8703 3.8494 10.9571 3.95222 10.1011 4.23061C6.72675 5.33006 4.74347 7.6864 4.10809 11.1521C3.67676 13.5043 3.97703 15.7868 5.20714 17.8581C6.65292 20.2932 8.83362 21.6835 11.6555 22.0497C12.0354 22.0985 12.4128 22.1573 12.7994 22.212Z" fill="white"/>
            <path fillRule="evenodd" clipRule="evenodd" d="M98.3212 23.6137C98.3153 24.8971 97.3001 25.8111 95.88 25.8102C94.5603 25.8102 93.5011 24.8193 93.5143 23.5615C93.5293 22.1969 94.5031 21.2209 95.982 21.2657C97.3623 21.3079 98.327 22.2408 98.3212 23.6137Z" fill="white"/>
            <path fillRule="evenodd" clipRule="evenodd" d="M78.1066 7.4868H74.87V7.78093L78.1066 7.4868Z" fill="white"/>
            <path fillRule="evenodd" clipRule="evenodd" d="M78.1064 9.72767V10.0899C78.1064 10.0899 78.0829 10.0399 78.5769 9.51015V10.1934L77.9225 10.3694V9.68627L78.1064 9.72767Z" fill="white"/>
            <path fillRule="evenodd" clipRule="evenodd" d="M66.2545 21.6411C66.6346 21.3373 67.1116 20.8816 67.1116 20.8816H71.2936C71.2936 20.8816 71.0689 21.2752 70.96 21.3632" fill="white"/>
          </svg>
        </div>
        Prices from NSW FuelCheck · Routing © OpenStreetMap, CARTO, OSRM
      </footer>

      <SettingsSheet
        open={settingsOpen}
        model={model}
        usualStationName={usualName}
        catalog={catalog}
        coords={geo.coords}
        onUpdate={update}
        onClose={() => setSettingsOpen(false)}
      />
    </div>
  );
}

/** Short label for a geocoded place — the leading, most-specific parts. */
function placeLabel(p: GeoPlace): string {
  return p.display_name.split(",").slice(0, 2).join(",").trim();
}

/** Cold-open / loading placeholder — never a blank screen (STYLE_GUIDE §10). */
function SkeletonAnswer() {
  return (
    <section className="overflow-hidden rounded-xl border border-border bg-[color:var(--color-card)]">
      <Skeleton className="h-[132px] rounded-none" />
      <div className="space-y-3 p-lg">
        <Skeleton className="h-3 w-24" />
        <Skeleton className="h-6 w-3/4" />
        <Skeleton className="h-10 w-1/2" />
        <Skeleton className="h-3 w-2/3" />
        <Skeleton className="h-[60px] w-full rounded-lg" />
        <p className="cap text-center text-text-secondary">Finding your best fill-up…</p>
      </div>
    </section>
  );
}
