import { Badge, Button, LayerCard, Table } from "@cloudflare/kumo";
import { ZONES, type ZoneRow } from "../../data/fixtures";
import { recordClick } from "../../app/clicks";

const STATUS_BADGE_VARIANT: Readonly<Record<ZoneRow["status"], "success" | "warning" | "neutral" | "error">> = {
  Active: "success",
  Pending: "warning",
  Paused: "neutral",
  Error: "error",
};

export function ZonesSection(): JSX.Element {
  return (
    <section aria-label="Zones">
      <LayerCard className="p-0">
        <Table>
          <Table.Header>
            <Table.Row>
              <Table.Head>Zone</Table.Head>
              <Table.Head>Plan</Table.Head>
              <Table.Head>Requests</Table.Head>
              <Table.Head>Status</Table.Head>
              <Table.Head>Actions</Table.Head>
            </Table.Row>
          </Table.Header>
          <Table.Body>
            {ZONES.map((zone) => (
              <Table.Row key={zone.id}>
                <Table.Cell>{zone.name}</Table.Cell>
                <Table.Cell>{zone.plan}</Table.Cell>
                <Table.Cell>{zone.requests}</Table.Cell>
                <Table.Cell>
                  <Badge variant={STATUS_BADGE_VARIANT[zone.status]}>{zone.status}</Badge>
                </Table.Cell>
                <Table.Cell>
                  <Button size="xs" variant="ghost" onClick={recordClick}>
                    Manage {zone.name}
                  </Button>
                </Table.Cell>
              </Table.Row>
            ))}
          </Table.Body>
        </Table>
      </LayerCard>
    </section>
  );
}
