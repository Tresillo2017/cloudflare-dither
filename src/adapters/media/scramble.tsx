import { useEffect, useState } from "react";
import { ScrambleText } from "@/components/dithercn/scramble-text";
import type { Adapter, AdapterContext } from "../../core";
import { readText, readTypography } from "./typography";

const SCRAMBLE_MS = 520;
const SCRAMBLE_STAGGER_MS = 24;
const MAX_CRUMBS = 12;

/**
 * Breadcrumb text. Idle, it is the plain text in the original colour; each hover or
 * keyboard focus replays a scramble (the key changes, so the component remounts).
 */
const ScrambleStandIn = ({ ctx }: { ctx: AdapterContext }) => {
  const text = ctx.useTargetState(readText, { subtree: true });
  const typography = ctx.useTargetState(readTypography, { attributes: ["class", "style"] });
  const { hover, focusVisible } = ctx.useTargetPseudo();
  const [runs, setRuns] = useState(0);
  const active = hover || focusVisible;

  useEffect(() => {
    if (active) setRuns((count) => count + 1);
  }, [active]);

  return (
    <div data-dcf-visual="scramble" className="flex size-full items-center" style={typography}>
      {runs === 0 ? (
        <span className="min-w-0 truncate">{text}</span>
      ) : (
        <ScrambleText key={runs} as="span" trigger="mount" color="ink" duration={SCRAMBLE_MS} stagger={SCRAMBLE_STAGGER_MS} caret="none" className="min-w-0 truncate">
          {text}
        </ScrambleText>
      )}
    </div>
  );
};

export const scrambleBreadcrumbAdapter: Adapter = {
  id: "scramble-breadcrumb",
  label: "Breadcrumb scramble on hover",
  group: "text",
  ditherComponents: ["scramble-text"],
  selectors: [
    { selector: 'nav[aria-label="breadcrumb"] a', confidence: "high", source: "Kumo Breadcrumbs.Link inside nav[aria-label=breadcrumb]" },
    { selector: '[data-kumo-component="Breadcrumbs"] a', confidence: "med", source: "Kumo Breadcrumbs root" },
  ],
  // Visual text replacement on navigation: opt-in.
  defaultEnabled: false,
  maxInstances: MAX_CRUMBS,
  match: (el) => el.closest("[data-dcf-host]") === null && readText(el).length > 0,
  mode: "sibling-replace",
  render: (ctx) => <ScrambleStandIn ctx={ctx} />,
};
