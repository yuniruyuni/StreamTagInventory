import { withoutResponseDecompression } from "./fetch-without-decompression";

// This module must be the first import in the executable entry point, before
// dependencies can capture fetch. It also provides a safe, offline runtime probe.
globalThis.fetch = withoutResponseDecompression(globalThis.fetch);

if (process.argv.includes("--runtime-info")) {
  console.log(
    JSON.stringify({
      bun: Bun.version,
      bunRevision: Bun.revision,
      outboundFetchDecompression: false,
      mitigation: "CVE-2026-111497-identity-fetch-v1",
    }),
  );
  process.exit(0);
}
