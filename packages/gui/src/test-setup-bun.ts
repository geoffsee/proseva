import { Window } from "happy-dom";
import "@testing-library/jest-dom";

const window = new Window();

for (const key of Object.getOwnPropertyNames(window)) {
  if (!(key in globalThis)) {
    try {
      // @ts-expect-error - assigning happy-dom globals
      globalThis[key] = window[key];
    } catch {
      // skip non-configurable
    }
  }
}

// @ts-expect-error - essential globals
globalThis.document = window.document;
// @ts-expect-error - essential globals
globalThis.window = window;
// @ts-expect-error - essential globals
globalThis.navigator = window.navigator;
// @ts-expect-error - essential globals
globalThis.HTMLElement = window.HTMLElement;
