import type { ReactNode } from "react";
import { Breadcrumbs, CloudflareLogo, Sidebar } from "@cloudflare/kumo";
import { AppSidebar } from "../pages/shell/AppSidebar";

interface AppShellProps {
  readonly children: ReactNode;
}

export function AppShell({ children }: AppShellProps): JSX.Element {
  return (
    <Sidebar.Provider defaultOpen className="min-h-screen">
      <AppSidebar />
      <div className="flex min-w-0 flex-1 flex-col">
        <header className="flex flex-wrap items-center gap-4 border-b border-kumo-line bg-kumo-base px-6 py-3">
          <Sidebar.Trigger />
          <CloudflareLogo variant="glyph" height={24} />
          <Breadcrumbs>
            <Breadcrumbs.Link href="/">Account</Breadcrumbs.Link>
            <Breadcrumbs.Link href="/">Example Corp</Breadcrumbs.Link>
            <Breadcrumbs.Current>Overview</Breadcrumbs.Current>
          </Breadcrumbs>
          <img
            src="/assets/avatar.svg"
            alt="Account avatar"
            width={32}
            height={32}
            className="ml-auto rounded-full"
          />
        </header>
        <main className="mx-auto w-full max-w-6xl space-y-6 p-6">{children}</main>
      </div>
    </Sidebar.Provider>
  );
}
