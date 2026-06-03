import { useCallback, useEffect, useRef, useState } from "react";
import { api } from "./api";
import { useGeolocation } from "./hooks/useGeolocation";
import { useUserModel } from "./hooks/useUserModel";
import type { CatalogPreset, Meta, NearMeResult, RouteResult, StationOffer } from "./types";
import { navigateUrl } from "./lib/navigate";
import { AnswerCard } from "./components/AnswerCard";
import { FuelChooser } from "./components/FuelChooser";
import { OfferList } from "./components/OfferList";
import { SettingsSheet } from "./components/SettingsSheet";
import { TrustBar } from "./components/TrustBar";
import { ModeToggle, type Mode } from "./components/ModeToggle";
import { Icon } from "./components/Icon";
import { Button, Card, Input, Skeleton, Spinner } from "./components/ui";

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
      const membership = {
        memberships: model.memberships,
        rateOverrides: model.rateOverrides,
        customRules: model.customRules,
      };
      const res =
        mode === "route"
          ? await api.onMyWay({
              originLat: geo.coords.lat, originLng: geo.coords.lng, dest: destination,
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
  }, [geo.coords, mode, destination, model.fuelType, model.tankL, model.usualStation,
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

  // ── First-run fuel gate — the only upfront question (STYLE_GUIDE §7.2) ──
  if (!model.fuelChosen) {
    return (
      <div className="mx-auto flex min-h-full max-w-md flex-col justify-center px-lg pb-[env(safe-area-inset-bottom)]">
        <h1 className="text-xl font-bold tracking-display text-text-heading">
          Petrol<span className="text-text-action">·</span>Finder
        </h1>
        <h2 className="mt-2xl text-2xl font-medium text-text-heading">Which fuel do you use?</h2>
        <p className="mb-lg mt-1 text-sm text-text-secondary">
          We scope every saving to your fuel — showing the wrong one would be unsafe.
        </p>
        <FuelChooser
          variant="firstrun"
          fuelTypes={fuelTypes}
          value={model.fuelType}
          onChange={(fuelType) => update({ fuelType, fuelChosen: true })}
        />
        <p className="mt-md text-xs text-text-secondary">You can change this any time.</p>
      </div>
    );
  }

  const needsManual = geo.status === "denied" || geo.status === "unavailable";
  const showSkeleton = loading || (mode === "near" && !result && !error && !needsManual);

  return (
    <div className="mx-auto flex min-h-full max-w-md flex-col px-md pb-[env(safe-area-inset-bottom)]">
      <header className="flex items-center justify-between pt-[calc(16px+env(safe-area-inset-top))] pb-md">
        <div>
          <h1 className="text-xl font-bold tracking-display text-text-heading">
            Petrol<span className="text-text-action">·</span>Finder
          </h1>
          <p className="text-xs text-text-secondary">Your best fill-up, right now</p>
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
        {geo.coords ? (
          <div className="flex items-center justify-between rounded-md border border-border px-3 py-2.5 text-sm">
            <span className="inline-flex items-center gap-2 text-text">
              <Icon name="location" size={15} className="text-[color:var(--color-success)]" />
              {geo.coords.label}
            </span>
            <button className="text-xs text-text-action hover:underline" onClick={geo.request}>
              Update
            </button>
          </div>
        ) : needsManual ? (
          <ManualOrigin onSubmit={handleManualOrigin} />
        ) : (
          <div className="flex items-center gap-2 rounded-md border border-border px-3 py-2.5 text-sm text-text-secondary">
            <Spinner /> Finding your location…
          </div>
        )}

        {mode === "route" && (
          <Input
            value={destination}
            onChange={(e) => setDestination(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && geo.coords && destination.trim() && runSearch()}
            placeholder="Where are you headed? (e.g. Parramatta)"
            suffix={
              <button
                aria-label="Find fill-up on the way"
                disabled={!geo.coords || !destination.trim()}
                onClick={runSearch}
                className="text-text-action disabled:opacity-40"
              >
                <Icon name="arrow" size={16} rotate={90} />
              </button>
            }
          />
        )}

        {/* Inline fuel refine — one tap, re-queries live (STYLE_GUIDE §7.3) */}
        <FuelChooser
          fuelTypes={fuelTypes}
          value={model.fuelType}
          onChange={(fuelType) => update({ fuelType })}
        />
      </div>

      {error && (
        <p className="mt-md rounded-md border border-[color:var(--color-border-error)] px-3 py-2 text-sm text-[color:var(--color-text-error)]">
          {error}
        </p>
      )}

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
              map={{ offers, origin, destination: destCoords, route: isRoute(result) ? result.route_geometry : [], theme: model.theme }}
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

      <footer className="mt-auto pt-2xl pb-md text-center text-xs text-text-secondary">
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

/** Manual suburb entry — geolocation fallback, never a dead screen (§10). */
function ManualOrigin({ onSubmit }: { onSubmit: (q: string) => void }) {
  const [v, setV] = useState("");
  return (
    <form
      className="flex gap-2"
      onSubmit={(e) => {
        e.preventDefault();
        if (v.trim()) onSubmit(v.trim());
      }}
    >
      <Input
        value={v}
        onChange={(e) => setV(e.target.value)}
        placeholder="Enter your suburb"
        size="small"
        className="flex-1 text-sm"
      />
      <Button hierarchy="secondary" size="small" type="submit">Set</Button>
    </form>
  );
}

/** Cold-open / loading placeholder — never a blank screen (STYLE_GUIDE §10). */
function SkeletonAnswer() {
  return (
    <section className="overflow-hidden rounded-lg border border-border bg-[color:var(--color-card)]">
      <Skeleton className="h-[132px] rounded-none" />
      <div className="space-y-3 p-lg">
        <Skeleton className="h-3 w-24" />
        <Skeleton className="h-6 w-3/4" />
        <Skeleton className="h-10 w-1/2" />
        <Skeleton className="h-3 w-2/3" />
        <Skeleton className="h-[60px] w-full rounded-full" />
        <p className="text-center text-xs text-text-secondary">Finding your best fill-up…</p>
      </div>
    </section>
  );
}
