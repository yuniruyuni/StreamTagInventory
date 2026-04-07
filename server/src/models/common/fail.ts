const FAIL_BRAND: unique symbol = Symbol("Fail");

export interface Fail {
  readonly [FAIL_BRAND]: true;
  readonly code: string;
  readonly message: string;
  readonly details?: Record<string, unknown>;
}

export function fail(
  code: string,
  message: string,
  details?: Record<string, unknown>,
): Fail {
  return { [FAIL_BRAND]: true, code, message, details } as Fail;
}

export function isFail(value: unknown): value is Fail {
  return (
    typeof value === "object" &&
    value !== null &&
    FAIL_BRAND in value &&
    (value as Record<symbol, unknown>)[FAIL_BRAND] === true
  );
}
