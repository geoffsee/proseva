import createClient from "openapi-fetch";
import type { Client } from "openapi-fetch";
import type { paths } from "./types.js";
import {
  createProsevaTransport,
  type ProsevaTransport,
  type ProsevaTransportOptions,
} from "./transport.js";

export type { paths, components, operations } from "./types.js";
export type { ProsevaTransport, ProsevaTransportOptions } from "./transport.js";
export type { ElectronBridge } from "./transport.js";
export { createElectronIpcFetch, createProsevaTransport } from "./transport.js";

/**
 * Configuration for the generated ProSeVA API client.
 */
export interface ProsevaClientOptions {
  /**
   * Base URL used for all requests. Defaults to `"/api"` which matches the app server.
   * Provide an absolute URL when consuming the SDK from another host.
   */
  baseUrl?: string;
  /**
   * Token (string), sync function, or async function that returns a bearer token.
   * If provided, the client injects it into the `Authorization` header on every request.
   */
  getAuthToken?:
    | (() => Promise<string | null>)
    | (() => string | null)
    | string
    | null;
  /**
   * Optional custom fetch implementation (e.g. `undici` or `node-fetch`) for non-browser environments.
   * Defaults to `globalThis.fetch`.
   */
  fetch?: typeof fetch;
  /**
   * Transport override for advanced use-cases.
   *
   * If not provided, the SDK auto-selects:
   * - Electron renderer: IPC transport (when `globalThis.electronAPI.send` exists) for relative baseUrls
   * - Browser/other: standard fetch transport
   */
  transport?: ProsevaTransport;
}

/** Typed OpenAPI client instance for the ProSeVA API. */
export type ProsevaClient = Client<paths>;

/**
 * Create a typed ProSeVA API client. Pass `getAuthToken` to auto-attach a bearer token.
 */
export function createProsevaClient(
  options: ProsevaClientOptions = {},
): ProsevaClient {
  const transport =
    options.transport ??
    createProsevaTransport({
      baseUrl: options.baseUrl,
      fetch: options.fetch,
    } satisfies ProsevaTransportOptions);

  const client = createClient<paths>({
    baseUrl: transport.baseUrl,
    fetch: transport.fetch,
  });

  const getAuth = options.getAuthToken;
  if (getAuth) {
    client.use({
      async onRequest({ request }) {
        const token =
          typeof getAuth === "function" ? await getAuth() : (getAuth ?? null);
        if (token) {
          request.headers.set("Authorization", `Bearer ${token}`);
        }
        return request;
      },
    });
  }

  return client;
}

/**
 * Convenience wrapper that builds a client with a fixed bearer token.
 */
export function createProsevaClientWithToken(
  token: string,
  options: Omit<ProsevaClientOptions, "getAuthToken"> = {},
): ProsevaClient {
  return createProsevaClient({ ...options, getAuthToken: () => token });
}
