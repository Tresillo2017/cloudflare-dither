import type { JSX as ReactJSX } from "react";

/** React 19 no longer exposes a global JSX namespace; the fixture still uses JSX.Element. */
declare global {
  namespace JSX {
    type Element = ReactJSX.Element;
  }
}

