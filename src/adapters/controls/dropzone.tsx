import { Dropzone } from "@/components/dithercn/dropzone";
import type { Adapter, AdapterContext } from "../../core";
import { useDragOver } from "./dropzone-drag";

const DEFAULT_RADIUS_PX = 16;

const radiusOf = (el: Element): number => {
  const parsed = Number.parseFloat(getComputedStyle(el).borderTopLeftRadius);
  return Number.isFinite(parsed) ? parsed : DEFAULT_RADIUS_PX;
};

/**
 * The dithercn drop zone painted under the original drop area. It is an underlay: the
 * original label text, icon, and native file input stay visible and clickable on top.
 * The stand-in draws no text of its own (that would double the original's), and lights its
 * border while a real drag is over the original.
 */
const DropzoneStandIn = ({ ctx }: { ctx: AdapterContext }) => {
  const dragging = useDragOver(ctx.target);
  return (
    <div className="absolute inset-0">
      <Dropzone
        className="size-full"
        title=""
        description=""
        browseLabel=""
        // An empty preview replaces the centred illustration: the original's own icon and caption
        // stay on top, and the dithered illustration used to sit across them.
        preview={<span aria-hidden="true" />}
        radius={radiusOf(ctx.target)}
        cell={ctx.settings.cell}
        forceState={dragging ? "active" : undefined}
      />
    </div>
  );
};

export const dropzoneAdapter: Adapter = {
  id: "dropzone",
  label: "File drop areas",
  group: "controls",
  ditherComponents: ["dropzone"],
  selectors: [
    {
      selector: 'label:has(> input[type="file"])',
      confidence: "high",
      source: "label-wrapped file input (HTML); fixture upload section",
    },
    {
      selector: 'div:has(> input[type="file"])',
      confidence: "med",
      source: "div-wrapped file input (generic drop area)",
    },
  ],
  defaultEnabled: true,
  maxInstances: 10,
  match: (el) => el.querySelector(':scope > input[type="file"]') !== null,
  mode: "underlay-child",
  render: (ctx) => <DropzoneStandIn ctx={ctx} />,
};
