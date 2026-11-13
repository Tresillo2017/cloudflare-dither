import { createRoot } from "react-dom/client";
import { App } from "./app/App";
import { initColorMode } from "./app/mode";

const ROOT_ELEMENT_ID = "root";

function mountFixture(): void {
  const container = document.getElementById(ROOT_ELEMENT_ID);
  if (container === null) {
    throw new Error(`Fixture mount point #${ROOT_ELEMENT_ID} is missing from index.html`);
  }
  initColorMode();
  createRoot(container).render(<App />);
}

mountFixture();
