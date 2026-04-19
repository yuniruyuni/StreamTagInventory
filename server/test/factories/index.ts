import type { TemplateDoc } from "@/models/templateDoc";
import { User } from "@/models/user";

export function createTestUser(overrides: Partial<User> = {}): User {
  const now = new Date();
  const base = User.create({
    twitchUserId: `twitch-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    login: "test_user",
    displayName: "Test User",
    now,
  });
  return { ...base, ...overrides };
}

export function createTestTemplateDoc(
  overrides: Partial<TemplateDoc> & { userId: string },
): TemplateDoc {
  const state = overrides.state ?? new Uint8Array([0, 1, 2, 3]);
  return {
    userId: overrides.userId,
    state,
    sizeBytes: overrides.sizeBytes ?? state.byteLength,
    updatedAt: overrides.updatedAt ?? new Date(),
  };
}
