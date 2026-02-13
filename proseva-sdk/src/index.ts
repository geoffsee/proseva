import createClient from "openapi-fetch";
import type { Client } from "openapi-fetch";
import type { paths } from "./types.js";

export type { paths, components, operations } from "./types.js";

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
}

/** Typed OpenAPI client instance for the ProSeVA API. */
export type ProsevaClient = Client<paths>;

/**
 * Create a typed ProSeVA API client. Pass `getAuthToken` to auto-attach a bearer token.
 */
export function createProsevaClient(
  options: ProsevaClientOptions = {},
): ProsevaClient {
  const client = createClient<paths>({
    baseUrl: options.baseUrl ?? "/api",
    fetch: options.fetch ?? globalThis.fetch,
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
