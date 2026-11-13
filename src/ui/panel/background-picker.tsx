import { useState } from "react";
import { CHOICE_BUTTON } from "../ui-classes";
import type { Core, Settings } from "../../core";
import { BackgroundLayer } from "../../adapters/page/background-layer";
import { BACKGROUNDS, BACKGROUND_IDS, resolveBackground, type BackgroundId } from "../../adapters/page/backgrounds";

export interface BackgroundPickerProps {
  readonly core: Core;
  readonly settings: Settings;
}

const COST_LABEL = { cheap: "light cost", medium: "medium cost", heavy: "heavy cost" } as const;

/**
 * Lists every background by id. Only one live preview is mounted (the slot shows the hovered,
 * focused or selected background), so the WebGL context cap is never approached from here.
 */
export const BackgroundPicker = ({ core, settings }: BackgroundPickerProps) => {
  const selected = resolveBackground(settings.background);
  const [preview, setPreview] = useState<BackgroundId | null>(null);
  const shown = preview ?? selected;
  return (
    <div className="flex flex-col gap-3">
      <div className="bg-muted relative h-28 overflow-hidden rounded-lg border" data-dcf-preview="">
        <div className="absolute inset-0">
          <BackgroundLayer backgroundId={shown} opacity={1} cell={settings.cell} animate={settings.animate} visual="preview" />
        </div>
        <p className="bg-card/85 absolute bottom-2 left-2 rounded px-2 py-0.5 text-xs">
          {BACKGROUNDS[shown].label} · {COST_LABEL[BACKGROUNDS[shown].cost]}
        </p>
      </div>
      <div role="group" aria-label="Background" className="grid max-h-48 grid-cols-2 gap-1 overflow-y-auto pr-1" onMouseLeave={() => setPreview(null)}>
        {BACKGROUND_IDS.map((id) => (
          <button
            key={id}
            type="button"
            aria-pressed={id === selected}
            onMouseEnter={() => setPreview(id)}
            onFocus={() => setPreview(id)}
            onBlur={() => setPreview(null)}
            onClick={() => core.settings.update({ background: id })}
            className={CHOICE_BUTTON}
          >
            {BACKGROUNDS[id].label}
          </button>
        ))}
      </div>
    </div>
  );
};
