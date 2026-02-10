import createClient from "openapi-fetch";
import type { paths } from "./api-types";

export interface ApiClientConfig {
  baseUrl: string;
  verbose?: boolean;
}

/**
 * API client wrapper with error handling
 */
export class ApiClient {
  private client: ReturnType<typeof createClient<paths>>;
  private verbose: boolean;

  constructor(config: ApiClientConfig) {
    this.verbose = config.verbose || false;
    this.client = createClient<paths>({
      baseUrl: config.baseUrl,
    });
  }

  /**
   * Make a GET request
   */
  async get<T extends keyof paths>(
    path: T,
    options?: Parameters<ReturnType<typeof createClient<paths>>["GET"]>[1],
  ) {
    if (this.verbose) {
      console.error(`→ GET ${path}`);
    }

    const { data, error, response } = await this.client.GET(path, options);

    if (this.verbose) {
      console.error(`← ${response.status} ${response.statusText}`);
    }

    if (error) {
      throw new ApiError(response.status, error);
    }

    return data;
  }

  /**
   * Make a POST request
   */
  async post<T extends keyof paths>(
    path: T,
    options?: Parameters<ReturnType<typeof createClient<paths>>["POST"]>[1],
  ) {
    if (this.verbose) {
      console.error(`→ POST ${path}`);
    }

    const { data, error, response } = await this.client.POST(path, options);

    if (this.verbose) {
      console.error(`← ${response.status} ${response.statusText}`);
    }

    if (error) {
      throw new ApiError(response.status, error);
    }

    return data;
  }

  /**
   * Make a PATCH request
   */
  async patch<T extends keyof paths>(
    path: T,
    options?: Parameters<ReturnType<typeof createClient<paths>>["PATCH"]>[1],
  ) {
    if (this.verbose) {
      console.error(`→ PATCH ${path}`);
    }

    const { data, error, response } = await this.client.PATCH(path, options);

    if (this.verbose) {
      console.error(`← ${response.status} ${response.statusText}`);
    }

    if (error) {
      throw new ApiError(response.status, error);
    }

    return data;
  }

  /**
   * Make a DELETE request
   */
  async delete<T extends keyof paths>(
    path: T,
    options?: Parameters<ReturnType<typeof createClient<paths>>["DELETE"]>[1],
  ) {
    if (this.verbose) {
      console.error(`→ DELETE ${path}`);
    }

    const { data, error, response } = await this.client.DELETE(path, options);

    if (this.verbose) {
      console.error(`← ${response.status} ${response.statusText}`);
    }

    if (error) {
      throw new ApiError(response.status, error);
    }

    return data;
  }
}

/**
 * API error class
 */
export class ApiError extends Error {
  constructor(
    public status: number,
    public body: unknown,
  ) {
    super(`API error ${status}: ${JSON.stringify(body)}`);
    this.name = "ApiError";
  }

  /**
   * Check if error is a network error (cannot connect to server)
   */
  isNetworkError(): boolean {
    return this.status === 0;
  }

  /**
   * Check if error is a not found error
   */
  isNotFound(): boolean {
    return this.status === 404;
  }

  /**
   * Check if error is a validation error
   */
  isValidationError(): boolean {
    return this.status === 400;
  }

  /**
   * Check if error is a server error
   */
  isServerError(): boolean {
    return this.status >= 500;
  }
}
