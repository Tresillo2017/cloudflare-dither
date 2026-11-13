import type { Adapter } from "../core/types";
import { adapters as controls } from "./controls";
import { adapters as feedback } from "./feedback";
import { adapters as charts } from "./charts";
import { adapters as surfaces } from "./surfaces";
import { adapters as media } from "./media";
import { adapters as page } from "./page";

/** Every production adapter. Group folders own their own lists. */
export const adapters: Adapter[] = [...controls, ...feedback, ...charts, ...surfaces, ...media, ...page];
