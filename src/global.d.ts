interface Window {
  E2E_TEST_MODE?: boolean;
  E2E_TEST_TOKEN?: string;
  E2E_MOCK_API?: (url: string, init: RequestInit) => unknown;
  mockUser?: unknown;
  mockChannel?: unknown;
  mockCategories?: unknown;
  mockTags?: unknown;
}