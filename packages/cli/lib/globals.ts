import { ApiClient } from "./api-client";

interface CliOptions {
  apiUrl: string;
  json: boolean;
  verbose: boolean;
}

declare global {
  var cliOptions: CliOptions;
  var apiClient: ApiClient;
}

export {};
