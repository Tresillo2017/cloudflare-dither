import { Link, Text } from "@cloudflare/kumo";

export function HomeFooter(): JSX.Element {
  return (
    <footer className="flex flex-wrap items-center justify-between gap-4 text-sm">
      <Text variant="secondary">Fixture dashboard. Not a Cloudflare product.</Text>
      <nav aria-label="Footer" className="flex gap-4">
        <Link href="/login">Log in</Link>
        <Link href="/missing">Broken link</Link>
      </nav>
    </footer>
  );
}
