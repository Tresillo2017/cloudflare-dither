import type { ReactNode } from "react";
import { BackgroundLayer } from "../../adapters/page/background-layer";
import { BACKGROUND_IDS, type BackgroundId } from "../../adapters/page/backgrounds";
import type { LabEntry } from "./entry";

/** Renders a registry background inside the tile. Each id is also a component file name. */
const backgroundTile = (id: BackgroundId): ReactNode => (
  <div className="relative h-full w-full">
    <BackgroundLayer backgroundId={id} opacity={1} cell={3} animate visual={`lab-${id}`} />
  </div>
);

export const backgroundEntries: readonly LabEntry[] = BACKGROUND_IDS.map((id) => ({
  file: id,
  title: `Background: ${id}`,
  render: () => backgroundTile(id),
}));
