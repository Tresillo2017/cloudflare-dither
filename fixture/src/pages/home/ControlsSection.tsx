import { useState } from "react";
import {
  Button,
  ButtonGroup,
  Checkbox,
  Input,
  LinkButton,
  Radio,
  Select,
  Switch,
  Text,
} from "@cloudflare/kumo";
import { recordClick, useClickCount } from "../../app/clicks";

const BUTTON_VARIANTS = [
  "primary",
  "secondary",
  "ghost",
  "destructive",
  "secondary-destructive",
  "outline",
] as const;

const BUTTON_SIZES = ["xs", "sm", "base", "lg"] as const;

const PLAN_ITEMS = { free: "Free", pro: "Pro", business: "Business" };

export function ControlsSection(): JSX.Element {
  const clicks = useClickCount();
  const [autoRenew, setAutoRenew] = useState(true);
  const [notify, setNotify] = useState(false);
  const [plan, setPlan] = useState("pro");
  const [radio, setRadio] = useState("email");
  const [zoneName, setZoneName] = useState("");
  const [terms, setTerms] = useState(true);

  return (
    <section aria-label="Controls" className="space-y-6">
      <div className="flex flex-wrap items-center gap-4">
        <Text variant="secondary">Button clicks recorded:</Text>
        <output data-testid="click-count" className="font-mono text-kumo-default">
          Clicks: {clicks}
        </output>
      </div>

      <div className="space-y-3" data-testid="button-matrix">
        {BUTTON_VARIANTS.map((variant) => (
          <div key={variant} className="flex flex-wrap items-center gap-2">
            <span className="w-44 font-mono text-xs text-kumo-subtle">{variant}</span>
            {BUTTON_SIZES.map((size) => (
              <Button key={size} variant={variant} size={size} onClick={recordClick}>
                {variant} {size}
              </Button>
            ))}
            <Button variant={variant} disabled>
              Disabled
            </Button>
          </div>
        ))}
        <div className="flex flex-wrap items-center gap-2">
          <Button variant="primary" loading>
            Saving
          </Button>
          <Button variant="secondary" loading>
            Loading
          </Button>
          <Button variant="secondary" shape="square" aria-label="Add zone" onClick={recordClick}>
            +
          </Button>
          <Button variant="secondary" shape="circle" aria-label="Refresh" onClick={recordClick}>
            R
          </Button>
          <LinkButton href="/legacy" variant="secondary">
            Link button (internal)
          </LinkButton>
          <LinkButton href="#docs" variant="primary">
            Link button (hash)
          </LinkButton>
          <ButtonGroup>
            <Button variant="secondary" onClick={recordClick}>
              Deploy
            </Button>
            <Button variant="secondary" onClick={recordClick}>
              More
            </Button>
          </ButtonGroup>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
        <div className="space-y-4">
          <Switch
            label="Auto-renew"
            checked={autoRenew}
            onCheckedChange={(checked: boolean) => setAutoRenew(checked)}
          />
          <p data-testid="auto-renew-state" className="text-sm text-kumo-subtle">
            Auto-renew is {autoRenew ? "on" : "off"}
          </p>
          <Switch
            label="Email notifications"
            checked={notify}
            onCheckedChange={(checked: boolean) => setNotify(checked)}
          />
          <Switch label="Disabled switch (on)" checked disabled />
          <Switch label="Disabled switch (off)" checked={false} disabled />
          <Checkbox label="Accept terms" checked={terms} onCheckedChange={(checked: boolean) => setTerms(checked)} />
          <Checkbox label="Partially selected" indeterminate />
          <Checkbox label="Disabled checkbox" disabled />
        </div>
        <div className="space-y-4">
          <Radio.Group
            legend="Alert channel"
            value={radio}
            onValueChange={(value: string) => setRadio(value)}
          >
            <Radio.Item label="Email" value="email" />
            <Radio.Item label="SMS" value="sms" />
            <Radio.Item label="Push" value="push" />
          </Radio.Group>
          <Input
            label="Zone name"
            placeholder="example.com"
            description="Used as the zone identifier"
            value={zoneName}
            onChange={(event: React.ChangeEvent<HTMLInputElement>) => setZoneName(event.target.value)}
          />
          <Input label="Disabled input" placeholder="Read only" disabled />
          <Select
            label="Plan"
            value={plan}
            onValueChange={(value: string | null) => setPlan(value ?? "pro")}
            items={PLAN_ITEMS}
          />
          <label className="block text-sm text-kumo-default">
            Native text input
            <input type="text" aria-label="Native search" placeholder="Search zones" className="mt-1 block w-full rounded-md border border-solid border-kumo-line px-2 py-1" />
          </label>
        </div>
      </div>
    </section>
  );
}
