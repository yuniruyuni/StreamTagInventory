import { useQueryClient } from "@tanstack/react-query";
import {
  type FC,
  type ReactNode,
  useCallback,
  useEffect,
  useRef,
  useState,
} from "react";
import { SWRConfig } from "swr";
import { getAuthProvider } from "~/auth";
import { APP_BASE_URL } from "~/constant";
import { setIdTokenForTrpc, trpc } from "~/trpc/client";
import { useSession } from "~/useStorage";
import { type AuthToken, TwitchAuthContext } from "./context";
import {
  clearHash,
  generateNonce,
  parseAuthFromHash,
  peekIdTokenNonce,
} from "./utils";

/** nonce を Twitch redirect 往復の間に保管する sessionStorage key */
const NONCE_STORAGE_KEY = "oauth_nonce";

type Props = {
  scope: string[];
  entrance: (uri: string) => ReactNode;
  children: ReactNode;
};

/**
 * OIDC Implicit Hybrid Flow + stateless JWT Bearer (ADR 0007) 用の AuthProvider。
 *
 * **設計原則**: server 側 session を持たず、Twitch id_token をそのまま Bearer
 * として毎リクエスト送信する。client が保管する 2 値:
 *   - `twitch-auth` (access_token) — Twitch API 直接呼出用
 *   - `twitch-id-token` (id_token JWT) — 当 server への Bearer 認証用
 * いずれも sessionStorage で寿命が揃う (tab close で両方消滅)。
 *
 * **状態遷移**:
 *   - URL fragment あり → Phase A が nonce 照合 → idToken/accessToken 保存
 *   - idToken 有 + auth.me 200 → 完全ログイン
 *   - idToken 有 + auth.me 401 → Phase B が両方クリアして Entrance へ落とす
 *   - idToken 無 → Phase C が nonce を生成して authorize URL を組み立てる
 *
 * **race の排除**: ADR 0007 で server side の login/startNonce mutation を撤去
 * したため、本 provider に async mutation phase は存在しない。idToken の
 * 有無で「ログイン状態」が一意に決まり、二重 storage の race は構造的に発生しない。
 */
export const TwitchAuthProvider: FC<Props> = ({
  scope,
  entrance,
  children,
}) => {
  // access_token と id_token は別 key で保管。setter / remover を別個に持つ。
  const [accessToken, setAccessToken, removeAccessToken] =
    useSession<AuthToken>("twitch-auth", "");
  const [idToken, setIdToken, removeIdToken] = useSession<AuthToken>(
    "twitch-id-token",
    "",
  );
  const [authorizeUrl, setAuthorizeUrl] = useState<string | null>(null);
  const callbackHandledRef = useRef(false);
  const queryClient = useQueryClient();

  // idToken が空の間は無効 (`enabled: false`) で 401 ノイズを抑制する。
  const meQuery = trpc.auth.me.useQuery(undefined, {
    retry: false,
    enabled: !!idToken,
  });

  // trpc link に現在の id_token を注入する。sessionStorage の知識は useSession が
  // 独占し、trpc link は slot を読むだけ。render 毎に同期することで、setIdToken が
  // 発生した直後の meQuery auto-fetch でも最新値が Bearer に乗る。
  useEffect(() => {
    setIdTokenForTrpc(idToken || null);
  }, [idToken]);

  // Phase A (one-shot): Twitch callback の URL fragment を消費し、id_token と
  // access_token を sessionStorage に保管する。`callbackHandledRef` で
  // StrictMode の double-invoke もガード。
  // biome-ignore lint/correctness/useExhaustiveDependencies: one-shot on mount
  useEffect(() => {
    if (callbackHandledRef.current) return;
    const parsed = parseAuthFromHash();
    if (!parsed) return;
    callbackHandledRef.current = true;
    clearHash();

    const storedNonce = sessionStorage.getItem(NONCE_STORAGE_KEY);
    sessionStorage.removeItem(NONCE_STORAGE_KEY);
    const claimNonce = peekIdTokenNonce(parsed.idToken);
    if (!storedNonce || storedNonce !== claimNonce) {
      // mix-up 攻撃 or sessionStorage が途中でクリアされた等。callback を破棄
      // して Phase C に Entrance フローを再開させる。
      console.warn("id_token nonce mismatch; rejecting Twitch callback");
      callbackHandledRef.current = false;
      return;
    }

    setAccessToken(parsed.accessToken);
    setIdToken(parsed.idToken);
    // 直後に meQuery が enable 化して identity を取りに行く
  }, []);

  // Phase B: idToken 有 + meQuery 401 → 期限切れ or サーバー側で reject。
  // 両方クリアして Entrance へ落とす。
  useEffect(() => {
    if (idToken && meQuery.isError) {
      console.warn("id_token rejected by server; clearing local tokens");
      removeIdToken();
      removeAccessToken();
    }
  }, [idToken, meQuery.isError, removeIdToken, removeAccessToken]);

  // Phase C: idToken が無い → Entrance URL を組み立てる。
  // nonce は sessionStorage に既に有れば再利用 (Phase A の nonce ライフサイクルと
  // 整合)、無ければ新規生成して保管する。
  // scope は呼出側で毎レンダー新しい配列になり得るので key 化して deps に乗せる。
  const scopeKey = scope.join(" ");
  // biome-ignore lint/correctness/useExhaustiveDependencies: scope は scopeKey で代替
  useEffect(() => {
    if (idToken) {
      setAuthorizeUrl(null);
      return;
    }
    let nonce = sessionStorage.getItem(NONCE_STORAGE_KEY);
    if (!nonce) {
      nonce = generateNonce();
      sessionStorage.setItem(NONCE_STORAGE_KEY, nonce);
    }
    const provider = getAuthProvider({
      get: () => idToken,
      set: setIdToken,
      remove: removeIdToken,
    });
    const uri = provider.getEntranceUri(`${APP_BASE_URL}/`, scope, nonce);
    setAuthorizeUrl(uri);
  }, [idToken, scopeKey, setIdToken, removeIdToken]);

  const logout = useCallback(async () => {
    // server 側に通知すべき状態は無い (ADR 0007: stateless)。client local の
    // sessionStorage を全部掃除 + React Query の cache を破棄して Entrance フローを
    // 再開させる。cache を残すと次の user で stale な me / template が flash する。
    removeIdToken();
    removeAccessToken();
    sessionStorage.removeItem(NONCE_STORAGE_KEY);
    queryClient.clear();
    callbackHandledRef.current = false;
    setAuthorizeUrl(null);
  }, [removeIdToken, removeAccessToken, queryClient]);

  // --- Render ---

  if (idToken && meQuery.isPending) return <>Loading...</>;

  // 完全ログイン
  if (idToken && meQuery.data) {
    return (
      <TwitchAuthContext.Provider
        value={{ token: accessToken, user: meQuery.data.user, logout }}
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

  if (authorizeUrl) return <>{entrance(authorizeUrl)}</>;
  return <>Loading...</>;
};
