import { defineSpecs, generateId, type SpecsOf } from "../common";

export interface User {
  id: string;
  twitchUserId: string;
  login: string;
  displayName: string;
  createdAt: Date;
  updatedAt: Date;
  lastLoginAt: Date;
}

export namespace User {
  export type SortKey = "createdAt" | "lastLoginAt" | "id";

  const _specs = defineSpecs({
    ById: (id: string) => ({ id }),
    ByTwitchUserId: (twitchUserId: string) => ({ twitchUserId }),
  });
  export const ById = _specs.ById;
  export const ByTwitchUserId = _specs.ByTwitchUserId;

  /**
   * Spec のデータ形状 (leaf discriminated union)。
   * 合成可能な形が必要な呼出側は `Comp<User.Spec>` と明示する。
   */
  export type Spec = SpecsOf<typeof _specs>;

  export function cursor(
    u: User,
    keys: readonly SortKey[],
  ): Record<string, string> {
    const result: Record<string, string> = {};
    for (const key of keys) {
      const value = u[key];
      result[key] = value instanceof Date ? value.toISOString() : String(value);
    }
    return result;
  }

  export function create(params: {
    twitchUserId: string;
    login: string;
    displayName: string;
    now: Date;
  }): User {
    return {
      id: generateId(),
      twitchUserId: params.twitchUserId,
      login: params.login,
      displayName: params.displayName,
      createdAt: params.now,
      updatedAt: params.now,
      lastLoginAt: params.now,
    };
  }
}
