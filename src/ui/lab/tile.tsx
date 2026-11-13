import { useRef, useState, type RefObject } from "react";
import { useInView } from "./use-in-view";
import type { LabEntry } from "./entry";

export interface LabTileProps {
  readonly entry: LabEntry;
  readonly scroller: RefObject<Element | null>;
}

const TILE_HEIGHT = "h-44";

/**
 * One gallery tile. The component mounts only while the tile is near the viewport, so the
 * number of live WebGL shaders stays bounded. `data-dcf-lab-state` turns to "seen" once the
 * tile has been live at least once (used by the manifest test).
 */
export const LabTile = ({ entry, scroller }: LabTileProps) => {
  const ref = useRef<HTMLLIElement>(null);
  const live = useInView(ref, scroller);
  const [seen, setSeen] = useState(false);
  if (live && !seen) setSeen(true);
  return (
    <li
      ref={ref}
      data-dcf-lab-item={entry.file}
      data-dcf-lab-state={seen ? "seen" : "idle"}
      data-dcf-lab-live={live ? "yes" : "no"}
      className="bg-card flex flex-col gap-2 overflow-hidden rounded-xl border p-3"
    >
      <h3 className="text-muted-foreground font-mono text-xs">{entry.title}</h3>
      <div className={`relative ${TILE_HEIGHT} w-full overflow-hidden rounded-lg`}>
        {live ? <div className="absolute inset-0 flex items-center justify-center p-2">{entry.render()}</div> : null}
      </div>
    </li>
  );
};
