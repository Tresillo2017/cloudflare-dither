import type { Ref } from "react";
import { DitherButton } from "@/components/dithercn/dither-button";

export interface LauncherProps {
  readonly open: boolean;
  readonly onToggle: () => void;
  readonly ref: Ref<HTMLButtonElement>;
}

/** Small quiet chip in the bottom-right corner. Dimmed at rest so it never competes with page content. */
export const Launcher = ({ open, onToggle, ref }: LauncherProps) => (
  <div className="pointer-events-none fixed bottom-2.5 right-2.5 flex flex-col items-start gap-2">
    <DitherButton
      ref={ref}
      variant="outline"
      size="sm"
      cell={2}
      className="pointer-events-auto bg-background opacity-60 transition-opacity hover:opacity-100 focus-visible:opacity-100"
      aria-expanded={open}
      aria-haspopup="dialog"
      aria-controls="dcf-settings-panel"
      aria-keyshortcuts="Alt+Shift+D"
      onClick={onToggle}
    >
      Dither
    </DitherButton>
  </div>
);
