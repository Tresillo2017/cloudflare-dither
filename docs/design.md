# Cloudflare Dither — design contract

A userscript for `https://dash.cloudflare.com/*` that re-skins the dashboard with the
real dithercn components (vendored in `vendor/dithercn`, bundled with React 19 + Tailwind v4).

Research reports (read the ones relevant to you): `RESEARCH/` (symlink or copy of the
scratchpad `research/` dir): `charts.md`, `interface.md`, `kumo.md`, `spike.md`,
`critique.md`, `backgrounds-registry.ts`. Kumo source clone: scratchpad `kumo/`.

## Hard facts that shape the design

- The live dashboard DOM could NOT be inspected (403 challenge, no login). Selectors come
  from Kumo 2.18 source (`data-kumo-component`, `data-kumo-part`, `data-sidebar`, roles,
  Base UI data attributes) plus generic semantic fallbacks. Therefore:
  every adapter must be **defensive, independently toggleable, and fail to a no-op**
  (original Cloudflare element left untouched and fully visible) on any error or mismatch.
- The script must never break the dashboard: never remove/replace nodes React owns, never
  change text/attributes React controls (other than our own `data-dcf-*` markers and
  classes prefixed `dcf-`), never intercept events destined for the originals.
- Engine caps live WebGL contexts at 8 (`MAX_LIVE_CONTEXTS`). Only the page background and
  a few ambient surfaces may use `DitherShader`; high-count stand-ins must use components
  that render via CSS/SVG fills, or be capped/virtualised by viewport.
- React 19 hoists `<style href precedence>` (used by e.g. DitherButton) into
  `document.head`, outside our shadow roots, and a strict `style-src` may block it. The
  build must extract those component style blocks into the shared adopted stylesheet
  (and the global mini-sheet if needed) so components look right without the hoisted tag.
- dithercn's `subscribeToTheme` watches only `class`/`style`/`data-theme` on `<html>`;
  Kumo flips `data-mode`. The theme bridge must observe `data-mode`, `class`,
  `color-scheme` and `prefers-color-scheme`, then nudge the engine (e.g. set a
  `--dcf-theme-tick` custom property through `documentElement.style`).
- `resolveColor(value, el?)` resolves against `document.documentElement` when no element
  is given, so `--dither-*` tokens must ALSO exist on the page `:root`.

## Architecture

```
src/
  main.tsx                 entry: guard double-init, boot core, register adapters
  core/
    host.ts                createStandIn(target, mode) -> {host, shadowRoot, mountEl, dispose}
    styles.ts              shared constructable sheet (compiled Tailwind, no preflight,
                           + hoisted component styles) adopted by every shadow root;
                           tiny GLOBAL sheet (only `dcf-`/`data-dcf-` selectors + :root tokens)
    tokens.ts              token bridge: --dither-*, shadcn vars (--background, --primary,
                           --card, --border, --ring, --muted, --destructive, --ease-out, ...)
                           derived from Kumo vars (`var(--color-kumo-base, <fallback>)`),
                           defined on :host of every stand-in; on page :root define ONLY
                           `--dither-*` (namespaced, safe). Light + dark values.
    theme.ts               theme bridge (see above) -> 'light' | 'dark' store + engine nudge
    registry.ts            adapter registry + scanner (ONE MutationObserver on document,
                           batched via requestIdleCallback/rAF, per-adapter error boundary,
                           WeakMap target -> mount, cleanup when target disconnects,
                           re-heal if React wipes our child host)
    portal.tsx             ONE React root (detached container); every stand-in is rendered
                           with createPortal into its shadow mount; each wrapped in an
                           ErrorBoundary that disposes the stand-in (=> original shows)
    settings.ts            persisted settings (GM_getValue/GM_setValue with localStorage
                           fallback), subscribe API, defaults; master on/off; per-adapter
                           enable flags; background id + props; intensity; cell size
    router.ts              SPA navigation signal (patch-free: popstate + polling
                           location.href + navigation API when present)
    diagnostics.ts         "Selector census": counts of data-kumo-component values,
                           data-testid prefixes, roles, _echarts_instance_, svg charts,
                           html attrs, CSP meta, per-adapter match counts + errors.
                           NO text content / account data. Copy-to-clipboard as JSON.
  adapters/<group>/...     one folder per group, each exports `adapters: Adapter[]`
  ui/                      settings panel, launcher button, Dither Lab gallery
fixture/                   mock dashboard built with the REAL @cloudflare/kumo package
tests/                     Playwright tests (core + one spec per adapter group)
scripts/build.mjs          -> dist/cloudflare-dither.user.js (+ dist/meta)
```

### Adapter contract (`src/core/registry.ts`)

```ts
export interface Adapter {
  id: string;                 // 'button', 'switch', ... (settings key)
  label: string;              // shown in settings panel
  group: 'controls' | 'feedback' | 'charts' | 'surfaces' | 'text' | 'images' | 'page';
  ditherComponents: string[]; // dithercn components used (for coverage report)
  selectors: { selector: string; confidence: 'high' | 'med' | 'low'; source: string }[];
  defaultEnabled: boolean;    // low-confidence/invasive adapters default to false
  maxInstances?: number;      // cap; beyond it targets are left untouched
  match?(el: Element): boolean;            // extra filtering after selector match
  mode: StandInMode;          // how the stand-in host attaches (below)
  render(ctx: AdapterContext): React.ReactNode;  // rendered into the shadow mount
}
export interface AdapterContext {
  target: Element;            // the Cloudflare element
  rect: { width: number; height: number };   // tracked via shared ResizeObserver
  theme: 'light' | 'dark';
  settings: Settings;
  /** re-render when these attributes of target (or subtree, if deep) change */
  useTargetState<T>(read: (el: Element) => T, opts?: { attributes?: string[]; subtree?: boolean }): T;
}
export type StandInMode =
  | 'underlay-child'   // host appended INSIDE target as last child: position:absolute;
                       // inset:0; z-index:-1 (target gets `isolation:isolate; position:relative`
                       // only if static, via a `dcf-` class in the global sheet), pointer-events:none,
                       // inert, aria-hidden. Target's own background/border made transparent
                       // via global-sheet rule keyed on `[data-dcf="<adapterId>"]`.
                       // Original content (label, icons) stays on top and stays interactive.
  | 'sibling-replace'  // host inserted as next sibling, position:absolute over the target's
                       // border box (placed from getBoundingClientRect, so it never takes a grid,
                       // flex or gap slot). Target kept in DOM and in the a11y tree, visually
                       // hidden with opacity. REFUSED when the target contains an interactive
                       // descendant (core/interactive.ts): opacity would hide the control while
                       // it stays clickable. For non-interactive visuals (loader, skeleton,
                       // chart, empty-state art, logo).
  | 'overlay-fixed';   // single fixed layer on body (page background, settings UI).
```

Rules:
- Stand-ins are visual only. Interaction + accessibility stay with the original element.
  Stand-in hosts are `inert` + `aria-hidden="true"`; dither components that announce
  (Loader role=status, live regions) must be silenced in stand-ins.
- Controlled mirroring: read state from the original (`aria-checked`, `data-checked`,
  `data-active`, `aria-selected`, `aria-valuenow`, `disabled`, ...) via `useTargetState`.
- Everything we add is removable: turning an adapter or the master switch off restores
  the page exactly (remove hosts, classes, `data-dcf` attributes).
- All global CSS selectors must be prefixed/keyed (`.dcf-*`, `[data-dcf…]`); zero bare
  element selectors, no Tailwind preflight on the page.
- TypeScript strict; small focused files (<400 lines); no `console.log` (use
  `core/log.ts`, silent unless `settings.debug`); immutable updates for state.

### Mapping (Cloudflare → dithercn). Every dithercn component must be used somewhere.

| Group | Cloudflare thing | dithercn |
|---|---|---|
| page | app background, login/hero | all 31 backgrounds, user-selectable (default subtle: `noise-field`/`dither-gradient`), `dither-fade` on scroll edges/sticky header |
| controls | Button/LinkButton (primary, secondary, destructive, ghost) | `dither-button` |
| controls | Switch | `dither-switch` |
| controls | range input / slider | `dither-slider` |
| controls | Tabs | `dither-button` as the indicator on the tablist (shipped). `dither-tabs` exists in the Dither Lab only. |
| controls | file upload drop areas | `dropzone` (visual, underlay: the native input and text stay on top and clickable) |
| feedback | Loader spinner | `loader` |
| feedback | Skeleton | `skeleton` |
| feedback | progress / meter | `progress-bar`, `gauge` (role=meter usage quotas) |
| feedback | Empty state | `empty-state` |
| feedback | 404 / error page | `not-found` |
| charts | timeseries (ECharts canvas via React-fiber option walk; SVG path scrape for legacy) | `area-chart`, `line-chart`, `bar-chart`, `cartesian-chart` |
| charts | pie/donut, radar, heatmap, sparklines | `donut-chart`, `radar-chart`, `heatmap`, `sparkline` |
| charts | KPI tiles / stat blocks | `stat-card`, `dither-number` |
| charts | status/health rows | `uptime-bar` |
| surfaces | cards / LayerCard / panels / dialogs / popovers | `dither-card` |
| surfaces | hr / separators | `divider` |
| surfaces | user/account avatars | `avatar` |
| text | page h1/h2 | `dither-text`; `dissolve-text` on route change; `scramble-text` on sidebar hover / breadcrumbs |
| images | Cloudflare logo | `dithered-logo`; `logo-marquee` (Lab + login); |
| images | content images / screenshots | `dither-image`; `scroll-reveal-image`, `image-compare` (opt-in: hover to compare original vs dithered) |
| page | globe/map widgets | `dither-globe`, `dot-map` (also selectable backgrounds) |

Components with no natural host are still shipped and reachable through the
**Dither Lab** (a gallery overlay rendering every one of the 60+ components live), which
doubles as the visual test surface.

### UI
- Floating launcher (bottom-right, small dithered button) → settings panel (shadow root):
  master toggle, background picker with live preview, intensity/cell/animate, per-adapter
  toggles grouped with confidence badges and live match counts, "Dither Lab", "Copy
  selector census", "Reset". Keyboard: `Alt+Shift+D` toggles master.
- Userscript menu commands via `GM_registerMenuCommand` when available.

### Userscript header
`@match https://dash.cloudflare.com/*`, `@run-at document-idle`, `@noframes`,
`@grant GM_getValue`, `GM_setValue`, `GM_registerMenuCommand` (all optional at runtime —
feature-detect; must also work when pasted with `@grant none`). No `@require`, no network.

### Testing
- `fixture/` renders a realistic mock dashboard with the real `@cloudflare/kumo` package
  (sidebar, breadcrumbs, tabs, buttons of every variant, switches, checkboxes, inputs,
  range, table, banners, badges, dialogs, loader, skeletons, empty state, meter, ECharts
  timeseries via Kumo's chart component, light/dark toggle through `data-mode`) plus a
  "legacy" section (plain HTML + SVG charts + `data-testid`s) and a 404 route.
  Served by `scripts/serve-fixture.mjs` with a Cloudflare-like strict CSP
  (script nonce, `style-src 'self' 'unsafe-inline'`, and a `?csp=strict` variant without
  `'unsafe-inline'`).
- Playwright specs inject `dist/cloudflare-dither.user.js` the way a userscript manager
  does (CDP / addInitScript after load), then assert per adapter: stand-in mounted,
  original still in DOM + focusable + clickable (click changes state and stand-in
  mirrors it), zero console errors, toggling the adapter off restores the DOM exactly,
  theme flip re-colours. Screenshots to `tests/screenshots/`.
