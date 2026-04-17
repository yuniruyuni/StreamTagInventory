import { defineSpecs, type SpecsOf } from "../common";

export interface OidcNonce {
  nonce: string;
  createdAt: Date;
  expiresAt: Date;
}

export namespace OidcNonce {
  export type SortKey = "createdAt" | "nonce";

  const _specs = defineSpecs({
    ByValue: (nonce: string) => ({ nonce }),
    /** expires_at > at */
    ActiveAt: (at: Date) => ({ activeAt: at }),
    /** expires_at <= at */
    ExpiredAt: (at: Date) => ({ expiredAt: at }),
  });
  export const ByValue = _specs.ByValue;
  export const ActiveAt = _specs.ActiveAt;
  export const ExpiredAt = _specs.ExpiredAt;

  /**
   * Spec のデータ形状 (leaf discriminated union)。
   * 合成可能な形が必要な呼出側は `Comp<OidcNonce.Spec>` と明示する。
   */
  export type Spec = SpecsOf<typeof _specs>;

  export function cursor(
    n: OidcNonce,
    keys: readonly SortKey[],
  ): Record<string, string> {
    const result: Record<string, string> = {};
    for (const key of keys) {
      const value = n[key];
      result[key] = value instanceof Date ? value.toISOString() : String(value);
    }
    return result;
  }

  export function create(params: {
    nonce: string;
    expiresAt: Date;
    now: Date;
  }): OidcNonce {
    return {
      nonce: params.nonce,
      createdAt: params.now,
      expiresAt: params.expiresAt,
    };
  }
}
