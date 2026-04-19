import { defineSpecs, type SpecsOf, Token } from "../common";

export interface OidcNonce {
  nonce: Token;
  createdAt: Date;
  expiresAt: Date;
}

export namespace OidcNonce {
  export type SortKey = "createdAt" | "nonce";

  /** OIDC authorize → callback の往復想定で十分に短く、リプレイ窓を小さく保つ。 */
  export const TTL_MS = 10 * 60 * 1000;

  const _specs = defineSpecs({
    ByValue: (nonce: Token) => ({ nonce }),
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
      if (value instanceof Date) {
        result[key] = value.toISOString();
      } else if (value instanceof Token) {
        result[key] = value.toBase64url();
      } else {
        result[key] = String(value);
      }
    }
    return result;
  }

  export function create(params: {
    /** 省略時は CSPRNG で新しい Token を発行。test で固定値を使う場合のみ渡す。 */
    nonce?: Token;
    /** 省略時は `now + TTL_MS`。test で期限切れ検証をする場合のみ渡す。 */
    expiresAt?: Date;
    now: Date;
  }): OidcNonce {
    return {
      nonce: params.nonce ?? Token.generate(),
      createdAt: params.now,
      expiresAt: params.expiresAt ?? new Date(params.now.getTime() + TTL_MS),
    };
  }
}
