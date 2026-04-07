import { TRPCError } from "@trpc/server";
import type { Fail } from "../../models/common/fail";
import type { Result } from "../../models/common/result";

const FAIL_CODE_MAP: Record<string, TRPCError["code"]> = {
  NOT_FOUND: "NOT_FOUND",
  INVALID_INPUT: "BAD_REQUEST",
  DUPLICATE: "CONFLICT",
  INTERNAL: "INTERNAL_SERVER_ERROR",
};

export function handleResult<T>(result: Result<T, Fail>): T {
  if (!result.ok) {
    throw new TRPCError({
      code: FAIL_CODE_MAP[result.error.code] ?? "INTERNAL_SERVER_ERROR",
      message: result.error.message,
      cause: result.error,
    });
  }
  return result.value;
}
