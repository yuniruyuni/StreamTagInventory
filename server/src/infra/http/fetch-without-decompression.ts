type Fetch = typeof globalThis.fetch;

/** Temporary containment for Bun's unpatched Brotli decoder (CVE-2026-111497).
 * Request identity and disable decoding before any response bytes are processed.
 * Headers alone are insufficient: an upstream can ignore Accept-Encoding.
 */
export function withoutResponseDecompression(nativeFetch: Fetch): Fetch {
  const guardedFetch = (async (input, init) => {
    const headers = new Headers(
      init?.headers ?? (input instanceof Request ? input.headers : undefined),
    );
    headers.set("accept-encoding", "identity");
    const response = await nativeFetch(input, {
      ...init,
      headers,
      decompress: false,
    });
    const encoding = response.headers
      .get("content-encoding")
      ?.trim()
      .toLowerCase();
    if (encoding && encoding !== "identity") {
      await response.body?.cancel().catch(() => {});
      throw new TypeError(
        "Compressed HTTP responses are temporarily disabled (CVE-2026-111497)",
      );
    }
    return response;
  }) as Fetch;
  guardedFetch.preconnect = nativeFetch.preconnect;
  return guardedFetch;
}
