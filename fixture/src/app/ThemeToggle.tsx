import { toggleColorMode, useColorMode } from "./mode";

/**
 * Plain button (not a Kumo component) so it stays out of the Kumo census on every route.
 * It sets data-mode on <html> through the mode store.
 */
export function ThemeToggle(): JSX.Element {
  const mode = useColorMode();
  const isDark = mode === "dark";
  return (
    <button
      type="button"
      data-testid="theme-toggle"
      aria-pressed={isDark}
      onClick={toggleColorMode}
      className="fixed bottom-4 left-4 z-50 rounded-md border border-solid border-[#d9d9d9] bg-white px-3 py-1.5 text-sm text-black shadow-sm dark:bg-black dark:text-white"
    >
      {isDark ? "Light mode" : "Dark mode"}
    </button>
  );
}
