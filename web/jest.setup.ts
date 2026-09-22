import "@testing-library/jest-dom";

// jsdom doesn't provide TextEncoder/TextDecoder, but Next's server-action
// plumbing (next/cache's revalidatePath, imported transitively by any
// component that imports a "use server" actions file) needs them even just
// to load the module — before any actual request/cookies context is
// touched. Polyfilled from Node's own `util` rather than mocked, since this
// is a missing standard global, not app behaviour.
import { TextEncoder, TextDecoder } from "util";
if (typeof globalThis.TextEncoder === "undefined") {
  (globalThis as unknown as { TextEncoder: typeof TextEncoder }).TextEncoder = TextEncoder;
}
if (typeof globalThis.TextDecoder === "undefined") {
  (globalThis as unknown as { TextDecoder: typeof TextDecoder }).TextDecoder = TextDecoder;
}
