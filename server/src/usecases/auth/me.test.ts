import { describe, expect, test } from "bun:test";
import type { UserContext } from "@/usecases/context";
import { meHandler } from "./me";

describe("meHandler", () => {
  // presentation の auth.me が protectedProcedure 経由で `ctx.user` を non-nullable
  // に narrow してから渡すため、handler 自身は受け取った user をそのまま projection
  // するのみ。contract test として shape と値保持を押さえる。
  test("returns the user under the `user` key as-is", () => {
    const user: UserContext = {
      id: "twitch-42",
      twitchUserId: "twitch-42",
      login: "mockuser",
      displayName: "Mock User",
    };
    expect(meHandler(user)).toEqual({ user });
  });

  test("does not mutate or clone — returned `user` is strict-equal to input", () => {
    const user: UserContext = {
      id: "twitch-99",
      twitchUserId: "twitch-99",
      login: "same",
      displayName: "Same",
    };
    const result = meHandler(user);
    // 参照同一性を維持する (projection layer で無駄なコピーをしていないことの契約)
    expect(result.user).toBe(user);
  });
});
