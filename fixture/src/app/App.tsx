import { useEffect } from "react";
import { Toasty, TooltipProvider } from "@cloudflare/kumo";
import { HomePage } from "../pages/HomePage";
import { LoginPage } from "../pages/LoginPage";
import { NotFoundPage } from "../pages/NotFoundPage";
import { LegacyPage } from "../legacy/LegacyPage";
import { ThemeToggle } from "./ThemeToggle";
import { installLinkInterceptor, useRoute, type RouteName } from "./router";

function renderRoute(route: RouteName): JSX.Element {
  switch (route) {
    case "home":
      return <HomePage />;
    case "legacy":
      return <LegacyPage />;
    case "login":
      return <LoginPage />;
    case "missing":
      return <NotFoundPage />;
  }
}

export function App(): JSX.Element {
  const route = useRoute();

  useEffect(() => installLinkInterceptor(), []);

  return (
    <Toasty>
      <TooltipProvider>
        {renderRoute(route)}
        <ThemeToggle />
      </TooltipProvider>
    </Toasty>
  );
}
