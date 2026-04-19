import { defineSpecs, generateId, type SpecsOf, Token } from "../common";

export interface Session {
  id: string;
  userId: string;
  csrfToken: Token;
  createdAt: Date;
  expiresAt: Date;
  lastSeenAt: Date;
}

export namespace Session {
  export type SortKey = "createdAt" | "lastSeenAt" | "id";

  /**
   * 24 時間 absolute。client 側 CSRF は memory-only で browser restart と共に消え、
   * 再接続時は OIDC silent re-auth で新 session を立てる運用のため、server 側で
   * sliding 延長はしない。`lastSeenAt` は観測・cleanup 判断用に残す。
   */
  export const TTL_MS = 24 * 60 * 60 * 1000;

  const _specs = defineSpecs({
    ById: (id: string) => ({ id }),
    ByUserId: (userId: string) => ({ userId }),
    /** expires_at > at */
    ActiveAt: (at: Date) => ({ activeAt: at }),
    /** expires_at <= now() */
    Expired: () => ({ expired: true as const }),
  });
  export const ById = _specs.ById;
  export const ByUserId = _specs.ByUserId;
  export const ActiveAt = _specs.ActiveAt;
  export const Expired = _specs.Expired;

  /**
   * Spec のデータ形状 (leaf discriminated union)。
   * 合成可能な形が必要な呼出側は `Comp<Session.Spec>` と明示する。
   */
  export type Spec = SpecsOf<typeof _specs>;

  export function cursor(
    s: Session,
    keys: readonly SortKey[],
  ): Record<string, string> {
    const result: Record<string, string> = {};
    for (const key of keys) {
      const value = s[key];
      result[key] = value instanceof Date ? value.toISOString() : String(value);
    }
    return result;
  }

  export function create(params: {
    userId: string;
    /** 省略時は CSPRNG で新しい Token を発行。test で固定値を使う場合のみ渡す。 */
    csrfToken?: Token;
    /** 省略時は `now + TTL_MS`。test で期限切れ検証をする場合のみ渡す。 */
    expiresAt?: Date;
    now: Date;
  }): Session {
    return {
      id: generateId(),
      userId: params.userId,
      csrfToken: params.csrfToken ?? Token.generate(),
      createdAt: params.now,
      expiresAt: params.expiresAt ?? new Date(params.now.getTime() + TTL_MS),
      lastSeenAt: params.now,
    };
  }
}
