import { defineSpecs, generateId, type SpecsOf } from "../common";

export interface Session {
  id: string;
  userId: string;
  csrfToken: string;
  createdAt: Date;
  expiresAt: Date;
  lastSeenAt: Date;
}

export namespace Session {
  export type SortKey = "createdAt" | "lastSeenAt" | "id";

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
    csrfToken: string;
    expiresAt: Date;
    now: Date;
  }): Session {
    return {
      id: generateId(),
      userId: params.userId,
      csrfToken: params.csrfToken,
      createdAt: params.now,
      expiresAt: params.expiresAt,
      lastSeenAt: params.now,
    };
  }
}
