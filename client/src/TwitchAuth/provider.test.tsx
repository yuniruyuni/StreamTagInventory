import { afterEach, beforeEach, expect, test } from "bun:test";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render } from "@testing-library/react";
import type { TRPCLink } from "@trpc/client";
import { observable } from "@trpc/server/observable";
import type { FC, ReactNode } from "react";
import { I18nWrapper } from "~/test-utils";
import { ID_TOKEN_STORAGE_KEY, trpc } from "~/trpc/client";
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

// biome-ignore lint/suspicious/noExplicitAny: TRPCLink generics は AppRouter 型に依存し、テストでは雑に any で流す
function createMockLink(authMeResponder: AuthMeResponder): {
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

beforeEach(() => {
  sessionStorage.clear();
  window.location.hash = "";
});

afterEach(() => {
  sessionStorage.clear();
  window.location.hash = "";
});

/**
 * 再現テスト: sessionStorage に stale id_token が残っている状態で、URL hash に
 * 新しい id_token を持って callback 戻り → 最終的に MainScreen (AUTHENTICATED)
 * に到達すべき。
 *
 * バグ: Phase A で NEW token に差し替わったあと、meQuery が前 token の 401 error
 * 状態を保持したままで Phase B が発火 → NEW token も clear されて Entrance bounce。
 * ユーザは 2 度ログインしないといけない症状として現れる。
 */
test("stale id_token + callback hash で 2 度ログイン不要 (regression)", async () => {
  const oldNonce = "nonce-old";
  const newNonce = "nonce-new";
  const oldIdToken = fakeJwt({ nonce: oldNonce, sub: "u1" });
  const newIdToken = fakeJwt({ nonce: newNonce, sub: "u1" });

  sessionStorage.setItem(ID_TOKEN_STORAGE_KEY, JSON.stringify(oldIdToken));
  sessionStorage.setItem("twitch-auth", JSON.stringify("old-access"));
  sessionStorage.setItem("oauth_nonce", newNonce);
  window.location.hash = `#access_token=new-access&id_token=${newIdToken}&token_type=bearer&expires_in=14400`;

  // Bearer が OLD → UNAUTHORIZED, NEW → user 情報を返す
  const { link, calls } = createMockLink((bearer) => {
    if (bearer === newIdToken) {
      return {
        ok: true,
        data: {
          user: {
            id: "u1",
            twitchUserId: "u1",
            login: "u",
            displayName: "U",
          },
        },
      };
    }
    return { ok: false };
  });

  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });

  const { findByText, queryByText } = render(
    <Providers queryClient={queryClient} link={link}>
      <TwitchAuthProvider
        scope={["user:edit:broadcast"]}
        entrance={() => <div>ENTRANCE</div>}
      >
        <div>AUTHENTICATED</div>
      </TwitchAuthProvider>
    </Providers>,
  );

  const authed = await findByText("AUTHENTICATED", {}, { timeout: 3000 });
  expect(authed).toBeInTheDocument();
  expect(queryByText("ENTRANCE")).toBeNull();

  // 診断: OLD Bearer で auth.me が走ったこと + 最終的に NEW Bearer で 200 取ったこと
  const authMeCalls = calls.filter((c) => c.path === "auth.me");
  expect(authMeCalls.length).toBeGreaterThanOrEqual(1);
  expect(authMeCalls.some((c) => c.bearer === newIdToken)).toBe(true);
});
