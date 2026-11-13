import { DitherSwitch } from "@/components/dithercn/dither-switch";
import { DitherTabs, DitherTabsContent, DitherTabsList, DitherTabsTrigger } from "@/components/dithercn/dither-tabs";
import type { AdapterGroup, AdapterInfo, Core, Settings } from "../../core";
import { confidenceOf, GROUP_LABEL, GROUP_ORDER } from "../adapter-meta";
import { useAdapterRows, useSettings } from "../hooks";
import { useState } from "react";

export interface AdaptersSectionProps {
  readonly core: Core;
}

const CONFIDENCE_TONE = {
  high: "bg-success/15 text-success",
  med: "bg-warning/15 text-warning",
  low: "bg-destructive/15 text-destructive",
} as const;

/**
 * The switch is controlled from the settings store, not from the polled registry snapshot. The
 * snapshot refreshes once a second, so a click inside that window used to read a stale `checked`
 * and write the same value back (the flaky "second click does nothing" test).
 */
const isRowEnabled = (settings: Settings, row: AdapterInfo): boolean =>
  settings.master && (settings.adapters[row.id] ?? row.defaultEnabled);

const groupsWithRows = (rows: readonly AdapterInfo[]): AdapterGroup[] =>
  GROUP_ORDER.filter((group) => rows.some((row) => row.group === group));

/**
 * Toggling an adapter on must also rescan: targets already in the page are not matched
 * again otherwise.
 */
const setAdapterEnabledAndRescan = (core: Core, adapterId: string, enabled: boolean): void => {
  core.settings.setAdapterEnabled(adapterId, enabled);
  core.registry.rescan();
};

const AdapterRow = ({ core, row, enabled }: { core: Core; row: AdapterInfo; enabled: boolean }) => {
  const confidence = confidenceOf(row.id);
  const errorId = `dcf-err-${row.id}`;
  return (
    <li className="flex flex-col gap-1 border-b py-2.5 last:border-b-0">
      <div className="flex items-center justify-between gap-3">
        <div className="flex min-w-0 flex-col">
          <span className="truncate text-sm font-medium">{row.label}</span>
          <span className="text-muted-foreground text-xs">
            {row.ditherComponents.join(", ")}
          </span>
        </div>
        <DitherSwitch
          aria-label={`Enable ${row.label}`}
          aria-describedby={row.error ? errorId : undefined}
          checked={enabled}
          onCheckedChange={(on) => setAdapterEnabledAndRescan(core, row.id, on)}
          cell={2}
          size="sm"
        />
      </div>
      <div className="text-muted-foreground flex flex-wrap items-center gap-2 text-xs">
        <span className={`rounded px-1.5 py-0.5 ${CONFIDENCE_TONE[confidence]}`}>{confidence} confidence</span>
        <span>
          {row.mounted} of {row.matched} matched mounted
          {row.maxInstances !== null ? ` (cap ${row.maxInstances})` : ""}
        </span>
        {row.defaultEnabled ? null : <span>off by default</span>}
      </div>
      {row.error ? (
        <p id={errorId} role="status" className="text-destructive text-xs">
          Last error: {row.error}
        </p>
      ) : null}
    </li>
  );
};

/** Per-adapter toggles grouped with dither-tabs. Counts refresh while the panel is open. */
export const AdaptersSection = ({ core }: AdaptersSectionProps) => {
  const rows = useAdapterRows(core);
  const settings = useSettings(core);
  const groups = groupsWithRows(rows);
  const [active, setActive] = useState<string>(groups[0] ?? "page");
  return (
    <DitherTabs value={active} onValueChange={setActive} variant="pill" cell={2} className="flex flex-col gap-3">
      <DitherTabsList aria-label="Adapter groups" className="flex flex-wrap gap-1">
        {groups.map((group) => (
          <DitherTabsTrigger key={group} value={group} className="text-xs">
            {GROUP_LABEL[group]}
          </DitherTabsTrigger>
        ))}
      </DitherTabsList>
      {groups.map((group) => (
        <DitherTabsContent key={group} value={group}>
          <ul className="m-0 flex list-none flex-col p-0">
            {rows
              .filter((row) => row.group === group)
              .map((row) => (
                <AdapterRow key={row.id} core={core} row={row} enabled={isRowEnabled(settings, row)} />
              ))}
          </ul>
        </DitherTabsContent>
      ))}
    </DitherTabs>
  );
};
