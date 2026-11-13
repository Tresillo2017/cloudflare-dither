# Core API for adapter authors

Source of truth: `src/core/types.ts` (adapter contract), `src/core/index.ts` (public exports),
`src/core/registry.ts` (lifecycle). If this guide and the code disagree, the code wins.

## 1. Write an adapter

An adapter is a plain object of type `Adapter` (from `src/core/index.ts` or `src/core/types.ts`).
It lives in one group folder and is exported from that folder's `index.ts`:

```tsx
// src/adapters/controls/switch.tsx
import type { Adapter, AdapterContext } from "../../core";

const SwitchStandIn = ({ ctx }: { ctx: AdapterContext }) => {
  // Re-renders when the original's aria-checked changes.
  const checked = ctx.useTargetState((el) => el.getAttribute("aria-checked") === "true");
  return (
    <div data-dcf-visual="switch" data-checked={String(checked)} className="absolute inset-0 rounded-full bg-primary/20" />
  );
};

export const switchAdapter: Adapter = {
  id: "switch",                    // unique; also the settings key
  label: "Switch",
  group: "controls",
  ditherComponents: ["dither-switch"],
  selectors: [
    { selector: 'button[role="switch"]', confidence: "high", source: "Base UI switch" },
  ],
  defaultEnabled: true,
  maxInstances: 200,               // optional cap on simultaneous stand-ins
  match: (el) => el.closest("[data-dcf-host]") === null,   // optional extra filter; may throw
  mode: "underlay-child",          // see section 3
  render: (ctx) => <SwitchStandIn ctx={ctx} />,
};
```

Then add it to the group's array (`src/adapters/controls/index.ts`):

```ts
import type { Adapter } from "../../core";
import { switchAdapter } from "./switch";
export const adapters: Adapter[] = [switchAdapter];
```

`src/adapters/index.ts` already concatenates the six group arrays. Do not edit it.

### Adapter fields

| field | meaning |
|---|---|
| `id` | unique key. Settings store enable flags under it (`settings.adapters[id]`). |
| `label` | shown in the settings panel. |
| `group` | `controls \| feedback \| charts \| surfaces \| text \| images \| page`. The `media` folder holds the `text` and `images` groups. |
| `ditherComponents` | dithercn component names used, for the coverage report. |
| `selectors` | `{ selector, confidence: 'high'\|'med'\|'low', source }`. Several allowed; an invalid selector is logged and skipped. |
| `defaultEnabled` | `false` for low-confidence or invasive adapters. Users can override per adapter. |
| `maxInstances` | cap on simultaneously mounted stand-ins. Extra targets stay untouched. |
| `match(el)` | extra filter after the selector. Return `false` to skip. A throw skips that element and records `error` for the adapter. |
| `mode` | `'underlay-child' \| 'sibling-replace' \| 'overlay-fixed'` (section 3). |
| `render(ctx)` | returns React nodes rendered into the stand-in's shadow root. |

## 2. `AdapterContext`

```ts
interface AdapterContext {
  target: Element;                       // the Cloudflare element
  rect: { width: number; height: number }; // tracked by a shared ResizeObserver
  theme: 'light' | 'dark';               // follows Kumo's data-mode on <html>
  settings: Settings;                    // read-only snapshot
  useTargetState<T>(read: (el: Element) => T, opts?: TargetStateOptions): T;
  useTargetPseudo(): TargetPseudoState;  // { hover, active, focusVisible }
}
interface TargetStateOptions { attributes?: string[]; subtree?: boolean }
```

- `useTargetState(read, opts)` is a real React hook. Call it at the top level of `render`
  (or of a component you render from `render`), never inside a condition or loop.
  It re-runs `read(target)` when the watched part of the target changes.
  - Default: any attribute change on the target.
  - `attributes: ['aria-checked', 'data-state']`: only those attributes.
  - `subtree: true`: also text and child changes (use for labels).
- `useTargetPseudo()` tracks hover, active and focus-visible on the ORIGINAL element with
  passive listeners. Stand-ins are `pointer-events: none`, so CSS `:hover` never fires on them.
  Use this hook for hover styling.
- `settings` and `theme` update the stand-in when they change; you do not subscribe yourself.

Adapters do not receive `styles`, `registry` or `log`. They are not needed for a render.

### Example: label mirroring with subtree

```tsx
const label = ctx.useTargetState((el) => el.textContent ?? "", { subtree: true });
```

### Example: hover and focus

```tsx
const { hover, active, focusVisible } = ctx.useTargetPseudo();
```

## 3. Stand-in modes

Hosts are `inert`, `aria-hidden="true"`, `pointer-events: none`. Interaction and
accessibility stay with the original element, always.

- **`underlay-child`**: the host is the last child of the target, `position: absolute; inset: 0;
  z-index: -1`. The target's own children keep their normal stacking and stay clickable.
  The target gets `data-dcf-underlay` (its background, border and shadow become transparent) and
  `data-dcf-pos` if it was `position: static`.
  Use for: buttons, switches, tabs, inputs, anything with children to keep on top.
- **`sibling-replace`**: the host is the next sibling. The target gets `data-dcf-hidden`
  (`opacity: 0`). It keeps its layout, and the host overlays it with `margin-top: -height`, sized to the
  target's measured rect. The original stays focusable and clickable.
  Use for: loaders, skeletons, charts, logos, empty states.
  Limit: correct for block-level targets. Inline targets get a rough overlay.
- **`overlay-fixed`**: a `position: fixed; inset: 0` host on `document.body`. Not per-target
  gated (always mounted). Use for page-level layers only.

Viewport gating applies to the first two. A target mounts when it is within 320px of the viewport
and is disposed (original restored) when it leaves that zone.

## 4. What the core does for you

- **One MutationObserver** on the document. It scans only added subtrees, batched once per frame.
- **Re-heal**: if React wipes the host (a `textContent` update on the target does this),
  the host is re-attached and React state is kept. More than 25 re-heals in 10 s disables that stand-in.
- **Render errors**: each stand-in has an error boundary. A throw in `render` disposes that stand-in
  only, the original shows, and the error is recorded against the adapter. Nothing reaches the console.
- **Exact restore**: disposing a stand-in restores every attribute it touched, and removes the host.
  Turning an adapter or the master switch off returns the page to its original DOM.
- **Pause**: observers stop when the tab is hidden or the master switch is off.
- **Shared sheet**: every stand-in adopts one constructable stylesheet (Tailwind utilities without
  preflight, Kumo-derived tokens, dithercn component CSS). No `<style>` elements are inserted.
- **Tokens**: `--background`, `--foreground`, `--primary`, `--border`, `--ring`, `--radius`,
  `--ease-out`, `--dither-*` and the shadcn set are on `:host` (light, and `:host([data-dcf-theme="dark"])`).
  Use `bg-background`, `text-foreground`, `bg-dither-blue`, etc. in class names.
  Dark variant: `dark:` utilities follow `data-dcf-theme` (the stand-in theme), not the OS.

## 5. Build a private bundle and run only your spec

```bash
# Build your own bundle so you do not clobber others' dist files
node scripts/build.mjs --out dist/<yourkey>.user.js

# Run only your spec against it
DCF_BUNDLE=dist/<yourkey>.user.js npx playwright test tests/<yourkey>.spec.ts
```

`DCF_BUNDLE` is read by `injectUserscript(page)` in `tests/helpers`. Pass a path explicitly to override it.
`npx playwright test` runs `tests/global-setup.ts` first, which also rebuilds the production and demo bundles.
Expect ~5 s of build time per run.

Flags: `--dev` (readable output, no minify), `--demo` (also registers demo adapters, test only).
Each build uses its own temp directory under `dist/` and renames the output into place, so concurrent
builds with different `--out` values are safe.

### Test helpers

```ts
import { test, expect } from "@playwright/test";
import { collectConsoleErrors, injectUserscript, installMiniPage, MINI_URL, domSnapshot, setSetting, setAdapterEnabled } from "./helpers";

test("switch stand-in mirrors aria-checked", async ({ page }) => {
  await installMiniPage(page, "strict");       // default | strict CSP, via page.route
  await page.goto(MINI_URL);
  const errors = collectConsoleErrors(page);
  await injectUserscript(page, process.env.DCF_BUNDLE);
  await expect(page.locator('[data-dcf-host="switch"]')).toHaveCount(1);
  expect(errors.messages).toEqual([]);
});
```

- `startFixture()`: starts `scripts/serve-fixture.mjs` on an ephemeral port (`{ baseUrl, stop }`).
- `installMiniPage(page, variant)`: serves `tests/helpers/mini-page.ts` (Kumo-like markup) with a
  real CSP header. Use `strict` to forbid `'unsafe-inline'` styles. Inline `style=""` attributes
  are blocked too, so put CSS in the mini stylesheet.
- `domSnapshot(page)`: `documentElement.outerHTML` for exact-restore assertions.
- `setSetting(page, patch)` and `setAdapterEnabled(page, id, on)`: go through the debug handle (below).

### Debug handle

`document[Symbol.for('cloudflare-dither.core')]` is the live `Core` object. It is for tests and
diagnostics only, not a supported API. It exposes `settings`, `registry`, `theme`, `diagnostics`.

## 6. Pitfalls

1. **Never remove, replace or rewrite React-owned nodes or text.** Use attributes you own
   (`data-dcf-*`, `dcf-` classes) and leave the target's own text alone.
2. **Use attributes, not classes, on targets.** React rewrites `className` when a variant changes and
   silently drops a class you added. The core uses `data-dcf-*` for this reason.
3. **Global CSS is keyed.** Any new global rule must start with `[data-dcf-…]` or `.dcf-…`.
   No bare element selectors. No preflight.
4. **Strict CSP.** No `<style>` elements, no inline `style=""` attributes in markup. React `style={{}}`
   props are fine (set through CSSOM). Vendored dithercn `<style>` blocks are rewritten at build time.
5. **Stand-ins are visual only.** No event handlers on the host, and do not intercept clicks on the original.
6. **Keep `render` pure.** Errors are caught, but a side effect in render runs on every re-render.
7. **CSS transitions on the original are not mirrored.** `useTargetState` re-renders on attribute
   change, so a stand-in jumps to the final state. Animate inside the stand-in yourself if needed.
8. **`maxInstances` counts mounted stand-ins**, not matched targets. Off-screen targets do not count.
9. **Dithercn `resolveColor`**: pass the stand-in element when you can. The page `:root` only has
   `--dither-*` tokens.
10. **WebGL**: the browser caps live contexts at 8. Use `DitherShader` only for ambient page-level
    surfaces. Use SVG/CSS components for per-target stand-ins.
11. **`match` runs on every scan of its subtree.** Keep it cheap. It may throw; it must not have side effects.
12. **Do not call `console.*`.** Adapters have no logger in their context. Throw from `match` or `render`
    instead; the core records the error, disposes the stand-in if needed, and prints only when `settings.debug` is on.

## 7. Exports for adapter code

From `src/core/index.ts`:

- Types: `Adapter`, `AdapterContext`, `AdapterGroup`, `StandInMode`, `SelectorSpec`, `SelectorConfidence`,
  `TargetStateOptions`, `TargetPseudoState`, `Settings`, `SettingsStore`, `Log`, `LogEntry`, `LogLevel`,
  `AdapterInfo`, `RegistryApi`, `Census`, `DiagnosticsApi`, `StylesApi`, `ThemeName`, `ThemeStore`, `Rect`, `Core`.
- Values: `DEFAULT_SETTINGS`, `isAdapterEnabled(settings, adapter)`, `DcfStyle` (for dithercn-style
  components only; adapters do not need it).

`createStandIn`, the registry and the observers are internal. Adapters never create hosts directly.

## 8. Known unverified items (as of this build)

- `resolveColor` from inside shadow roots (no-element fallback to `:root` tokens) is not tested by the spec.
- The sibling-replace overlay is verified on block-level targets only.
- Dark variant `dark:` utilities are not covered by a test (no vendor component uses them in production).
- The `<style>` fallback path (no constructable stylesheets) is not exercised.
- Not tested in Tampermonkey or Violentmonkey. The sandbox realm may differ; `document.adoptedStyleSheets` failures fall back to a `<style>` element.

## 9. Visual system (src/core/visual.ts)

The single source of visual constants. Import from `src/core/visual.ts`, never copy values.

- `CELL_PX` (3), `CELL_PX_SMALL` (2), `cellFor(heightPx)`: 2px only under 20px tall.
- `MATRIX` (`bayer4`), `CLOUDFLARE_ORANGE` (`#f6821f`, accent 2), `CLOUDFLARE_BLUE_LIGHT/DARK`.
- `Tone` = `brand | danger | success | warning | info | neutral`. `toneColor(tone)` returns a
  `var(--color-kumo-*, fallback)` string read live from the real Kumo tokens (brand is Cloudflare
  blue in both themes; verified on /home, dark and light).
- Colour tokens: `INK`, `PAPER`, `LINE`, `ELEVATED`, `RECESSED` (CSS strings, flip with data-mode).
- Recipes (all return React `CSSProperties`):
  - `ditherFill(tone, level, cell?)`: masked dithered fill, level 0 to 1.
  - `toneFill(variant, tone, opts)`: dithercn `fillStyle` for `solid | dotted | hatched | gradient`.
  - `shadeStyle(tone, cell?)`: shade rising from the bottom (button surfaces).
  - `highlightStyle(tone, cell?)`: faint sheen from the top (hover, active rows).
- Rules: never dither behind text. Rims are one uniform treatment on all four sides.

Theme: `html.dark-mode` or `html[data-mode=dark]` both count as dark (`src/core/theme.ts`).
