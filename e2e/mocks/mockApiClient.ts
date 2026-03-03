import type { ApiClient } from "../../src/api/types";
import {
  mockCategories,
  mockChannel,
  mockTags,
  mockUser,
} from "../fixtures/mockData";

export class MockApiClient implements ApiClient {
  async get<T>([url]: [string, string, string]): Promise<T> {
    const urlObj = new URL(url);
    const path = urlObj.pathname;

    // Mock user endpoint
    if (path.includes("/helix/users")) {
      return [mockUser] as T;
    }

    // Mock channels endpoint
    if (path.includes("/helix/channels")) {
      return [mockChannel] as T;
    }

    // Mock categories search
    if (path.includes("/helix/search/categories")) {
      return mockCategories as T;
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
      return { created_at: new Date().toISOString() } as T;
    }

    return {} as T;
  }

  async put<_Arg, T>(): Promise<T> {
    return {} as T;
  }

  async patch<_Arg, T>([url]: [string, string, string]): Promise<T> {
    const urlObj = new URL(url);
    const path = urlObj.pathname;

    // Mock channel update
    if (path.includes("/helix/channels")) {
      // Return undefined for 204 No Content
      return undefined as T;
    }

    return {} as T;
  }

  async delete<_Arg, T>(): Promise<T> {
    return {} as T;
  }
}
