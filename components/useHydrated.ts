import { useSyncExternalStore } from "react";

const subscribe = () => () => {};

/**
 * False on the server and during hydration, true once React controls the page. A controlled field used before
 * hydration loses its value (React writes its state back on the next render), so disable such fields until this is true.
 */
export function useHydrated(): boolean {
  return useSyncExternalStore(subscribe, () => true, () => false);
}
