/** localStorage key holding the visitor's explicit choice. Missing means "follow the device setting". */
export const THEME_STORAGE_KEY = "pm-theme";

/** Fired on window after the `dark` class on <html> changes, so canvas-drawn UI (the map) can repaint. */
export const THEME_EVENT = "pm-theme";

export type Theme = "light" | "dark";

/**
 * Runs inline in <head> before first paint so a saved or device dark preference never flashes light.
 * Keep it dependency-free and in sync with THEME_STORAGE_KEY.
 */
export const THEME_INIT_SCRIPT = `(function(){try{var t=localStorage.getItem("${THEME_STORAGE_KEY}");var d=t?t==="dark":window.matchMedia("(prefers-color-scheme: dark)").matches;document.documentElement.classList.toggle("dark",d)}catch(e){}})();`;
