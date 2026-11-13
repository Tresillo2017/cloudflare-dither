import { Button, Empty, LayerCard } from "@cloudflare/kumo";
import { Plus } from "@phosphor-icons/react";
import { recordClick } from "../../app/clicks";

export function EmptySection(): JSX.Element {
  return (
    <section aria-label="Empty state">
      <LayerCard>
        <LayerCard.Primary>
          <Empty
            title="No Workers yet"
            description="Deploy your first Worker to see requests here."
            commandLine="npx wrangler deploy"
            contents={
              <Button variant="primary" icon={<Plus />} onClick={recordClick}>
                Create Worker
              </Button>
            }
          />
        </LayerCard.Primary>
      </LayerCard>
    </section>
  );
}
