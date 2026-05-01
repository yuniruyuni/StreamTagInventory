import { afterEach, beforeEach, expect, test } from "bun:test";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { fireEvent, render, waitFor } from "@testing-library/react";
import type { TRPCLink } from "@trpc/client";
import { observable } from "@trpc/server/observable";
import { type FC, type ReactNode, useContext } from "react";
import { I18nWrapper } from "~/test-utils";
import { ID_TOKEN_STORAGE_KEY, trpc } from "~/trpc/client";
import { TwitchAuthContext } from "./context";
import { TwitchAuthProvider } from "./provider";

/**
 * peekIdTokenNonce が parse できる "JWT 風" 文字列を組み立てる。
 * 署名検証は本 provider の責務ではなく server 側なので、payload だけ意味があれば良い。
 */
function fakeJwt(payload: Record<string, unknown>): string {
  const b64url = (s: string) =>
    btoa(s).replace(/=+$/g, "").replace(/\+/g, "-").replace(/\//g, "_");
  const header = b64url(JSON.stringify({ alg: "HS256", typ: "JWT" }));
  const body = b64url(JSON.stringify(payload));
  return `${header}.${body}.sig`;
}

const DEFAULT_USER = {
  id: "u1",
  twitchUserId: "u1",
  login: "u",
  displayName: "U",
};

/**
 * auth.me の応答を「その時点で sessionStorage にある id_token」に応じて
 * 切り替える custom link。httpBatchLink の代わりにこれを挿すことで、
 * fetch の実挙動 (headers が dispatch 時に評価される) を mock しつつ、
 * Bearer 値による挙動分岐を直接制御する。
 *
 * ログを calls[] に残すので、呼び出し順序と token も assert できる。
 */
type AuthMeResponder = (
  bearer: string | null,
) => { ok: true; data: unknown } | { ok: false };

function createMockLink(authMeResponder: AuthMeResponder): {
  // biome-ignore lint/suspicious/noExplicitAny: TRPCLink generics は AppRouter 型に依存し、テストでは雑に any で流す
  link: TRPCLink<any>;
  calls: Array<{ path: string; bearer: string | null }>;
} {
  const calls: Array<{ path: string; bearer: string | null }> = [];
  // biome-ignore lint/suspicious/noExplicitAny: 同上
  const link: TRPCLink<any> =
    () =>
    ({ op }) =>
      observable((observer) => {
        const raw = sessionStorage.getItem(ID_TOKEN_STORAGE_KEY);
        let bearer: string | null = null;
        if (raw) {
          try {
            const parsed = JSON.parse(raw);
            if (typeof parsed === "string" && parsed.length > 0)
              bearer = parsed;
          } catch {
            // ignore
          }
        }
        calls.push({ path: op.path, bearer });

        if (op.path === "auth.me") {
          const res = authMeResponder(bearer);
          if (res.ok) {
            observer.next({ result: { data: res.data } });
            observer.complete();
          } else {
            observer.error(
              new Error("UNAUTHORIZED") as unknown as Parameters<
                typeof observer.error
              >[0],
            );
          }
          return;
        }

        // 他の procedure は空応答で成功させる (templates.sync など。テスト対象外)
        observer.next({ result: { data: null } });
        observer.complete();
      });
  return { link, calls };
}

const Providers: FC<{
  children: ReactNode;
  queryClient: QueryClient;
  // biome-ignore lint/suspicious/noExplicitAny: 同上
  link: TRPCLink<any>;
}> = ({ children, queryClient, link }) => {
  const client = trpc.createClient({ links: [link] });
  return (
    <I18nWrapper>
      <trpc.Provider client={client} queryClient={queryClient}>
        <QueryClientProvider client={queryClient}>
          {children}
        </QueryClientProvider>
      </trpc.Provider>
    </I18nWrapper>
  );
};

function renderWithProvider(
  authMeResponder: AuthMeResponder,
  children: ReactNode = <div>AUTHENTICATED</div>,
) {
  const { link, calls } = createMockLink(authMeResponder);
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  const result = render(
    <Providers queryClient={queryClient} link={link}>
      <TwitchAuthProvider
        scope={["user:edit:broadcast"]}
        entrance={() => <div>ENTRANCE</div>}
      >
        {children}
      </TwitchAuthProvider>
    </Providers>,
  );
  return { ...result, calls, queryClient };
}

/**
 * 前の test が `window.location.href = <authorize url>` で navigate した状態が
 * 残ると、次の test の `window.location.href` 観測が壊れる。happy-dom では
 * href 代入が actual reload を起こさず URL 文字列だけ変わるため、明示的に
 * localhost へ戻す。
 */
const BASE_URL = "http://localhost:3000/";
beforeEach(() => {
  sessionStorage.clear();
  // nonce は localStorage 保管のためこちらもクリア
  localStorage.clear();
  window.location.href = BASE_URL;
});

afterEach(() => {
  sessionStorage.clear();
  localStorage.clear();
  window.location.href = BASE_URL;
});

// =============================================================================
// Happy paths
// =============================================================================

test("fresh visitor sees Entrance (no tokens, no hash)", async () => {
  const { findByText, queryByText } = renderWithProvider(() => ({
    ok: false,
  }));
  expect(await findByText("ENTRANCE")).toBeInTheDocument();
  expect(queryByText("AUTHENTICATED")).toBeNull();
});

test("fresh login: Entrance → Twitch callback (matching nonce) → AUTHENTICATED", async () => {
  const nonce = "fresh-nonce";
  const idToken = fakeJwt({ nonce, sub: "u1" });
  localStorage.setItem("oauth_nonce", nonce);
  window.location.hash = `#access_token=at&id_token=${idToken}&token_type=bearer&expires_in=14400`;

  const { findByText, queryByText, calls } = renderWithProvider((bearer) =>
    bearer === idToken
      ? { ok: true, data: { user: DEFAULT_USER } }
      : { ok: false },
  );

  expect(
    await findByText("AUTHENTICATED", {}, { timeout: 3000 }),
  ).toBeInTheDocument();
  expect(queryByText("ENTRANCE")).toBeNull();
  // 新 Bearer で auth.me が呼ばれている
  expect(calls.some((c) => c.path === "auth.me" && c.bearer === idToken)).toBe(
    true,
  );
  // hash が消費されていることも確認 (Phase A の clearHash)
  expect(window.location.hash).toBe("");
  // login 成功後は nonce を localStorage から削除する (rotate ではなく consume)。
  // 残すと他タブから見えるゴミになるだけで実用的な意味が無い。
  expect(localStorage.getItem("oauth_nonce")).toBeNull();
});

test("returning visitor (valid id_token in storage, no hash) goes directly to AUTHENTICATED", async () => {
  const idToken = fakeJwt({ nonce: "any", sub: "u1" });
  sessionStorage.setItem(ID_TOKEN_STORAGE_KEY, JSON.stringify(idToken));
  sessionStorage.setItem("twitch-auth", JSON.stringify("at"));

  const { findByText, queryByText } = renderWithProvider((bearer) =>
    bearer === idToken
      ? { ok: true, data: { user: DEFAULT_USER } }
      : { ok: false },
  );

  expect(
    await findByText("AUTHENTICATED", {}, { timeout: 3000 }),
  ).toBeInTheDocument();
  expect(queryByText("ENTRANCE")).toBeNull();
  // reload 時 (既にログイン中) は nonce を新規発行しない。ログイン中は
  // authorize URL が null (idToken 有で useMemo が null を返す) なので nonce は
  // 参照されず、発行すると localStorage にゴミが残るだけ。
  expect(localStorage.getItem("oauth_nonce")).toBeNull();
});

// =============================================================================
// Stale / expired token cleanup paths
// =============================================================================

test("stale id_token + callback hash で 2 度ログイン不要 (regression, PR #91)", async () => {
  const oldNonce = "nonce-old";
  const newNonce = "nonce-new";
  const oldIdToken = fakeJwt({ nonce: oldNonce, sub: "u1" });
  const newIdToken = fakeJwt({ nonce: newNonce, sub: "u1" });

  sessionStorage.setItem(ID_TOKEN_STORAGE_KEY, JSON.stringify(oldIdToken));
  sessionStorage.setItem("twitch-auth", JSON.stringify("old-access"));
  localStorage.setItem("oauth_nonce", newNonce);
  window.location.hash = `#access_token=new-access&id_token=${newIdToken}&token_type=bearer&expires_in=14400`;

  const { findByText, queryByText, calls } = renderWithProvider((bearer) =>
    bearer === newIdToken
      ? { ok: true, data: { user: DEFAULT_USER } }
      : { ok: false },
  );

  expect(
    await findByText("AUTHENTICATED", {}, { timeout: 3000 }),
  ).toBeInTheDocument();
  expect(queryByText("ENTRANCE")).toBeNull();

  // NEW Bearer での auth.me 呼出を最低 1 回行っている
  const authMeCalls = calls.filter((c) => c.path === "auth.me");
  expect(authMeCalls.some((c) => c.bearer === newIdToken)).toBe(true);
});

test("session expired (valid token in storage but server 401): Phase B cleans up to Entrance", async () => {
  const idToken = fakeJwt({ nonce: "any", sub: "u1" });
  sessionStorage.setItem(ID_TOKEN_STORAGE_KEY, JSON.stringify(idToken));
  sessionStorage.setItem("twitch-auth", JSON.stringify("at"));

  const { findByText, queryByText } = renderWithProvider(() => ({ ok: false }));

  // Phase B 発火で Entrance にクリーンアップされる
  expect(
    await findByText("ENTRANCE", {}, { timeout: 3000 }),
  ).toBeInTheDocument();
  expect(queryByText("AUTHENTICATED")).toBeNull();
  // storage から token が消されている
  expect(sessionStorage.getItem(ID_TOKEN_STORAGE_KEY)).toBeNull();
  expect(sessionStorage.getItem("twitch-auth")).toBeNull();
  // nonce は新しいものに rotate されている (= Entrance の authorize URL は fresh)
  expect(localStorage.getItem("oauth_nonce")).not.toBeNull();
});

test("expired id_token is cleaned up locally without waiting for server rejection", async () => {
  const idToken = fakeJwt({
    nonce: "any",
    sub: "u1",
    exp: Math.floor(Date.now() / 1000) - 60,
  });
  sessionStorage.setItem(ID_TOKEN_STORAGE_KEY, JSON.stringify(idToken));
  sessionStorage.setItem("twitch-auth", JSON.stringify("at"));

  const { findByText, queryByText } = renderWithProvider(() => ({
    ok: true,
    data: { user: DEFAULT_USER },
  }));

  expect(
    await findByText("ENTRANCE", {}, { timeout: 3000 }),
  ).toBeInTheDocument();
  expect(queryByText("AUTHENTICATED")).toBeNull();
  expect(sessionStorage.getItem(ID_TOKEN_STORAGE_KEY)).toBeNull();
  expect(sessionStorage.getItem("twitch-auth")).toBeNull();
  expect(localStorage.getItem("oauth_nonce")).not.toBeNull();
});

// =============================================================================
// Nonce / callback validation
// =============================================================================

test("nonce mismatch in callback id_token → Entrance (mix-up rejection, no tokens saved, nonce rotated)", async () => {
  // localStorage.oauth_nonce と id_token claim.nonce が異なるケース = mix-up
  // 攻撃 or 何らかの不整合。callback を破棄して Entrance に戻す。
  localStorage.setItem("oauth_nonce", "expected-nonce");
  const bogusIdToken = fakeJwt({ nonce: "attacker-nonce", sub: "u1" });
  window.location.hash = `#access_token=at&id_token=${bogusIdToken}&token_type=bearer&expires_in=14400`;

  const { findByText } = renderWithProvider(() => ({
    ok: true,
    data: { user: DEFAULT_USER },
  }));

  expect(await findByText("ENTRANCE")).toBeInTheDocument();
  // token が保存されていない
  expect(sessionStorage.getItem(ID_TOKEN_STORAGE_KEY)).toBeNull();
  expect(sessionStorage.getItem("twitch-auth")).toBeNull();
  // nonce は rotate 済 (攻撃用 nonce を再利用されない)
  expect(localStorage.getItem("oauth_nonce")).not.toBe("expected-nonce");
});

test("malformed id_token (can't parse nonce) → Entrance (no tokens saved)", async () => {
  localStorage.setItem("oauth_nonce", "n1");
  // peekIdTokenNonce が null を返す形式
  const badIdToken = "not-a-jwt";
  window.location.hash = `#access_token=at&id_token=${badIdToken}&token_type=bearer&expires_in=14400`;

  const { findByText } = renderWithProvider(() => ({
    ok: true,
    data: { user: DEFAULT_USER },
  }));

  expect(await findByText("ENTRANCE")).toBeInTheDocument();
  expect(sessionStorage.getItem(ID_TOKEN_STORAGE_KEY)).toBeNull();
});

test("hash present but missing id_token (Twitch protocol error) → Entrance, tokens not touched", async () => {
  localStorage.setItem("oauth_nonce", "n1");
  // access_token のみ、id_token 無し → parseAuthFromHash は null を返す
  window.location.hash = `#access_token=at&token_type=bearer&expires_in=14400`;

  const { findByText } = renderWithProvider(() => ({
    ok: true,
    data: { user: DEFAULT_USER },
  }));

  expect(await findByText("ENTRANCE")).toBeInTheDocument();
  expect(sessionStorage.getItem(ID_TOKEN_STORAGE_KEY)).toBeNull();
  expect(sessionStorage.getItem("twitch-auth")).toBeNull();
  // nonce は保持される (callback が成立していないので消費しない)
  expect(localStorage.getItem("oauth_nonce")).toBe("n1");
});

test("hash present but missing access_token → Entrance, tokens not touched", async () => {
  localStorage.setItem("oauth_nonce", "n1");
  const idToken = fakeJwt({ nonce: "n1", sub: "u1" });
  // id_token のみ、access_token 無し → parseAuthFromHash は null を返す
  window.location.hash = `#id_token=${idToken}&token_type=bearer`;

  const { findByText } = renderWithProvider(() => ({
    ok: true,
    data: { user: DEFAULT_USER },
  }));

  expect(await findByText("ENTRANCE")).toBeInTheDocument();
  expect(sessionStorage.getItem(ID_TOKEN_STORAGE_KEY)).toBeNull();
});

// =============================================================================
// Logout flow
// =============================================================================

/**
 * Authenticated 状態から logout() を呼ぶと tokens / query cache がクリアされ
 * Entrance に戻る。再度 login 経路が使えることも確認する。
 */
const LogoutButton: FC = () => {
  const { logout } = useContext(TwitchAuthContext);
  return (
    <button type="button" onClick={() => void logout()}>
      LOGOUT
    </button>
  );
};

test("logout clears tokens, rotates nonce, and returns to Entrance", async () => {
  const idToken = fakeJwt({ nonce: "n1", sub: "u1" });
  sessionStorage.setItem(ID_TOKEN_STORAGE_KEY, JSON.stringify(idToken));
  sessionStorage.setItem("twitch-auth", JSON.stringify("at"));
  localStorage.setItem("oauth_nonce", "n1");

  const { findByText, getByRole } = renderWithProvider(
    (bearer) =>
      bearer === idToken
        ? { ok: true, data: { user: DEFAULT_USER } }
        : { ok: false },
    <>
      <div>AUTHENTICATED</div>
      <LogoutButton />
    </>,
  );

  expect(
    await findByText("AUTHENTICATED", {}, { timeout: 3000 }),
  ).toBeInTheDocument();

  fireEvent.click(getByRole("button", { name: "LOGOUT" }));

  await waitFor(
    () => {
      expect(sessionStorage.getItem(ID_TOKEN_STORAGE_KEY)).toBeNull();
    },
    { timeout: 2000 },
  );
  expect(sessionStorage.getItem("twitch-auth")).toBeNull();
  // nonce は新 nonce に rotate されている
  const newNonce = localStorage.getItem("oauth_nonce");
  expect(newNonce).not.toBeNull();
  expect(newNonce).not.toBe("n1");
  expect(await findByText("ENTRANCE")).toBeInTheDocument();
});

// =============================================================================
// meQuery error correctness
// =============================================================================

test("in-flight stale meQuery が 401 を返しても、Phase A 後の reset で誤発動しない (regression)", async () => {
  // stale-id_token シナリオの低レベル確認 — reset が in-flight の error を
  // 無視させていることを直接 assert する (regression PR #91)。
  const oldNonce = "old";
  const newNonce = "new";
  const oldIdToken = fakeJwt({ nonce: oldNonce, sub: "u1" });
  const newIdToken = fakeJwt({ nonce: newNonce, sub: "u1" });

  sessionStorage.setItem(ID_TOKEN_STORAGE_KEY, JSON.stringify(oldIdToken));
  localStorage.setItem("oauth_nonce", newNonce);
  window.location.hash = `#access_token=at&id_token=${newIdToken}&token_type=bearer`;

  const { findByText, calls } = renderWithProvider((bearer) =>
    bearer === newIdToken
      ? { ok: true, data: { user: DEFAULT_USER } }
      : { ok: false },
  );

  expect(
    await findByText("AUTHENTICATED", {}, { timeout: 3000 }),
  ).toBeInTheDocument();

  // OLD Bearer で最低 1 回 (mount 直後の初回 fetch) 叩いているはず
  expect(
    calls.some((c) => c.path === "auth.me" && c.bearer === oldIdToken),
  ).toBe(true);
});
