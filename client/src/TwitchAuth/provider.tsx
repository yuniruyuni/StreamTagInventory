import { type FC, type ReactNode, useEffect, useRef, useState } from "react";
import { SWRConfig } from "swr";
import { getAuthProvider } from "~/auth";
import { APP_BASE_URL } from "~/constant";
import { clearSid, setSid, trpc } from "~/trpc/client";
import { useSession } from "~/useStorage";
import { type AuthToken, TwitchAuthContext } from "./context";
import { clearHash, parseAuthFromHash } from "./utils";

/** nonce を Twitch redirect 往復の間に保管する sessionStorage key */
const NONCE_STORAGE_KEY = "oauth_nonce";

type Props = {
  scope: string[];
  entrance: (uri: string) => ReactNode;
  children: ReactNode;
};

/**
 * OIDC Implicit Hybrid Flow 用の AuthProvider (ADR 0006 = Bearer 方式)。
 *
 * **Invariant**: Twitch session (sessionStorage の access_token) が上位、
 * server session (sessionStorage の sid) はそれに従属する。access_token と
 * sid は同じ sessionStorage に置くので寿命が揃う (tab close で両方消滅)。
 *
 * 状態遷移:
 *   - URL fragment あり → Phase 1 が login mutation → sid を sessionStorage 保存
 *   - access_token 有 + auth.me 200 → 完全ログイン、app 表示
 *   - access_token 有 + auth.me 401 → 乖離: token を消して Entrance へ
 *   - access_token 無 → 即 Entrance フロー (startNonce → authorize URL)
 *
 * CSRF 対策は不要 (Bearer は browser が自動転送しないため、cross-site attacker
 * が他人の header を付けたリクエストを作れない。ADR 0006 参照)。
 */
export const TwitchAuthProvider: FC<Props> = ({
  scope,
  entrance,
  children,
}) => {
  const [token, setToken, removeToken] = useSession<AuthToken>(
    "twitch-auth",
    "",
  );
  const [authorizeUrl, setAuthorizeUrl] = useState<string | null>(null);
  const loginFiredRef = useRef(false);
  const startNonceFiredRef = useRef(false);

  const startNonceMutation = trpc.auth.startNonce.useMutation();
  const loginMutation = trpc.auth.login.useMutation();
  const logoutMutation = trpc.auth.logout.useMutation();
  // access_token が無ければ server session も意味をなさない (invariant) ので
  // meQuery は呼ばない。Entrance で 401 ノイズが出るのも抑制。
  const meQuery = trpc.auth.me.useQuery(undefined, {
    retry: false,
    enabled: !!token,
  });

  // Phase 1: Twitch callback fragment 処理 (#access_token=...&id_token=...)
  // biome-ignore lint/correctness/useExhaustiveDependencies: one-shot on mount
  useEffect(() => {
    if (loginFiredRef.current) return;
    const auth = parseAuthFromHash();
    if (!auth) return;
    loginFiredRef.current = true;

    setToken(auth.accessToken);
    clearHash();

    const storedNonce = sessionStorage.getItem(NONCE_STORAGE_KEY);
    sessionStorage.removeItem(NONCE_STORAGE_KEY);
    if (!storedNonce) {
      console.error("nonce missing from sessionStorage");
      removeToken();
      return;
    }

    loginMutation.mutate(
      { idToken: auth.idToken, nonce: storedNonce },
      {
        onSuccess: (data) => {
          setSid(data.sid);
          // login 成功直後に auth.me を refetch して user を更新
          meQuery.refetch();
        },
        onError: (err) => {
          console.error("login failed", err);
          removeToken();
        },
      },
    );
  }, []);

  // Phase 2: token 有 + meQuery 401 の乖離は invariant 違反。両方クリアして
  // Entrance へ落とす (sessionStorage の一方だけ消えたなど想定外の状態回復)。
  useEffect(() => {
    if (token && meQuery.isError) {
      console.warn("access_token exists but server session is gone; resetting");
      removeToken();
      clearSid();
    }
  }, [token, meQuery.isError, removeToken]);

  // Phase 3: access_token 無しの状態で startNonce → Entrance URL を用意。
  // biome-ignore lint/correctness/useExhaustiveDependencies: one-shot conditional on token
  useEffect(() => {
    if (startNonceFiredRef.current) return;
    if (loginFiredRef.current) return; // Twitch callback 処理中
    if (token) return;
    startNonceFiredRef.current = true;

    startNonceMutation.mutate(undefined, {
      onSuccess: (data) => {
        sessionStorage.setItem(NONCE_STORAGE_KEY, data.nonce);
        const authProvider = getAuthProvider({
          get: () => token,
          set: setToken,
          remove: removeToken,
        });
        const uri = authProvider.getEntranceUri(
          `${APP_BASE_URL}/`,
          scope,
          data.nonce,
        );
        setAuthorizeUrl(uri);
      },
      onError: (err) => {
        console.error("startNonce failed", err);
      },
    });
  }, [token]);

  const logout = async () => {
    try {
      await logoutMutation.mutateAsync();
    } catch (err) {
      console.error("logout failed (ignored)", err);
    } finally {
      clearSid();
      removeToken();
      sessionStorage.removeItem(NONCE_STORAGE_KEY);
    }
  };

  // --- Render ---

  if (token && meQuery.isPending) return <>Loading...</>;
  if (loginMutation.isPending) return <>Loading...</>;

  // 完全ログイン
  if (token && meQuery.data) {
    return (
      <TwitchAuthContext.Provider
        value={{ token, user: meQuery.data.user, logout }}
      >
        <SWRConfig
          value={{
            onError: (err) => {
              // Twitch API 401 = access_token 失効 → logout で全部クリア
              if (err && typeof err === "object" && "status" in err) {
                if ((err as { status?: number }).status === 401) logout();
              }
            },
          }}
        >
          {children}
        </SWRConfig>
      </TwitchAuthContext.Provider>
    );
  }

  if (startNonceMutation.isError) {
    return (
      <div style={{ padding: 16 }}>
        <p>
          認証準備に失敗しました
          (auth.startNonce)。ページをリロードしてください。
        </p>
        <p style={{ color: "crimson" }}>{String(startNonceMutation.error)}</p>
      </div>
    );
  }

  if (authorizeUrl) return <>{entrance(authorizeUrl)}</>;
  return <>Loading...</>;
};
