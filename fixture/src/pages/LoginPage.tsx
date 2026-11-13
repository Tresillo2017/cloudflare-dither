import { useState } from "react";
import { Banner, Button, Checkbox, CloudflareLogo, Input, LayerCard, LinkButton } from "@cloudflare/kumo";
import { LockKey } from "@phosphor-icons/react";
import { recordClick } from "../app/clicks";

export function LoginPage(): JSX.Element {
  const [hasError, setHasError] = useState(false);
  return (
    <main className="flex min-h-screen flex-col items-center justify-center gap-6 bg-kumo-recessed p-6">
      <img src="/assets/hero.svg" alt="Login hero" className="h-40 w-full max-w-md rounded-xl object-cover" />
      <CloudflareLogo variant="full" height={48} />
      <LayerCard className="w-full max-w-sm">
        <LayerCard.Primary className="flex flex-col gap-4">
          <h1 className="text-xl font-semibold text-kumo-default">Log in to your account</h1>
          {hasError ? (
            <Banner variant="error" title="Invalid credentials" description="Check your email and password." />
          ) : null}
          <Input label="Email" type="email" placeholder="you@example.com" />
          <Input label="Password" type="password" placeholder="Password" />
          <Checkbox label="Remember me" />
          <Button
            variant="primary"
            icon={<LockKey />}
            onClick={() => {
              recordClick();
              setHasError(true);
            }}
          >
            Log in
          </Button>
          <LinkButton href="#reset" variant="ghost">
            Forgot password?
          </LinkButton>
          <Button variant="secondary" onClick={recordClick}>
            Sign in with SSO
          </Button>
        </LayerCard.Primary>
      </LayerCard>
    </main>
  );
}
