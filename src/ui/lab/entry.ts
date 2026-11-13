import type { ReactNode } from "react";

/** One Lab tile. `file` is the dithercn component file (without extension) it demonstrates. */
export interface LabEntry {
  readonly file: string;
  readonly title: string;
  /** Rendered only while the tile is near the viewport. */
  readonly render: () => ReactNode;
}
