import { DitherSlider } from "@/components/dithercn/dither-slider";
import { DitherSwitch } from "@/components/dithercn/dither-switch";
import type { Core, Settings } from "../../core";
import { BackgroundPicker } from "./background-picker";

export interface AppearanceProps {
  readonly core: Core;
  readonly settings: Settings;
}

const SectionTitle = ({ children }: { children: string }) => (
  <h3 className="text-muted-foreground mb-2 text-xs font-medium tracking-wide uppercase">{children}</h3>
);

/** Master switch, background, intensity, cell size and motion. */
export const Appearance = ({ core, settings }: AppearanceProps) => (
  <div className="flex flex-col gap-5">
    <div className="flex items-center justify-between gap-3">
      <div>
        <p className="text-sm font-medium">Dither on</p>
        <p className="text-muted-foreground text-xs">Turning this off restores the original page.</p>
      </div>
      <DitherSwitch
        aria-label="Dither on"
        checked={settings.master}
        onCheckedChange={(on) => core.settings.update({ master: on })}
        cell={2}
      />
    </div>

    <section aria-labelledby="dcf-bg-heading">
      <SectionTitle>Background</SectionTitle>
      <BackgroundPicker core={core} settings={settings} />
    </section>

    <section aria-labelledby="dcf-look-heading" className="flex flex-col gap-4">
      <SectionTitle>Look</SectionTitle>
      <DitherSlider
        label="Intensity"
        min={0}
        max={1}
        step={0.05}
        value={[settings.intensity]}
        onValueChange={(values) => core.settings.update({ intensity: values[0] ?? settings.intensity })}
        format={{ maximumFractionDigits: 2 }}
        cell={2}
      />
      <DitherSlider
        label="Cell size"
        min={1}
        max={16}
        step={1}
        value={[settings.cell]}
        unit=" px"
        onValueChange={(values) => core.settings.update({ cell: values[0] ?? settings.cell })}
        format={{ maximumFractionDigits: 0 }}
        cell={2}
      />
      <div className="flex items-center justify-between gap-3">
        <div>
          <p className="text-sm font-medium">Animate</p>
          <p className="text-muted-foreground text-xs">Heavy shaders stay still. Reduced motion always wins.</p>
        </div>
        <DitherSwitch
          aria-label="Animate backgrounds"
          checked={settings.animate}
          onCheckedChange={(on) => core.settings.update({ animate: on })}
          cell={2}
        />
      </div>
    </section>
  </div>
);
