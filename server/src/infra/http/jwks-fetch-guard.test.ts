import { expect, test } from "bun:test";

test("jose JWKS retrieval uses the installed guard", async () => {
  const child = Bun.spawn(
    [process.execPath, `${import.meta.dir}/jwks-fetch-guard.fixture.ts`],
    {
      stdout: "pipe",
      stderr: "pipe",
    },
  );
  const [exitCode, error] = await Promise.all([
    child.exited,
    new Response(child.stderr).text(),
  ]);
  expect(error).toBe("");
  expect(exitCode).toBe(0);
}, 15000);
