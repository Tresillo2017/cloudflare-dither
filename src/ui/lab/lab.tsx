import { useEffect, useRef, type KeyboardEvent } from "react";
import { LAB_ENTRIES } from "./manifest";
import { LabTile } from "./tile";
import { trapTab } from "../panel/focus-trap";
import { GHOST_BUTTON } from "../ui-classes";

export interface LabProps {
  readonly onClose: () => void;
}

/** Full-screen gallery of every dithercn component, virtualised by viewport. */
export const Lab = ({ onClose }: LabProps) => {
  const scrollRef = useRef<HTMLDivElement>(null);
  const closeRef = useRef<HTMLButtonElement>(null);
  useEffect(() => {
    closeRef.current?.focus();
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
    <section
      role="dialog"
      aria-modal="true"
      aria-labelledby="dcf-lab-title"
      onKeyDown={onKeyDown}
      className="bg-background text-foreground pointer-events-auto fixed inset-0 flex flex-col"
    >
      <header className="flex items-center justify-between gap-3 border-b px-4 py-3">
        <div>
          <h2 id="dcf-lab-title" className="text-base font-semibold">
            Dither Lab
          </h2>
          <p className="text-muted-foreground text-xs">
            {LAB_ENTRIES.length} dithercn components. Tiles render while visible, so only a few shaders run at once.
          </p>
        </div>
        <button
          ref={closeRef}
          type="button"
          onClick={onClose}
          className={GHOST_BUTTON}
        >
          Back to settings
        </button>
      </header>
      <div ref={scrollRef} className="flex-1 overflow-y-auto p-4" data-dcf-lab-scroll="">
        <ul className="m-0 grid list-none p-0 grid-cols-[repeat(auto-fill,minmax(min(100%,260px),1fr))] gap-4">
          {LAB_ENTRIES.map((entry) => (
            <LabTile key={entry.file} entry={entry} scroller={scrollRef} />
          ))}
        </ul>
      </div>
    </section>
  );
};
