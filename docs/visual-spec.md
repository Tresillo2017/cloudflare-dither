# Visual spec

Two things matter: *coverage* (every element type on a real
page gets a dither treatment) and *coherence* (one system, nothing glitchy).

Reference for the look: https://dithercn.dev and the component sources in
`vendor/dithercn`. Ordered Bayer dither, crisp pixels, restrained.

## Ground truth about the real dashboard (verified live, 2026-11-11)

- Whole app is Kumo. `data-kumo-component` values seen: Button, LinkButton, Link, Badge,
  Sidebar, Popover, Dialog, Select, Combobox, Checkbox, Switch, Tabs, Toolbar,
  Toolbar.Button, Breadcrumbs. `data-kumo-part`: menu-button, menu-button-link,
  menu-sub-button, menu-sub-button-link, trigger. No legacy `c_*` hashed-class UI in the
  pages sampled; no SVG charts.
- Dark mode = `html.dark-mode` class **and** `html[data-mode="dark"]`; `color-scheme: dark`.
  Light = neither. (localStorage `dark-mode` = on/off/system.) The owner uses DARK.
- Layout hooks: `#react-app`, `aside[data-sidebar="sidebar"]`,
  `[data-sidebar="content-container"]`, `header.bg-kumo-canvas`,
  `[data-stratus-medic-route-content]` (route content root), `footer`,
  `[data-sentry-component="…"]` on many app components (e.g. `ChartCardStandard`,
  `TileFrame`, `MeasuredStatChartDisplay`, `DashboardHeader`, `ShortcutColumnFrame`,
  `ShortcutsSection`, `SearchInput`, `AccountHomeBanners`, `Kbd`). These are stable,
  human-named hooks — prefer them over utility-class matching.
- Charts are **ECharts canvas**: `div[_echarts_instance_]`. The React fiber of that div's
  parent chain has, at depth 1, a `Chart` component whose prop is **`options`** (plural;
  also accept `option`) = the ECharts option (`series[].type/data`, `xAxis`, `yAxis`).
  Home stat tiles: at depth ~4 a component with props `stat`, `previously`, `title`,
  `sparklineData: number[]`, `sparklineTimestamps: number[]`, `formatter` (fn),
  `isPercentage`. Series data is `[[index, value|null], …]` on a `type: "value"` x axis.
  Real captures: `real-dom/*.charts.json`.
- CSP (enforced): `script-src 'nonce-…' 'unsafe-eval' 'strict-dynamic' https:` only — no
  `style-src` restriction. `window.trustedTypes` exists but is not enforced.
- Real page dumps for offline replay live in `real-dom/` (git-ignored: they hold account data).
  See `scripts/real-shots.mjs` and `tests/real/`.

## One system

All values live in ONE module (`src/core/visual.ts`) and every adapter imports from it.

- Cell: **3px** everywhere (2px only inside elements shorter than 20px). Matrix `bayer4`.
- Colour: taken from Kumo tokens at runtime — ink = `--text-color-kumo-default`,
  paper = `--color-kumo-base`/`canvas`, **primary = `--color-kumo-brand` (Cloudflare
  blue, never purple)**, danger = `--color-kumo-danger`, success/warning likewise,
  lines = `--color-kumo-line`. Chart series use the dither named palette but series 1 is
  the brand blue (and Cloudflare orange `#f6821f` as accent 2).
- **Never dither behind or through text.** Text keeps a solid backing. Dither lives in:
  fills of bars/areas/tracks/pills, rims and edges, bands (headers, active rows), shade
  along the bottom of buttons, empty gutters, illustration areas.
- Rims are complete and uniform (one treatment on all four sides). No half-dashed,
  half-dotted borders. No "marching ants" except the dropzone.
- Nothing may look disabled, clipped, offset or doubled. On/off, selected/unselected and
  enabled/disabled must be *more* distinguishable than or equal to the original.
- Dark theme is the primary target; light must also hold up.

## Coverage targets (every one must be visibly dithered on the real pages)

| Real element | Treatment |
|---|---|
| Page canvas | one coherent, calm dithered field (e.g. dither-gradient/glow from a corner) visible in gutters and behind header; continuous across sidebar edge; never dot debris |
| Sidebar | active item = dither fill band (keep), hover = lighter dither band, group separators = dither divider, "New/Beta" badges = dithered pill |
| Header | Ask AI / Support / icon buttons = dither-button surface; account switcher rim |
| h1 hero title | dither-text ONLY if every glyph stays fully legible at its real size; otherwise leave text solid and add a dithered accent (underline/divider/glow) |
| Search inputs / text inputs / selects / combobox triggers | dithered rim + focus state; solid field interior |
| Buttons (all Kumo variants incl. icon-only "…", ghost, LinkButton, Toolbar.Button) | dither-button lit surface: shade dithered up from the bottom, highlight from the top; brand blue for primary; icon-only/ghost get surface on hover + subtle rim, not a white dashed outline |
| Switch | dither-switch track fill: ON = brand-blue dither clearly filled, OFF = empty track; thumb solid |
| Checkbox / radio | dithered checked fill, solid mark |
| Tabs | dither-tabs indicator on the active tab |
| Badges / count pills / status chips / Kbd | dithered fill by status colour, solid text |
| Cards / TileFrame / ChartCard / panels / popovers / dialogs | dither-card: uniform rim + soft dithered corner glow that stays out from under text |
| List rows (Domains / Workers / Recents, tables, DNS rows) | row hover dither band, dither dividers between rows, header band dithered |
| ECharts line/area/bar charts | replaced by dithercn area/line/bar chart fed from the fiber `options`; same box, same data, y ticks, no overlapping labels |
| Stat tiles (value + delta + sparkline) | dithered area under the sparkline (stat-card/sparkline), delta colour kept; number may roll via dither-number once |
| Illustrations / images | dither-image / dithered-logo (Cloudflare logo in sidebar header) |
| Loaders / skeletons / progress / meters / empty states / 404 | dithercn loader / skeleton / progress-bar / gauge / empty-state / not-found |
| Launcher | tiny dithered chip, bottom-left of the sidebar footer area or draggable; must not cover content |
