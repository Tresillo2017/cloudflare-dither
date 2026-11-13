# Fixture: mock Cloudflare dashboard

A client-side routed SPA that renders with the **real `@cloudflare/kumo` 2.18.0** package
(Tailwind v4 + Base UI + ECharts 6). Used by the userscript's Playwright tests and as the
reference for adapter authors. Light and dark are switched with `data-mode` on `<html>`,
the way Kumo expects.

## Commands

```sh
node fixture/build.mjs              # build into fixture/dist (Tailwind -> kumo.css, esbuild -> app.js/app.css)
node scripts/serve-fixture.mjs --port 0   # prints "LISTENING <port>" on stdout; builds first if dist is missing
node fixture/verify.mjs             # Playwright: console errors, screenshots, census, click check
npx tsc -p fixture/tsconfig.json    # typecheck fixture sources
```

## Routes

| Path | Content |
|---|---|
| `/` | Account home: sidebar, header, KPI tiles, charts, usage, table, controls, loading, empty, upload, overlays, images |
| `/legacy` | Pre-Kumo markup: hashed class names, `data-testid`s, SVG charts, uptime bars, sparklines, no Kumo |
| `/login` | Hero, Kumo login form, error banner on click |
| anything else | 404 page ("404", "Page not found", back link) |

Client-side navigation: same-origin absolute links (`href="/..."`) are intercepted and use
`history.pushState`, so the page is never reloaded. `href="#..."` links are not intercepted.

## Serving and CSP

`scripts/serve-fixture.mjs` sends this CSP on HTML responses, with a fresh nonce each time:

```
script-src 'nonce-<nonce>' 'unsafe-eval'; style-src 'self' 'unsafe-inline';
img-src 'self' data: blob:; connect-src 'self'; worker-src blob:; object-src 'none'; base-uri 'self'
```

The nonce is injected into `<script nonce="...">` in `index.html`. Nothing is inline.

`?csp=strict` on an HTML route removes `'unsafe-inline'` from `style-src`.

**What strict mode covers.** Kumo's own styling is compiled into `kumo.css`, and React
`style={...}` props go through CSSOM, which the CSP allows. Verified under strict CSP:
zero console errors apart from one violation. Base UI (inside Kumo) emits
`<style data-href="base-ui-disable-scrollbar">` in `<head>`, which React 19 hoists. Strict
`style-src` blocks it, so that style is lost. Effect: Base UI's scrollbar-hiding rule is not applied.
Everything else renders.

## Element hooks for adapter authors

Verified in `fixture/census.json` (produced by `fixture/verify.mjs`).

### Kumo hooks (route `/`)

| Selector | Count | Notes |
|---|---|---|
| `[data-kumo-component="Button"]` | 46 | every variant x size, disabled, loading (`Saving`, `Loading`), icon-only (`+`, `R`), dialog/dropdown/tooltip triggers |
| `[data-kumo-component="LinkButton"]` | 2 | `href="/legacy"` and `href="#docs"` |
| `[data-kumo-component="ButtonGroup"]` | 1 | `Deploy` / `More` |
| `[data-kumo-component="Switch"]` | 5 | `role="switch"`; on, off, disabled on/off, and the simulate-loading switch (`data-checked` when on) |
| `[data-kumo-component="Checkbox"]` | 3 | `role="checkbox"`; checked, indeterminate, disabled |
| `[data-kumo-component="Radio"]` | 7 | `role="radio"` (3 items plus group parts) |
| `[data-kumo-component="Select"]` | 1 | `role="combobox"` trigger |
| `[data-kumo-component="Tabs"]` | 5 | `role="tab"`, `data-active` on the selected tab |
| `[data-kumo-component="Badge"]` | 5 | zone status badges (success, warning, neutral, error) |
| `[data-kumo-component="Breadcrumbs"]` | 3 | `nav[aria-label="breadcrumb"]` |
| `[data-kumo-component="Sidebar"]` | 8 | `aside[data-sidebar="sidebar"]`, `data-sidebar="menu-button"` and `data-active` on Home |
| `[data-kumo-component="Dialog"]` | 1 | `data-kumo-part="trigger"` opens it (`role="dialog"`, title "Delete zone?") |
| `[data-kumo-component="Popover"]` | 1 | trigger for "Open popover" |
| `[data-kumo-component="Link"]` | 5 | inline links |
| `svg[aria-label="Cloudflare logo"]` | 1 | header logo (`CloudflareLogo variant="glyph"`) |
| `[role="meter"]` | 1 | Kumo `Meter`, "Workers requests" 81% |
| `input[type="range"]` | 2 | one Kumo `Slider` (Base UI thumb `role="slider"`), one native range |
| `input[type="file"]` | 1 | dropzone, `aria-label="Certificate file"` |
| `[_echarts_instance_]` | 3 | two `TimeseriesChart` (line, bar) plus one `Chart` (donut) |

Not in the census but present: the Kumo `Loader` (`svg[role="status"][aria-label="Loading"]`,
rendered while "Simulate loading" is on), `SkeletonLine` (`.skeleton-line`), `Empty`, `Banner`
(variant classes `bg-kumo-info-tint` / `bg-kumo-warning-tint` / `bg-kumo-danger-tint`, no
data attribute), `LayerCard`, `Table` (`table.isolate`), `Toasty` toast (`data-kumo-part="surface"`).

Kumo data attributes on Base UI parts (`data-checked`, `data-disabled`, `data-indeterminate`,
`data-active`, `data-highlighted`, `data-open`) follow the same conventions as Kumo source.

### Native / generic hooks

| Selector | Route | Notes |
|---|---|---|
| `[role="status"]` (`output` element) | `/` | `[data-testid="click-count"]` text "Clicks: N" |
| `progress` | `/` | native progress, role `progressbar`, 40% |
| `hr` | `/` | 10 separators |
| `img` | `/` | `/assets/screenshot.svg` (alt "Analytics screenshot"), `/assets/hero.svg`, `/assets/avatar.svg` (header and card), same-origin |
| `[data-testid="theme-toggle"]` | all routes | plain button (not Kumo), `aria-pressed` mirrors dark mode |
| `[data-testid="tab-panel"]` | `/` | text reflects the selected range tab |
| `[data-testid="rate-limit-value"]`, `[data-testid="auto-renew-state"]`, `[data-testid="loading-state"]`, `[data-testid="dropzone"]`, `[data-testid="upload-name"]` | `/` | state mirrors for assertions |

### Legacy hooks (route `/legacy`, no Kumo)

| Selector | Notes |
|---|---|
| `[data-testid="link-homepage"]`, `link-overview`, `link-analytics`, `link-login`, `nav-main` | header and nav |
| `[data-testid="kpi-card"]` (x4) | `.k2s9x` cards with `h2` label, `.m8c3j` value, `.d6v0f[data-trend]` delta |
| `[data-testid="traffic-card"]` | contains `svg[aria-label="Requests line chart"]` (area and line `<path>`, y ticks `0`, `5k`, `10k`, `15k`, x ticks `00:00`..`24:00`), `svg[aria-label="Errors bar chart"]` (12 `<rect>`s), `svg[aria-label="Traffic by country donut"]` (`<circle>` arcs) |
| `[data-testid="uptime-card"]` | 30 `span[data-status]` bars (`up`, `degraded`, `down`) |
| `[data-testid="zones-table"]` | table with sparkline `svg polyline` per row |
| `[data-testid="button-primary"]`, `button-toggle-table` | `button`s; `legacy-click-count` shows clicks |
| `[data-testid="zones-card"]` | the table card (hidden by the toggle) |

Legacy class names are hashed (`xk3a9`, `pq72n`, `k2s9x`, ...), defined in `src/legacy/legacy.css`.

### Login and 404
- `/login`: `h1` "Log in to your account", `Input`s labelled Email and Password, a Kumo
  `Checkbox` "Remember me", Log in button (click shows `role="alert"`-like Banner "Invalid
  credentials"), `LinkButton` "Forgot password?".
- Not-found: `p` "404", `h1` "Page not found", `Link` "Back to home".

## Census

`fixture/census.json` has, per route: `dataMode`, counts for `data-kumo-component`,
`data-kumo-part`, `data-sidebar`, roles, `data-testid`, ECharts instances, canvases, SVGs,
images, input types, meters, uploads, ranges, and style tags. It contains no text content.

## Screenshots

`fixture/screenshots/<route>-light.png` and `<route>-dark.png` (full page, 1280 px wide).
Routes: `home`, `legacy`, `login`, `missing`.

## Verification (last run)

- Default CSP: zero console errors on all four routes.
- Click check: the `primary xs` button on `/` moves the counter to `Clicks: 1`.
- Strict CSP (`/?csp=strict`): one expected violation (Base UI hoisted `<style>`), see above.
