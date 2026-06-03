import settings from "../assets/icons/settings.svg?raw";
import location from "../assets/icons/location.svg?raw";
import star from "../assets/icons/star.svg?raw";
import navigate from "../assets/icons/navigate.svg?raw";
import info from "../assets/icons/info.svg?raw";
import arrow from "../assets/icons/arrow.svg?raw";
import expand from "../assets/icons/expand.svg?raw";
import pin from "../assets/icons/pin.svg?raw";

/** Icons sourced from the design-system Figma file (Streamline Sharp Remix set,
 *  node 227:292) and exported as SVG into src/assets/icons. Each is normalised to
 *  `fill="currentColor"`, so an Icon inherits the surrounding text colour (the
 *  design system's `color.icon.*` tokens flow through `currentColor`).
 *
 *  Inlined via Vite `?raw` rather than <img> precisely so `currentColor` works —
 *  an <img src> can't pick up the parent's colour. */
const SOURCES = { settings, location, star, navigate, info, arrow, expand, pin } as const;

export type IconName = keyof typeof SOURCES;

export function Icon({
  name,
  size = 20,
  rotate,
  label,
  className = "",
}: {
  name: IconName;
  size?: number;
  /** Degrees — e.g. the single `arrow` becomes a chevron-right at 90, down at 180. */
  rotate?: number;
  /** When set, the icon is meaningful (role="img"); otherwise it's decorative. */
  label?: string;
  className?: string;
}) {
  return (
    <span
      role={label ? "img" : undefined}
      aria-label={label}
      aria-hidden={label ? undefined : true}
      className={`inline-flex shrink-0 items-center justify-center leading-none ${className}`}
      style={{
        width: size,
        height: size,
        transform: rotate ? `rotate(${rotate}deg)` : undefined,
      }}
      dangerouslySetInnerHTML={{ __html: SOURCES[name] }}
    />
  );
}
