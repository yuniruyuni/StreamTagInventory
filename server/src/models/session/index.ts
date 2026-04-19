import { defineSpecs, generateId, type SpecsOf } from "../common";

export interface Session {
  id: string;
  userId: string;
  /**
   * `Authorization: Bearer` で運ばれる raw 32B token の sha256(base64url) ハッシュ。
   * ADR 0006 により raw 値は DB に置かず、middleware は Bearer header を
   * `Token.fromBase64url(...).hash()` してから `Session.ByTokenHash(hash)` で
   * 照合する。
   */
  tokenHash: string;
  createdAt: Date;
  expiresAt: Date;
  lastSeenAt: Date;
}

export namespace Session {
  export type SortKey = "createdAt" | "lastSeenAt" | "id";

  /**
   * 24 時間 absolute。client 側 session token は sessionStorage 保管で
   * tab close と共に消えるため、server 側は sliding 延長をしない。
   * `lastSeenAt` は観測・cleanup 判断用に残す。
   */
  export const TTL_MS = 24 * 60 * 60 * 1000;

  const _specs = defineSpecs({
    ById: (id: string) => ({ id }),
    ByUserId: (userId: string) => ({ userId }),
    /** Bearer token を sha256 した hash で照合 (ADR 0006)。 */
    ByTokenHash: (hash: string) => ({ tokenHash: hash }),
    /** expires_at > at */
    ActiveAt: (at: Date) => ({ activeAt: at }),
    /** expires_at <= now() */
    Expired: () => ({ expired: true as const }),
  });
  export const ById = _specs.ById;
  export const ByUserId = _specs.ByUserId;
  export const ByTokenHash = _specs.ByTokenHash;
  export const ActiveAt = _specs.ActiveAt;
  export const Expired = _specs.Expired;

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
    /**
     * 必須。呼出側 (login usecase) で `Token.generate().hash()` を計算して渡す。
     * raw Token は戻り値として client に返すが DB には置かない (ADR 0006)。
     */
    tokenHash: string;
    /** 省略時は `now + TTL_MS`。test で期限切れ検証をする場合のみ渡す。 */
    expiresAt?: Date;
    now: Date;
  }): Session {
    return {
      id: generateId(),
      userId: params.userId,
      tokenHash: params.tokenHash,
      createdAt: params.now,
      expiresAt: params.expiresAt ?? new Date(params.now.getTime() + TTL_MS),
      lastSeenAt: params.now,
    };
  }
}
