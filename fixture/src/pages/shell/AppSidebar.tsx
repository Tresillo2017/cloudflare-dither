import { ChartBar, Code, Database, Gear, Globe, House, ShieldCheck } from "@phosphor-icons/react";
import { Sidebar } from "@cloudflare/kumo";
import { navigate } from "../../app/router";

const OVERVIEW_ITEMS = [
  { label: "Home", icon: House, href: "/" },
  { label: "Analytics", icon: ChartBar, href: "/" },
  { label: "Domains", icon: Globe, href: "/" },
] as const;

const BUILD_ITEMS = [
  { label: "Workers & Pages", icon: Code, href: "/" },
  { label: "Storage", icon: Database, href: "/" },
] as const;

export function AppSidebar(): JSX.Element {
  return (
    <Sidebar>
      <Sidebar.Header>
        <p className="px-2 text-sm font-medium text-kumo-default">Example Corp</p>
      </Sidebar.Header>
      <Sidebar.Content>
        <Sidebar.Group>
          <Sidebar.GroupLabel>Overview</Sidebar.GroupLabel>
          <Sidebar.Menu>
            {OVERVIEW_ITEMS.map((item) => (
              <Sidebar.MenuItem key={item.label}>
                <Sidebar.MenuButton
                  icon={<item.icon />}
                  active={item.label === "Home"}
                  onClick={() => navigate(item.href)}
                >
                  {item.label}
                </Sidebar.MenuButton>
              </Sidebar.MenuItem>
            ))}
          </Sidebar.Menu>
        </Sidebar.Group>
        <Sidebar.Group>
          <Sidebar.GroupLabel>Build</Sidebar.GroupLabel>
          <Sidebar.Menu>
            {BUILD_ITEMS.map((item) => (
              <Sidebar.MenuItem key={item.label}>
                <Sidebar.MenuButton icon={<item.icon />} onClick={() => navigate(item.href)}>
                  {item.label}
                </Sidebar.MenuButton>
              </Sidebar.MenuItem>
            ))}
          </Sidebar.Menu>
        </Sidebar.Group>
        <Sidebar.Group>
          <Sidebar.GroupLabel>Security</Sidebar.GroupLabel>
          <Sidebar.Menu>
            <Sidebar.MenuItem>
              <Sidebar.MenuButton icon={<ShieldCheck />}>WAF</Sidebar.MenuButton>
            </Sidebar.MenuItem>
            <Sidebar.MenuItem>
              <Sidebar.MenuButton icon={<Gear />}>Settings</Sidebar.MenuButton>
            </Sidebar.MenuItem>
          </Sidebar.Menu>
        </Sidebar.Group>
        <Sidebar.Group>
          <Sidebar.Menu>
            <Sidebar.MenuItem>
              <a href="/legacy" className="block px-2 py-1 text-sm text-kumo-link">
                Legacy dashboard
              </a>
            </Sidebar.MenuItem>
          </Sidebar.Menu>
        </Sidebar.Group>
      </Sidebar.Content>
    </Sidebar>
  );
}
