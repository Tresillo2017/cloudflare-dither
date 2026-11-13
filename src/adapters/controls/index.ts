import type { Adapter } from "../../core/types";
import { buttonAdapter } from "./button";
import { checkboxAdapter } from "./checkbox";
import { dropzoneAdapter } from "./dropzone";
import { searchFieldAdapter, selectAdapter } from "./field";
import { sliderAdapter } from "./slider";
import { switchAdapter } from "./switch";
import { tabsAdapter } from "./tabs";

/** Controls group: buttons, switches, checkboxes, fields, sliders, tabs and file drop areas. Visual stand-ins only. */
export const adapters: Adapter[] = [
  buttonAdapter,
  switchAdapter,
  checkboxAdapter,
  selectAdapter,
  searchFieldAdapter,
  sliderAdapter,
  tabsAdapter,
  dropzoneAdapter,
];
