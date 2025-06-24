import { createTwitchApiClient } from "./twitch";
import type { ApiClient } from "./types";

let apiClient: ApiClient | null = null;

export const getApiClient = (): ApiClient => {
  if (!apiClient) {
    apiClient = createTwitchApiClient();
  }
  return apiClient;
};

// For testing purposes
export const setApiClient = (client: ApiClient): void => {
  apiClient = client;
};

// Re-export types
export type { ApiClient } from "./types";
export { TwitchError } from "./types";
