import { useEffect, useRef, useState, type ReactNode } from "react";
import { api, type GeoPlace } from "../api";
import { Input } from "./ui";

/** Geocoded location entry with a debounced suggestions dropdown (CLAUDE.md §5, §11).
 *  Powers both the origin override ("pick a location instead of current") and the
 *  "On my way" destination. Suggestions are fetched only on typing (debounced) so
 *  Nominatim request volume stays low. */
export function PlaceSearch({
  value,
  onChange,
  onPick,
  onEnter,
  placeholder,
  suffix,
  size = "default",
  raised = false,
  autoFocus = false,
}: {
  value: string;
  onChange: (v: string) => void;
  onPick: (p: GeoPlace) => void;
  onEnter?: () => void;
  placeholder?: string;
  suffix?: ReactNode;
  size?: "default" | "small";
  raised?: boolean;
  autoFocus?: boolean;
}) {
  const [hits, setHits] = useState<GeoPlace[]>([]);
  const [open, setOpen] = useState(false);
  const seq = useRef(0);
  const justPicked = useRef(false);

  useEffect(() => {
    const q = value.trim();
    // Don't re-query the value we just wrote from a pick.
    if (justPicked.current) {
      justPicked.current = false;
      return;
    }
    if (q.length < 3) {
      setHits([]);
      setOpen(false);
      return;
    }
    const id = ++seq.current;
    const t = setTimeout(() => {
      api
        .geocodeSearch(q)
        .then((r) => {
          if (id === seq.current) {
            setHits(r);
            setOpen(true);
          }
        })
        .catch(() => id === seq.current && setHits([]));
    }, 300);
    return () => clearTimeout(t);
  }, [value]);

  const pick = (p: GeoPlace) => {
    justPicked.current = true;
    onChange(shortName(p));
    setHits([]);
    setOpen(false);
    onPick(p);
  };

  return (
    <div className="relative">
      <Input
        value={value}
        onChange={(e) => onChange(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === "Enter") {
            setOpen(false);
            onEnter?.();
          } else if (e.key === "Escape") {
            setOpen(false);
          }
        }}
        onFocus={() => hits.length > 0 && setOpen(true)}
        placeholder={placeholder}
        suffix={suffix}
        size={size}
        raised={raised}
        autoFocus={autoFocus}
      />
      {open && hits.length > 0 && (
        <ul className="absolute z-20 mt-1 max-h-60 w-full overflow-y-auto rounded-md border border-border bg-[color:var(--color-card-raised)] shadow-lg">
          {hits.map((p, i) => (
            <li key={`${p.latitude},${p.longitude},${i}`}>
              <button
                type="button"
                onClick={() => pick(p)}
                className="block w-full truncate border-b border-border px-3 py-2 text-left text-sm text-text last:border-b-0 hover:bg-[color:var(--color-card)]"
                title={p.display_name}
              >
                {p.display_name}
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

/** Nominatim display_name is long ("Parramatta, City of Parramatta, NSW, …"); keep
 *  the leading, most-specific parts for the field label. */
function shortName(p: GeoPlace): string {
  return p.display_name.split(",").slice(0, 2).join(",").trim();
}
