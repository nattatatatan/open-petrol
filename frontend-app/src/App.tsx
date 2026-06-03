import { useCallback, useEffect, useRef, useState } from "react";
import { api } from "./api";
import { useGeolocation } from "./hooks/useGeolocation";
import { useUserModel } from "./hooks/useUserModel";
import type { Meta, NearMeResult, RouteResult, StationOffer } from "./types";
import { navigateUrl } from "./lib/navigate";
import { Advisor } from "./components/Advisor";
import { FuelSelector } from "./components/FuelSelector";
import { MapView } from "./components/MapView";
import { OfferList } from "./components/OfferList";
import { ResultHero } from "./components/ResultHero";
import { SearchPanel } from "./components/SearchPanel";
import { SettingsSheet } from "./components/SettingsSheet";
import { TrustBar } from "./components/TrustBar";
import { Card } from "./components/ui";

type Mode = "route" | "near";
type Result = NearMeResult | RouteResult;

const isRoute = (r: Result | null): r is RouteResult =>
  !!r && "route_geometry" in r;

export default function App() {
  const { model, update } = useUserModel();
  const geo = useGeolocation();
  const [meta, setMeta] = useState<Meta | null>(null);
  const [mode, setMode] = useState<Mode>("route");
  const [destination, setDestination] = useState("");
  const [result, setResult] = useState<Result | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [settingsOpen, setSettingsOpen] = useState(false);

  useEffect(() => {
    api.meta().then(setMeta).catch(() => setError("Couldn't reach the price service."));
  }, []);

  // Least-clicks: ask for location on open so we can answer with zero taps
  // (manual suburb fallback appears if denied). CLAUDE.md §8.
  useEffect(() => {
    geo.request();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleManualOrigin = useCallback(
    async (q: string) => {
      try {
        const r = await api.geocode(q);
        geo.setManual({ lat: r.latitude, lng: r.longitude, label: r.display_name.split(",")[0] });
        setError(null);
      } catch {
        setError(`Couldn't find "${q}".`);
      }
    },
    [geo],
  );

  const runSearch = useCallback(async () => {
    if (!geo.coords) return;
    setLoading(true);
    setError(null);
    try {
      const res =
        mode === "route"
          ? await api.onMyWay({
              originLat: geo.coords.lat, originLng: geo.coords.lng, dest: destination,
              fuel: model.fuelType, tank: model.tankL, usual: model.usualStation,
              membership: model.membership,
            })
          : await api.nearMe({
              lat: geo.coords.lat, lng: geo.coords.lng, fuel: model.fuelType,
              tank: model.tankL, radius: 10, usual: model.usualStation,
              membership: model.membership,
            });
      setResult(res);
      api.meta().then(setMeta).catch(() => {});
    } catch (e) {
      setResult(null);
      setError(e instanceof Error ? e.message : "Something went wrong.");
    } finally {
      setLoading(false);
    }
  }, [geo.coords, mode, destination, model.fuelType, model.tankL, model.usualStation, model.membership]);

  // Live re-query when the user model changes (fuel / tank / baseline) and we
  // already have a result — keeps the answer scoped to their choices.
  const searchRef = useRef(runSearch);
  searchRef.current = runSearch;
  const hasResult = !!result;
  useEffect(() => {
    if (hasResult) searchRef.current();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [model.fuelType, model.tankL, model.usualStation, model.membership]);

  // Near-me needs no destination, so once we have a location it can answer
  // immediately (1 tap: the tab). Route stays the primary, destination-driven flow.
  const autoNearRef = useRef(false);
  useEffect(() => {
    if (geo.coords && mode === "near" && !autoNearRef.current) {
      autoNearRef.current = true;
      searchRef.current();
    }
  }, [geo.coords, mode]);

  const origin: [number, number] | null = geo.coords ? [geo.coords.lat, geo.coords.lng] : null;
  const destCoords = isRoute(result) ? result.destination : null;
  const offers = result?.offers ?? [];
  const recommended = result?.recommended ?? null;
  const usualName =
    offers.find((o) => o.station_code === model.usualStation)?.name ?? null;

  const navigate = (o: StationOffer) =>
    window.open(navigateUrl(o, origin, destCoords), "_blank", "noopener");

  return (
    <div className="mx-auto flex min-h-full max-w-md flex-col px-md pb-[env(safe-area-inset-bottom)]">
      <header className="flex items-center justify-between pt-[calc(16px+env(safe-area-inset-top))] pb-md">
        <div>
          <h1 className="text-xl font-bold tracking-display text-text-heading">
            Petrol<span className="text-text-action">·</span>Finder
          </h1>
          <p className="text-xs text-text-secondary">Cheapest fill-up on your way</p>
        </div>
        <button
          onClick={() => setSettingsOpen(true)}
          aria-label="Settings"
          className="rounded-full border border-border px-3 py-2 text-sm text-text-secondary hover:border-border-strong"
        >
          {model.fuelType} · {model.tankL}L ⚙
        </button>
      </header>

      <div className="mb-md">
        <TrustBar meta={meta} />
      </div>

      <Card className="p-md">
        <div className="mb-md">
          <FuelSelector
            fuelTypes={meta?.fuel_types ?? { E10: "E10", U91: "U91", P95: "P95", P98: "P98", DL: "Diesel" }}
            value={model.fuelType}
            onChange={(fuelType) => update({ fuelType })}
          />
        </div>
        <SearchPanel
          mode={mode}
          onModeChange={setMode}
          geoStatus={geo.status}
          originLabel={geo.coords?.label ?? null}
          onUseLocation={geo.request}
          onManualOrigin={handleManualOrigin}
          destination={destination}
          onDestinationChange={setDestination}
          onSearch={runSearch}
          loading={loading}
        />
      </Card>

      {error && (
        <p className="mt-md rounded-md border border-[color:var(--color-border-error)] px-3 py-2 text-sm text-[color:var(--color-text-error)]">
          {error}
        </p>
      )}

      {result && recommended && (
        <div className="mt-lg space-y-lg">
          <ResultHero
            offer={recommended}
            baseline={result.baseline}
            mode={mode}
            tankL={model.tankL}
            reference={result.captured_at}
            isUsual={model.usualStation === recommended.station_code}
            onNavigate={() => navigate(recommended)}
            onSetUsual={() => {
              const isUsual = model.usualStation === recommended.station_code;
              update({
                usualStation: isUsual ? null : recommended.station_code,
                usualStationName: isUsual ? null : recommended.name,
              });
            }}
          />

          <p className="px-1 text-xs text-text-secondary">
            {model.membership && meta?.discount_programs[model.membership]
              ? `Showing your effective price with ${meta.discount_programs[model.membership].label}. Pump prices from FuelCheck.`
              : "Pump prices from FuelCheck — member/docket discounts (e.g. NRMA −5c, Coles/Woolies −4c) aren’t included. Add yours in settings."}
          </p>

          <Advisor fuel={model.fuelType} tank={model.tankL} />

          <MapView
            offers={offers}
            origin={origin}
            destination={destCoords}
            route={isRoute(result) ? result.route_geometry : []}
            theme={model.theme}
          />

          <OfferList
            offers={offers}
            mode={mode}
            usualStation={model.usualStation}
            onSelect={navigate}
          />
        </div>
      )}

      {result && !recommended && (
        <Card className="mt-lg p-xl text-center">
          <p className="text-text">No stations found {mode === "route" ? "along this route" : "nearby"}.</p>
          <p className="mt-1 text-sm text-text-secondary">
            Try a wider search or a different fuel type.
          </p>
        </Card>
      )}

      <footer className="mt-auto pt-2xl pb-md text-center text-xs text-text-secondary">
        Prices from NSW FuelCheck · Routing © OpenStreetMap, CARTO, OSRM
      </footer>

      <SettingsSheet
        open={settingsOpen}
        model={model}
        usualStationName={usualName}
        discountPrograms={meta?.discount_programs ?? {}}
        coords={geo.coords}
        onUpdate={update}
        onClose={() => setSettingsOpen(false)}
      />
    </div>
  );
}
