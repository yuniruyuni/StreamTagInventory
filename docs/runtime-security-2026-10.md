# October 2026 runtime security

## Patched stable runtime — 2026-10-25

Docker build stages and CI now use stable Bun 1.4.4. The official image is pinned
to index digest `sha256:1d22548f177f4ff38e0c15baa3c2c46c6c2060ba2d1bc573bb4720b407548f1d`.
Its release revision is `38afee6c84fcf48c0edb2466aa4b27d287a59c30`. Tagged
Bun source pins Brotli 1.2.1 commit `db24a98aed38a16de78cc05ca15cdd8dc2a0d92d`,
which includes the CVE-2026-111497 backport `b418fa81c48262a86a95332b0bc6d62c30aa78b6`.
The official Linux release binary and the pinned image binary were SHA-256 matched.

The existing global fetch guard remains enabled. This rollout changes the runtime
and build tooling while preserving the existing identity-only outbound response
policy. Removing the guard is a separate reviewed change. The Docker build checks
the compiled server's Bun version/revision against the compiler and asserts that
response decompression remains disabled. Live verification must check both
containers and origin health after the normal gated deployment.

The retained policy is recorded in [ADR 0011](./adr/0011-retain-fetch-guard-during-patched-runtime-rollout.md).

- https://github.com/oven-sh/bun/releases/tag/bun-v1.4.4
- https://github.com/oven-sh/bun/blob/bun-v1.4.4/scripts/build/deps/brotli.ts
- https://github.com/google/brotli/commit/b418fa81c48262a86a95332b0bc6d62c30aa78b6

## Initial containment — 2026-10-22

The initial change was a temporary mitigation, **not a patched Bun runtime**; it retained Bun 1.4.3.
The stable release verified during that early-morning rollout embedded Brotli source preceding the
upstream fix for CVE-2026-111497. Rebuilding the unchanged runtime alone does not fix it.

## Behavior

The first import in server/src/index.ts installs a global fetch wrapper before
other dependencies load. It sends Accept-Encoding: identity and always passes
decompress: false to the native fetch implementation. Any non-identity
Content-Encoding is rejected, including unsolicited Brotli and redirect responses.
The request header alone is not a security boundary; disabling decoding is essential.

An upstream that refuses identity encoding will fail closed and its feature may
be unavailable until a supported patched runtime is deployed. Request method,
headers, body and cancellation are preserved. Server response compression is unchanged.

## Coverage and limitations

jose retrieves Twitch signing keys through global fetch. Browser-side Twitch requests are outside this server mitigation.

The wrapper covers global fetch, not a directly imported Bun.fetch, FetchSession,
node:zlib Brotli API, DecompressionStream, native modules, or a separate HTTP
client. Do not add those paths without re-evaluating this containment. It also
does not remediate build-time decoding in bun install. The application and its
production dependencies must continue to be reviewed when upgraded.

## Verification and removal

- Regression tests use a loopback server that ignores Accept-Encoding and returns
  valid and malformed br, gzip, and a redirect to br; all are rejected without decoding.
- Compile the actual server and execute ./server --runtime-info. This prints only
  Bun version/revision and the mitigation identifier, and exits before DB/auth setup.
- After deploy, run that probe in both live containers and compare their image
  digests with the deployment artifact. Verify origin health, not cached CDN HTML.
- Replace the pinned Bun version/digest only after the stable upstream source
  contains the Brotli fix; rebuild embedded binaries, run CI and verify live probes.
  Retain the guard during this runtime rollout. Its removal and the temporary CLI
  indicator must be considered together in a separate reviewed change.

## Rollback

Baseline source: e9ae26df0a9614b3b06f2ced4db2c5076fc8613e. Record the corresponding live image digest before rollout.
The change contains no database or public API schema migration. Revert this commit
and use the normal gated deployment to roll back. The pre-1.4.4 image retains
the identity guard but contains the old decoder; restoring the original pre-guard
image restores the decoder
exposure, so prefer a forward fix if a provider rejects identity responses.

## Sources

- https://nodejs.org/en/blog/vulnerability/october-2026-security-releases
- https://github.com/oven-sh/bun/blob/bun-v1.4.3/scripts/build/deps/brotli.ts
- https://github.com/google/brotli/commit/0ed4268a4401abcb44720963
- https://bun.com/docs/runtime/networking/fetch
