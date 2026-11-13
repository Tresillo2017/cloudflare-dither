import { NotFound } from "@/components/dithercn/not-found";
import type { Adapter, AdapterContext } from "../../core";
import { CELL_PX_SMALL } from "../../core/visual";

const CODE_PATTERN = /^\d{3}$/;
const HEADING_PATTERN = /not found|error|missing/i;

/** The bare "404" paragraph directly followed by a not-found heading. */
const isNotFoundCode = (el: Element): boolean => {
  if (!CODE_PATTERN.test(el.textContent?.trim() ?? "")) return false;
  const next = el.nextElementSibling;
  return next !== null && /^H[1-3]$/.test(next.tagName) && HEADING_PATTERN.test(next.textContent ?? "");
};

/** Dithered digits only. Heading, description and links stay real. */
const DIGIT_ROWS = 9;
const DIGIT_COLS = 17;
const MIN_CELL = CELL_PX_SMALL;
const MAX_CELL = 8;

/** Largest cell (CSS px) whose digit grid fits the original box. */
export const cellFor = (width: number, height: number): number => {
  const fit = Math.floor(Math.min(height / DIGIT_ROWS, width / DIGIT_COLS));
  return Math.min(MAX_CELL, Math.max(MIN_CELL, fit));
};

const NotFoundCode = ({ ctx }: { ctx: AdapterContext }) => {
  const code = ctx.useTargetState((el) => (el.textContent ?? "").trim(), { subtree: true });
  return (
    <div data-dcf-visual="not-found" className="absolute inset-0 flex items-center justify-center overflow-hidden">
      <NotFound
        code={code || "404"}
        title={null}
        description={null}
        titleAs="h2"
        cell={cellFor(ctx.rect.width, ctx.rect.height)}
        depth={2}
        animate={ctx.settings.animate}
        className="!p-0 [&>div:nth-child(2)]:hidden [&>p]:hidden"
      />
    </div>
  );
};

const notFoundCode: Adapter = {
  id: "not-found-code",
  label: "Not-found code (404 digits)",
  group: "feedback",
  ditherComponents: ["not-found"],
  selectors: [{ selector: "p", confidence: "med", source: "Fixture and Cloudflare-style 404: <p>404</p> then an h1" }],
  defaultEnabled: true,
  maxInstances: 2,
  match: isNotFoundCode,
  mode: "sibling-replace",
  render: (ctx) => <NotFoundCode ctx={ctx} />,
};

export const adapters: Adapter[] = [notFoundCode];
