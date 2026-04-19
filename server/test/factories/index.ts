import type { TemplateDoc } from "@/models/templateDoc";

/**
 * test 用の `twitch user id` を生成する。ADR 0007 で users 表を撤去したため、
 * test で必要な user identifier は単なる文字列 1 つ (Twitch の sub claim 相当)。
 */
export function generateTestTwitchUserId(): string {
  return `twitch-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
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
