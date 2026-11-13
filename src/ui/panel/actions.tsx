import { useState } from "react";
import { DitherButton } from "@/components/dithercn/dither-button";
import type { Core } from "../../core";

export interface ActionsProps {
  readonly core: Core;
  readonly onOpenLab: () => void;
}

/** Census copy, Dither Lab entry point and Reset. The status line is a polite live region. */
export const Actions = ({ core, onOpenLab }: ActionsProps) => {
  const [status, setStatus] = useState("");
  const copyCensus = async (): Promise<void> => {
    const copied = await core.diagnostics.copy();
    setStatus(copied ? "Selector census copied to the clipboard." : "Copy failed. Use the Dither menu command instead.");
  };
  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-wrap gap-2">
        <DitherButton variant="outline" size="sm" cell={2} onClick={onOpenLab}>
          Dither Lab
        </DitherButton>
        <DitherButton variant="outline" size="sm" cell={2} onClick={() => void copyCensus()}>
          Copy selector census
        </DitherButton>
        <DitherButton
          variant="outline"
          size="sm"
          cell={2}
          onClick={() => {
            core.settings.reset();
            setStatus("Settings reset to defaults.");
          }}
        >
          Reset
        </DitherButton>
      </div>
      <p role="status" aria-live="polite" className="text-muted-foreground min-h-4 text-xs">
        {status}
      </p>
    </div>
  );
};
