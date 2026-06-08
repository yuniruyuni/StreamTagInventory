import { type ApiClient, TwitchError } from "../../client/src/api/types";
import type { ChannelInfo } from "../../client/src/model/channel";
import {
  mockCategories,
  mockChannel,
  mockTags,
  mockUser,
} from "../fixtures/mockData";

declare global {
  interface Window {
    __mockApiFailures?: {
      getUsers?: boolean;
      getChannels?: boolean;
      patchChannels?: boolean;
      postMarkers?: boolean;
    };
    __mockApiOverrides?: {
      channel?: Partial<ChannelInfo>;
      channelDelayMs?: number;
      categories?: typeof mockCategories;
    };
    __mockApiRequests?: Array<{
      method: string;
      path: string;
      language?: string;
      body?: unknown;
    }>;
  }
}

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export class MockApiClient implements ApiClient {
  async get<T>([url, _token, language]: [string, string, string]): Promise<T> {
    const urlObj = new URL(url);
    const path = urlObj.pathname;
    window.__mockApiRequests?.push({ method: "GET", path, language });

    // Mock user endpoint
    if (path.includes("/helix/users")) {
      if (window.__mockApiFailures?.getUsers) {
        throw new TwitchError("Unauthorized", 401, "Twitch users API expired");
      }
      return [mockUser] as T;
    }

    // Mock channels endpoint
    if (path.includes("/helix/channels")) {
      if (window.__mockApiOverrides?.channelDelayMs) {
        await delay(window.__mockApiOverrides.channelDelayMs);
      }
      if (window.__mockApiFailures?.getChannels) {
        throw new TwitchError(
          "Internal Server Error",
          500,
          "Channel info fetch failed",
        );
      }
      return [{ ...mockChannel, ...window.__mockApiOverrides?.channel }] as T;
    }

    // Mock categories search
    if (path.includes("/helix/search/categories")) {
      return (window.__mockApiOverrides?.categories ?? mockCategories) as T;
    }

    // Mock tags endpoint
    if (path.includes("/helix/tags/streams")) {
      return mockTags as T;
    }

    // Default empty response
    return [] as T;
  }

  async post<Arg, T>(
    [url]: [string, string, string],
    _params: { arg: Arg },
  ): Promise<T> {
    const urlObj = new URL(url);
    const path = urlObj.pathname;

    // Mock stream markers
    if (path.includes("/helix/streams/markers")) {
      if (window.__mockApiFailures?.postMarkers) {
        throw new TwitchError(
          "Bad Request",
          400,
          "Stream marker cannot be created",
        );
      }
      return { created_at: new Date().toISOString() } as T;
    }

    return {} as T;
  }

  async put<_Arg, T>(): Promise<T> {
    return {} as T;
  }

  async patch<Arg, T>(
    [url]: [string, string, string],
    params: { arg: Arg },
  ): Promise<T> {
    const urlObj = new URL(url);
    const path = urlObj.pathname;
    window.__mockApiRequests?.push({
      method: "PATCH",
      path,
      body: params?.arg,
    });

    // Mock channel update
    if (path.includes("/helix/channels")) {
      if (window.__mockApiFailures?.patchChannels) {
        throw new TwitchError(
          "Internal Server Error",
          500,
          "Channel update failed",
        );
      }
      // Return undefined for 204 No Content
      return undefined as T;
    }

    return {} as T;
  }

  async delete<_Arg, T>(): Promise<T> {
    return {} as T;
  }
}
