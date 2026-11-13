import type { StylesApi } from "../core/styles";
import type { ThemeName } from "../core/theme";

export interface UiHost {
  readonly mount: HTMLElement;
  readonly root: ShadowRoot;
  setTheme(theme: ThemeName): void;
  remove(): void;
}

/** Above the page, below nothing we own. Only interactive children take pointer events. */
const HOST_STYLE = "position:fixed;inset:0;pointer-events:none;z-index:2147483600;";

/**
 * The settings UI's own host. It is not a stand-in: it is not inert, not aria-hidden and
 * never removed by the master switch. Its light-DOM attributes are static apart from the theme.
 */
export const createUiHost = (styles: StylesApi, theme: ThemeName): UiHost => {
  const host = document.createElement("div");
  host.setAttribute("data-dcf-ui", "root");
  host.setAttribute("data-dcf-theme", theme);
  host.style.cssText = HOST_STYLE;
  const root = host.attachShadow({ mode: "open" });
  styles.adoptInto(root);
  const mount = document.createElement("div");
  mount.setAttribute("data-dcf-ui-mount", "");
  mount.setAttribute("data-dcf-theme", theme);
  root.append(mount);
  document.body.append(host);
  return {
    mount,
    root,
    setTheme: (next) => {
      host.setAttribute("data-dcf-theme", next);
      mount.setAttribute("data-dcf-theme", next);
    },
    remove: () => host.remove(),
  };
};
