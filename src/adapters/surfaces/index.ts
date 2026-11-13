import type { Adapter } from "../../core/types";
import { avatarAdapter } from "./avatar";
import { badgeAdapter } from "./badge";
import { cardAdapter } from "./card";
import { dividerAdapter } from "./divider";
import { headerBandAdapter } from "./header-band";
import { listHeadAdapter } from "./list-head";
import { listRowAdapter } from "./list-row";
import { navLinkAdapter } from "./nav-link";
import { sidebarActiveAdapter } from "./sidebar-active";
import { sidebarSwitcherAdapter } from "./sidebar-switcher";
import { tableHeadAdapter, tableRowAdapter } from "./table-band";
import { toolbarAdapter } from "./toolbar";
import { popoverAdapter } from "./popover";
import { bannerAdapter } from "./banner";

/** Surfaces group: cards, rules, avatars, sidebar, header and table treatments. */
export const adapters: Adapter[] = [
  cardAdapter,
  dividerAdapter,
  avatarAdapter,
  sidebarActiveAdapter,
  headerBandAdapter,
  tableHeadAdapter,
  tableRowAdapter,
  badgeAdapter,
  listHeadAdapter,
  listRowAdapter,
  navLinkAdapter,
  sidebarSwitcherAdapter,
  toolbarAdapter,
  popoverAdapter,
  bannerAdapter,
];
