/**
 * Shared class strings. The page has no preflight, so native buttons need their background and
 * border reset here; otherwise the browser default grey shows in both themes.
 */
export const GHOST_BUTTON =
  "cursor-pointer rounded-md border border-transparent bg-transparent px-2 py-1 text-left text-sm text-foreground hover:bg-muted focus-visible:outline-ring focus-visible:outline-2 outline-offset-2";

export const CHOICE_BUTTON =
  "cursor-pointer rounded-md border border-transparent bg-transparent px-2 py-1.5 text-left text-xs text-foreground hover:bg-muted focus-visible:outline-ring focus-visible:outline-2 outline-offset-2 aria-pressed:bg-primary aria-pressed:text-primary-foreground";
