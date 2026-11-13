import { LayerCard, Text } from "@cloudflare/kumo";

interface KpiTile {
  readonly label: string;
  readonly value: string;
  readonly delta: string;
  readonly direction: "up" | "down" | "flat";
}

const KPI_TILES: readonly KpiTile[] = [
  { label: "Requests", value: "1,284,552", delta: "+4.2%", direction: "up" },
  { label: "Bandwidth", value: "8.4 TB", delta: "-1.1%", direction: "down" },
  { label: "Threats blocked", value: "12,904", delta: "+18.0%", direction: "up" },
  { label: "Uptime", value: "99.98%", delta: "0.0%", direction: "flat" },
];

const DELTA_CLASS: Readonly<Record<KpiTile["direction"], string>> = {
  up: "text-kumo-success",
  down: "text-kumo-danger",
  flat: "text-kumo-subtle",
};

export function KpiSection(): JSX.Element {
  return (
    <section aria-label="Key metrics" className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
      {KPI_TILES.map((tile) => (
        <LayerCard key={tile.label}>
          <LayerCard.Primary className="flex flex-col gap-1">
            <Text variant="secondary">{tile.label}</Text>
            <span className="text-3xl font-semibold tabular-nums text-kumo-default">{tile.value}</span>
            <span data-delta={tile.direction} className={`text-sm font-medium ${DELTA_CLASS[tile.direction]}`}>
              {tile.delta} vs previous period
            </span>
          </LayerCard.Primary>
        </LayerCard>
      ))}
    </section>
  );
}
