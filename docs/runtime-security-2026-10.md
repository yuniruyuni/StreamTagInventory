# October 2026 runtime security containment

This is a temporary mitigation, **not a patched Bun runtime**. Bun remains 1.4.3.
The stable release available on 2026-10-22 embeds Brotli source preceding the
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
  Then remove the guard and its temporary CLI indicator together.

## Rollback

Baseline source: e9ae26df0a9614b3b06f2ced4db2c5076fc8613e. Record the corresponding live image digest before rollout.
The change contains no database or public API schema migration. Revert this commit
and use the normal gated deployment to roll back; rollback restores the decoder
exposure, so prefer a forward fix if a provider rejects identity responses.

## Sources

- https://nodejs.org/en/blog/vulnerability/october-2026-security-releases
- https://github.com/oven-sh/bun/blob/bun-v1.4.3/scripts/build/deps/brotli.ts
- https://github.com/google/brotli/commit/0ed4268a4401abcb44720963
- https://bun.com/docs/runtime/networking/fetch
