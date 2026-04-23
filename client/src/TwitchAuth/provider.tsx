import { useQueryClient } from "@tanstack/react-query";
import {
  type FC,
  type ReactNode,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { SWRConfig } from "swr";
import { getAuthProvider } from "~/auth";
import { LoadingScreen } from "~/components/LoadingScreen";
import { APP_BASE_URL } from "~/constant";
import { ID_TOKEN_STORAGE_KEY, trpc } from "~/trpc/client";
import { useSession } from "~/useStorage";
import { type AuthToken, TwitchAuthContext } from "./context";
import {
  clearHash,
  generateNonce,
  parseAuthFromHash,
  peekIdTokenNonce,
} from "./utils";

/**
 * nonce を Twitch redirect 往復の間に保管する localStorage key。
 *
 * **なぜ localStorage か**: サーバが `Cross-Origin-Opener-Policy: same-origin`
 * を送っているため、OAuth implicit flow の cross-origin redirect
 * (tags → id.twitch.tv → tags) で browsing context group が切り替わり、同じ
 * タブでも sessionStorage が wholesale クリアされる (Chrome 実測)。nonce が
 * callback 着地時に失われて「nonce mismatch で 2 度ログイン要求」の症状に
 * なっていた。localStorage は origin 単位で永続化するため browsing context
 * group の切替に影響されず保持される。
 *
 * **security 上の trade-off**: localStorage は tab 間共有になるが、nonce は
 * authorize URL に平文で載る公開情報で秘匿性は要求されないため影響なし。
 * mix-up 攻撃耐性は被害者独自の storage 値と claim の照合で担保される
 * (URL state 方式と違い、攻撃者が一方的にセットできる値ではない)。
 */
const NONCE_STORAGE_KEY = "oauth_nonce";

/**
 * mount 時点で localStorage に nonce が無ければ同期的に発行する。
 * useState の lazy init は first render の前に走るため、authorize URL を組み
 * 立てる時点で必ず localStorage に nonce が居る状態が保証される。
 */
function ensureNonce(): string {
  const existing = localStorage.getItem(NONCE_STORAGE_KEY);
  if (existing) return existing;
  const fresh = generateNonce();
  localStorage.setItem(NONCE_STORAGE_KEY, fresh);
  return fresh;
}

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
 *   - mount 時に nonce を必ず発行 (`ensureNonce` の lazy init)。authorize URL は
 *     nonce から純粋に derive する
 *   - URL fragment あり → Phase A が nonce 照合 → idToken/accessToken 保存
 *   - idToken 有 + auth.me 200 → 完全ログイン
 *   - idToken 有 + auth.me 401 → Phase B が両方クリアして Entrance へ落とす
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
  const [accessToken, setAccessToken, removeAccessToken] =
    useSession<AuthToken>("twitch-auth", "");
  const [idToken, setIdToken, removeIdToken] = useSession<AuthToken>(
    ID_TOKEN_STORAGE_KEY,
    "",
  );
  const [nonce, setNonce] = useState<string>(ensureNonce);
  const callbackHandledRef = useRef(false);
  const queryClient = useQueryClient();
  const utils = trpc.useUtils();

  // idToken が空の間は無効 (`enabled: false`) で 401 ノイズを抑制する。
  const meQuery = trpc.auth.me.useQuery(undefined, {
    retry: false,
    enabled: !!idToken,
  });

  /**
   * 現 nonce を消費し、次回ログイン用に新しい nonce を発行する。
   * localStorage と React state の両方を同期的に更新する。
   * 用途: mismatch で Entrance に戻す / logout / Phase B cleanup。
   */
  const rotateNonce = useCallback(() => {
    localStorage.removeItem(NONCE_STORAGE_KEY);
    const fresh = generateNonce();
    localStorage.setItem(NONCE_STORAGE_KEY, fresh);
    setNonce(fresh);
  }, []);

  /**
   * login 成功時に nonce を localStorage から完全に削除する。
   * ログイン後は authorize URL は再利用されない (idToken 有で useMemo が null
   * を返すため) ので、storage に残しておく必要がない。次回 Entrance に戻った
   * 時 (logout / Phase B / タブ再訪) は ensureNonce / rotateNonce が新規発行
   * するので OK。
   *
   * React state は更新しない。idToken 有の間は authorizeUrl で読まれないし、
   * 状態変化で不要な re-render を起こさないため。
   */
  const consumeNonce = useCallback(() => {
    localStorage.removeItem(NONCE_STORAGE_KEY);
  }, []);

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

    const claimNonce = peekIdTokenNonce(parsed.idToken);
    if (claimNonce !== nonce) {
      // mix-up 攻撃 or sessionStorage が途中でクリアされた等。callback を破棄
      // して新しい nonce で Entrance をやり直させる。
      console.warn("id_token nonce mismatch; rejecting Twitch callback");
      callbackHandledRef.current = false;
      rotateNonce();
      return;
    }

    // 一致 → storage から nonce を消費 (削除)。次回 login では ensureNonce が
    // 新規発行するので storage に残しておく必要はない。
    consumeNonce();
    setAccessToken(parsed.accessToken);
    setIdToken(parsed.idToken);
    // 前 session の stale id_token が storage に残っていた場合、mount 時に
    // meQuery が OLD Bearer で fetch 済みで 401 を返しつつある状況がある。
    // そのまま放置すると Phase B が isError を見て NEW token 一式を clear して
    // しまうため、in-flight を cancel + state を reset して NEW token での
    // fresh な fetch を強制する。
    void utils.auth.me.cancel();
    utils.auth.me.reset();
    // 直後に meQuery が enable 化して identity を取りに行く
  }, []);

  // Phase B: idToken 有 + meQuery 401 → 期限切れ or サーバー側で reject。
  // 両方クリア + 新 nonce 発行して Entrance へ落とす。
  //
  // isFetching=true の間は cleanup を待つ。Phase A の reset 直後に refetch が
  // 走っている最中で、前 token の stale error を見て誤発動することを防ぐ。
  // fetch が終わって isError=true のままなら本当に reject されたと判断してよい。
  useEffect(() => {
    if (idToken && meQuery.isError && !meQuery.isFetching) {
      console.warn("id_token rejected by server; clearing local tokens");
      removeIdToken();
      removeAccessToken();
      rotateNonce();
    }
  }, [
    idToken,
    meQuery.isError,
    meQuery.isFetching,
    removeIdToken,
    removeAccessToken,
    rotateNonce,
  ]);

  // scope は呼出側で毎レンダー新しい配列になり得るので、内容ベースの key で deps 化。
  // string が同じなら React の Object.is 比較で useMemo は前回の値を維持する。
  const scopeKey = scope.join(" ");
  // authorize URL は idToken / nonce / scopeKey から純粋に derive。useEffect 不要。
  // biome-ignore lint/correctness/useExhaustiveDependencies: scope は scopeKey で代替
  const authorizeUrl = useMemo<string | null>(() => {
    if (idToken) return null;
    const provider = getAuthProvider({
      get: () => idToken,
      set: setIdToken,
      remove: removeIdToken,
    });
    return provider.getEntranceUri(`${APP_BASE_URL}/`, scope, nonce);
  }, [idToken, nonce, scopeKey, setIdToken, removeIdToken]);

  const logout = useCallback(async () => {
    // server 側に通知すべき状態は無い (ADR 0007: stateless)。client local の
    // sessionStorage を全部掃除 + React Query の cache を破棄して Entrance フローを
    // 再開させる。cache を残すと次の user で stale な me / template が flash する。
    removeIdToken();
    removeAccessToken();
    queryClient.clear();
    callbackHandledRef.current = false;
    rotateNonce();
  }, [removeIdToken, removeAccessToken, queryClient, rotateNonce]);

  // --- Render ---

  if (idToken && meQuery.isPending) return <LoadingScreen />;

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
  return <LoadingScreen />;
};
