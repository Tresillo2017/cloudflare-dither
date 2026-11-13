import type { Adapter } from "../../core/types";
import { chartSvgAdapter } from "./svg-adapter";
import { echartsAdapter } from "./echarts-adapter";
import { sparklineAdapter } from "./sparkline-adapter";
import { statTileAdapter } from "./stat-adapter";
import { uptimeAdapter } from "./uptime-adapter";

export const adapters: Adapter[] = [echartsAdapter, chartSvgAdapter, statTileAdapter, uptimeAdapter, sparklineAdapter];
