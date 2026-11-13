# Contributing

Thanks for looking. The most useful contributions right now are reports of dashboard pages that
look wrong or stay un-dithered.

## Reporting a page

1. Open the page on `dash.cloudflare.com`.
2. From your userscript manager's menu, run **Dither: copy selector census**.
3. Open an issue and paste the result, with a short description of what looks wrong.

The census lists element types and counts only. It contains no text from the page. Before posting
a screenshot, check it for account names, domains or record values you would rather keep private.

## Development

```sh
npm install
npm run build
npm run typecheck
npx playwright install chromium
node fixture/build.mjs
npm test
```

- Adapters live in `src/adapters/<group>/`. Read
  [docs/adapter-authoring.md](docs/adapter-authoring.md) first.
- Colours, cell sizes and dither recipes come from `src/core/visual.ts`. Do not hard-code them in
  an adapter. [docs/visual-spec.md](docs/visual-spec.md) explains the rules.
- Every adapter must leave the original element in the DOM, interactive and accessible, and must
  restore the page exactly when disabled. The tests check this.
- Add or update a Playwright test for any behaviour you change.
- Rebuild and commit `dist/cloudflare-dither.user.js` with your change, so the install link stays
  current.

Never commit anything from `real-dom/` or screenshots of a real account.
