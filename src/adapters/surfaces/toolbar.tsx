import type { Adapter, AdapterContext } from "../../core";
import { CONTROL_WELL, LINE } from "../../core/visual";
import { cornerRadius } from "./geometry";

/**
 * Kumo Toolbar: a segmented group of buttons on a control-coloured well. The underlay gives it an
 * opaque base and one uniform rim. Its buttons keep their own stand-ins and stay on top.
 */
const ToolbarStandIn = ({ ctx }: { ctx: AdapterContext }) => {
  const radius = ctx.useTargetState((el) => cornerRadius(el), { attributes: ["class", "style"] });
  return (
    <div data-dcf-visual="toolbar" className="absolute inset-0">
      <div className="absolute inset-0" style={{ backgroundColor: CONTROL_WELL, borderRadius: radius }} />
      <div
        className="pointer-events-none absolute inset-0 border border-solid"
        style={{ borderColor: LINE, borderRadius: radius }}
      />
    </div>
  );
};

export const toolbarAdapter: Adapter = {
  id: "toolbar",
  label: "Toolbars",
  group: "surfaces",
  ditherComponents: [],
  selectors: [
    { selector: '[role="toolbar"][data-kumo-component="Toolbar"]', confidence: "high", source: "Kumo Toolbar root (real Settings and Workers pages)" },
  ],
  defaultEnabled: true,
  maxInstances: 20,
  match: (el) => el.closest("[data-dcf-host]") === null,
  mode: "underlay-child",
  render: (ctx) => <ToolbarStandIn ctx={ctx} />,
};
