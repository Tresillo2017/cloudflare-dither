import type { Adapter } from "../../core/types";
import { heroAdapter } from "./page-hero";
import { pageBackgroundAdapter } from "./page-background";
import { pageFadeAdapter } from "./page-fade";
import { pageGlobeAdapter, pageMapAdapter } from "./page-map-globe";

export const adapters: Adapter[] = [pageBackgroundAdapter, heroAdapter, pageFadeAdapter, pageMapAdapter, pageGlobeAdapter];
