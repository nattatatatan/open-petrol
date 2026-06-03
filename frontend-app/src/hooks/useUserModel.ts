import { useCallback, useEffect, useState } from "react";
import type { UserModel } from "../types";

const KEY = "spf.user.v1";

const DEFAULT_MODEL: UserModel = {
  fuelType: "E10",
  tankL: 55,
  usualStation: null,
  theme: "dark",
};

function load(): UserModel {
  try {
    const raw = localStorage.getItem(KEY);
    if (raw) return { ...DEFAULT_MODEL, ...JSON.parse(raw) };
  } catch {
    /* ignore */
  }
  return DEFAULT_MODEL;
}

/** The user model (fuel, tank, usual station, theme) persisted to localStorage —
 *  this is what makes the savings THEIRS (CLAUDE.md §7). */
export function useUserModel() {
  const [model, setModel] = useState<UserModel>(load);

  useEffect(() => {
    localStorage.setItem(KEY, JSON.stringify(model));
    document.documentElement.setAttribute("data-theme", model.theme);
  }, [model]);

  const update = useCallback(
    (patch: Partial<UserModel>) => setModel((m) => ({ ...m, ...patch })),
    [],
  );

  return { model, update };
}
