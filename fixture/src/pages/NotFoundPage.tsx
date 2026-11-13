import { Link, Text } from "@cloudflare/kumo";

export function NotFoundPage(): JSX.Element {
  return (
    <main className="flex min-h-screen flex-col items-center justify-center gap-4 p-6 text-center">
      <p className="text-6xl font-bold text-kumo-default">404</p>
      <h1 className="text-2xl font-semibold text-kumo-default">Page not found</h1>
      <Text variant="secondary">The page you are looking for does not exist.</Text>
      <Link href="/">Back to home</Link>
    </main>
  );
}
