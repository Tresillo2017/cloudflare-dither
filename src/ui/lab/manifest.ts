import { backgroundEntries } from "./manifest-backgrounds";
import { dataEntries } from "./manifest-data";
import type { LabEntry } from "./entry";
import { uiEntries } from "./manifest-ui";

/**
 * Every dithercn component file is represented here (world-land.ts is data, not a component).
 * tests/ui.spec.ts compares this list with vendor/dithercn/components/dithercn.
 */
export const LAB_ENTRIES: readonly LabEntry[] = [...backgroundEntries, ...dataEntries, ...uiEntries];
