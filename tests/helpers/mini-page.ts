import type { Page, Route } from "@playwright/test";

/** Self-contained page with Kumo-like markup. Served with a real CSP header via page.route. */
export const MINI_ORIGIN = "https://mini.test";
export const MINI_URL = `${MINI_ORIGIN}/`;

export type CspVariant = "default" | "strict";

const SPACER = `<div class="spacer"></div>`;

export const MINI_HTML = `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<title>Mini dashboard</title>
<link rel="stylesheet" href="${MINI_ORIGIN}/mini.css">
</head>
<body>
<main>
  <h1 id="title">Mini dashboard</h1>
  <button type="button" data-kumo-component="Button" id="plain">Plain button</button>
  <button type="button" role="switch" aria-checked="false" data-demo="underlay" id="switch">Enable</button>
  <div role="tablist"><button role="tab" aria-selected="true" data-kumo-component="Tabs">One</button><button role="tab" aria-selected="false">Two</button></div>
  <button type="button" data-demo="sibling" id="sibling">Deploy</button>
  <div data-demo="boom" id="boom">Boom target</div>
  <div id="capped-group">
    <div data-demo="capped">c1</div><div data-demo="capped">c2</div><div data-demo="capped">c3</div><div data-demo="capped">c4</div><div data-demo="capped">c5</div>
  </div>
  ${SPACER}
  <div data-demo="far" id="far">Far target</div>
</main>
</body>
</html>`;

export const MINI_CSS = `
body { font-family: sans-serif; margin: 16px; }
.spacer { height: 3000px; }
[data-demo="sibling"] { display: block; width: 160px; height: 40px; }
[data-demo="underlay"] { display: block; width: 180px; height: 40px; }
[data-demo="boom"] { display: block; width: 180px; height: 40px; }
[data-demo="far"] { display: block; width: 180px; height: 40px; }
[data-demo="capped"] { display: block; width: 180px; height: 30px; }
`;

const cspFor = (variant: CspVariant): string => {
  const style = variant === "strict" ? `style-src ${MINI_ORIGIN}` : `style-src ${MINI_ORIGIN} 'unsafe-inline'`;
  return `default-src 'self'; ${style}; img-src 'self' data: blob:; worker-src blob:`;
};

/** Routes the mini page and its stylesheet through the given CSP variant. */
export const installMiniPage = async (page: Page, variant: CspVariant = "default"): Promise<void> => {
  const csp = cspFor(variant);
  await page.route(MINI_URL, (route: Route) =>
    route.fulfill({
      status: 200,
      contentType: "text/html",
      headers: { "content-security-policy": csp },
      body: MINI_HTML,
    }),
  );
  await page.route(`${MINI_ORIGIN}/mini.css`, (route: Route) =>
    route.fulfill({ status: 200, contentType: "text/css", body: MINI_CSS }),
  );
};
