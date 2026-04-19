import { describe, expect, test } from "bun:test";
import { TRPCError } from "@trpc/server";
import { fail } from "@/models/common/fail";
import type { Result } from "@/models/common/result";
import { handleResult } from "./handle-result";

describe("handleResult", () => {
  test("returns value when Result is ok", () => {
    const result: Result<number, never> = { ok: true, value: 42 };
    expect(handleResult(result)).toBe(42);
  });

  test.each([
    ["NOT_FOUND", "NOT_FOUND"],
    ["INVALID_INPUT", "BAD_REQUEST"],
    ["DUPLICATE", "CONFLICT"],
    ["UNAUTHORIZED", "UNAUTHORIZED"],
    ["FORBIDDEN", "FORBIDDEN"],
    ["INTERNAL", "INTERNAL_SERVER_ERROR"],
  ] as const)("maps Fail code %s to tRPC code %s", (failCode, trpcCode) => {
    const result: Result<never, ReturnType<typeof fail>> = {
      ok: false,
      error: fail(failCode, "boom"),
    };
    try {
      handleResult(result);
      throw new Error("should have thrown");
    } catch (err) {
      expect(err).toBeInstanceOf(TRPCError);
      expect((err as TRPCError).code).toBe(trpcCode);
      expect((err as TRPCError).message).toBe("boom");
    }
  });

  test("falls back to INTERNAL_SERVER_ERROR for unknown Fail code", () => {
    const result: Result<never, ReturnType<typeof fail>> = {
      ok: false,
      error: fail("SOMETHING_WEIRD", "unexpected"),
    };
    try {
      handleResult(result);
      throw new Error("should have thrown");
    } catch (err) {
      expect(err).toBeInstanceOf(TRPCError);
      expect((err as TRPCError).code).toBe("INTERNAL_SERVER_ERROR");
    }
  });
});
