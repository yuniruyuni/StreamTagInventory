import { afterAll, describe, expect, test } from "bun:test";
import { brotliCompressSync, gzipSync } from "node:zlib";
import { withoutResponseDecompression } from "./fetch-without-decompression";

const nativeFetch = globalThis.fetch;
const guardedFetch = withoutResponseDecompression(nativeFetch);
const server = Bun.serve({
  hostname: "127.0.0.1",
  port: 0,
  async fetch(request) {
    const path = new URL(request.url).pathname;
    if (path === "/br" || path === "/gzip") {
      const body =
        path === "/br"
          ? brotliCompressSync("compressed")
          : gzipSync("compressed");
      return new Response(body, {
        headers: { "Content-Encoding": path === "/br" ? "br" : "gzip" },
      });
    }
    if (path === "/invalid-br") {
      return new Response("not a brotli stream", {
        headers: { "Content-Encoding": "br" },
      });
    }
    if (path === "/encoded-error") {
      return new Response("not a brotli stream", {
        status: 500,
        headers: { "Content-Encoding": "BR" },
      });
    }
    if (path === "/encoding-list") {
      return new Response("not an encoded stream", {
        headers: { "Content-Encoding": "gzip, br" },
      });
    }
    if (path === "/redirect") {
      return Response.redirect(new URL("/br", request.url));
    }
    return Response.json({
      encoding: request.headers.get("accept-encoding"),
      marker: request.headers.get("x-marker"),
      method: request.method,
      body: await request.text(),
    });
  },
});
afterAll(() => server.stop(true));

describe("outbound response decompression containment", () => {
  test("preserves Request method, body and headers and forces identity", async () => {
    const request = new Request(new URL("/echo", server.url), {
      method: "POST",
      body: "test body",
      headers: { "x-marker": "kept", "accept-encoding": "br" },
    });
    expect(await (await guardedFetch(request)).json()).toEqual({
      encoding: "identity",
      marker: "kept",
      method: "POST",
      body: "test body",
    });
    expect(request.headers.get("accept-encoding")).toBe("br");
  });

  test("preserves init overrides without mutating caller headers", async () => {
    const headers = new Headers({
      "x-marker": "override",
      "accept-encoding": "gzip",
    });
    const result = await guardedFetch(new URL("/echo", server.url), {
      headers,
    });
    expect((await result.json()).marker).toBe("override");
    expect(headers.get("accept-encoding")).toBe("gzip");
  });

  for (const path of [
    "/br",
    "/gzip",
    "/invalid-br",
    "/redirect",
    "/encoded-error",
    "/encoding-list",
  ]) {
    test(`rejects unsolicited encoded response ${path} before decoding`, async () => {
      await expect(
        guardedFetch(new URL(path, server.url), { decompress: true }),
      ).rejects.toThrow("Compressed HTTP responses are temporarily disabled");
    });
  }

  test("propagates cancellation", async () => {
    const controller = new AbortController();
    controller.abort();
    await expect(
      guardedFetch(server.url, { signal: controller.signal }),
    ).rejects.toThrow();
  });
});
