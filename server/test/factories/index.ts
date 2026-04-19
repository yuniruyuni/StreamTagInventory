import { OidcNonce } from "@/models/oidcNonce";
import { Session } from "@/models/session";
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

export function createTestSession(
  overrides: Partial<Session> & { userId: string },
): Session {
  const now = new Date();
  const expiresAt = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000);
  // csrfToken は Session.create が CSPRNG で自動発行する
  const base = Session.create({
    userId: overrides.userId,
    expiresAt,
    now,
  });
  return { ...base, ...overrides };
}

export function createTestOidcNonce(
  overrides: Partial<OidcNonce> = {},
): OidcNonce {
  const now = new Date();
  const expiresAt = new Date(now.getTime() + 10 * 60 * 1000);
  // nonce は OidcNonce.create が CSPRNG で自動発行する
  const base = OidcNonce.create({ expiresAt, now });
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
