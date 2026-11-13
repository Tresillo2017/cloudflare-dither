import { useEffect, useRef, type KeyboardEvent } from "react";
import type { Core } from "../../core";
import { useSettings } from "../hooks";
import { Appearance } from "./appearance";
import { AdaptersSection } from "./adapters-section";
import { Actions } from "./actions";
import { trapTab } from "./focus-trap";
import { GHOST_BUTTON } from "../ui-classes";

export interface SettingsPanelProps {
  readonly core: Core;
  readonly onClose: () => void;
  readonly onOpenLab: () => void;
}

const Heading = ({ id, children }: { id: string; children: string }) => (
  <h2 id={id} className="text-base font-semibold">
    {children}
  </h2>
);

/**
 * Modal settings dialog. Focus moves in on open, Tab cycles inside, Escape closes and
 * returns focus to the launcher (done by the app shell). Renders no inline style attributes.
 */
export const SettingsPanel = ({ core, onClose, onOpenLab }: SettingsPanelProps) => {
  const settings = useSettings(core);
  const titleRef = useRef<HTMLHeadingElement>(null);
  useEffect(() => {
    titleRef.current?.focus();
  }, []);
  const onKeyDown = (event: KeyboardEvent<HTMLElement>): void => {
    if (event.key === "Escape") {
      event.stopPropagation();
      onClose();
      return;
    }
    trapTab(event);
  };
  return (
    <div className="pointer-events-auto fixed right-3 bottom-14 flex max-h-[80vh] w-[min(22rem,calc(100vw-2rem))] flex-col">
      <section
        id="dcf-settings-panel"
        role="dialog"
        aria-modal="false"
        aria-labelledby="dcf-panel-title"
        onKeyDown={onKeyDown}
        className="bg-card text-card-foreground flex max-h-[80vh] flex-col gap-5 overflow-y-auto rounded-xl border p-4 shadow-xl"
      >
        <header className="flex items-center justify-between gap-2">
          <h2 id="dcf-panel-title" ref={titleRef} tabIndex={-1} className="text-base font-semibold outline-none">
            Cloudflare Dither
          </h2>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close settings"
            className={GHOST_BUTTON}
          >
            Close
          </button>
        </header>
        <Appearance core={core} settings={settings} />
        <section aria-labelledby="dcf-adapters-heading" className="flex flex-col gap-2">
          <Heading id="dcf-adapters-heading">Components</Heading>
          <AdaptersSection core={core} />
        </section>
        <Actions core={core} onOpenLab={onOpenLab} />
      </section>
    </div>
  );
};
