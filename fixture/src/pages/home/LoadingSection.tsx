import { useState } from "react";
import { LayerCard, Loader, SkeletonLine, Switch, Text } from "@cloudflare/kumo";

const SKELETON_KEYS = ["line-1", "line-2", "line-3"] as const;

export function LoadingSection(): JSX.Element {
  const [isLoading, setIsLoading] = useState(false);
  return (
    <section aria-label="Loading states" className="space-y-4">
      <Switch
        label="Simulate loading"
        checked={isLoading}
        onCheckedChange={(checked: boolean) => setIsLoading(checked)}
      />
      <LayerCard>
        <LayerCard.Primary>
          {isLoading ? (
            <div data-testid="loading-state" className="flex items-center gap-3">
              <Loader size="base" />
              <div className="flex-1 space-y-2">
                {SKELETON_KEYS.map((key) => (
                  <SkeletonLine key={key} />
                ))}
              </div>
            </div>
          ) : (
            <Text>Analytics are up to date.</Text>
          )}
        </LayerCard.Primary>
      </LayerCard>
    </section>
  );
}
