import { useState } from "react";
import { Meter, Slider, Text } from "@cloudflare/kumo";

export function UsageSection(): JSX.Element {
  const [limit, setLimit] = useState(40);
  return (
    <section aria-label="Usage" className="grid grid-cols-1 gap-6 md:grid-cols-2">
      <div className="space-y-4">
        <Meter label="Workers requests" value={81} max={100} />
        <div className="space-y-1">
          <Text variant="secondary">Storage usage (native progress)</Text>
          <progress value={40} max={100} className="w-full" aria-label="Storage usage">
            40%
          </progress>
        </div>
      </div>
      <div className="space-y-4">
        <Slider label="Rate limit" value={limit} onValueChange={(value) => setLimit(Array.isArray(value) ? value[0] : Number(value))} />
        <p data-testid="rate-limit-value" className="text-sm text-kumo-subtle">Rate limit: {limit}</p>
        <label className="block text-sm text-kumo-default">
          Native range
          <input type="range" min={0} max={100} defaultValue={25} className="mt-2 block w-full" />
        </label>
      </div>
    </section>
  );
}
