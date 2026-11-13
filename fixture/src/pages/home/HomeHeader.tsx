import { useState } from "react";
import { Banner, Tabs, Text } from "@cloudflare/kumo";

const RANGE_TABS = [
  { value: "24h", label: "24 hours" },
  { value: "7d", label: "7 days" },
  { value: "30d", label: "30 days" },
];

export function HomeHeader(): JSX.Element {
  const [range, setRange] = useState("24h");
  return (
    <section className="space-y-4">
      <Banner variant="default" title="Scheduled maintenance" description="Analytics may lag by 5 minutes on Nov 14." />
      <Banner variant="alert" title="Plan limit approaching" description="You have used 81% of your Workers requests." />
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold text-kumo-default">Account home</h1>
          <Text variant="secondary">Example Corp overview for the last period.</Text>
        </div>
        <Tabs
          tabs={RANGE_TABS}
          value={range}
          onValueChange={(value: string) => setRange(value)}
        />
      </div>
      <p data-testid="tab-panel" className="text-sm text-kumo-subtle">
        Showing data for the last {RANGE_TABS.find((tab) => tab.value === range)?.label ?? range}.
      </p>
    </section>
  );
}
