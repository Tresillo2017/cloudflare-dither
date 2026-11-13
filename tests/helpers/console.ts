import type { Page } from "@playwright/test";

export interface ConsoleErrors {
  readonly messages: readonly string[];
}

/** Collects console errors and uncaught page errors from the moment of the call. */
export const collectConsoleErrors = (page: Page): ConsoleErrors => {
  const messages: string[] = [];
  page.on("console", (message) => {
    if (message.type() === "error") messages.push(message.text());
  });
  page.on("pageerror", (error) => messages.push(`pageerror: ${error.message}`));
  return { messages };
};
