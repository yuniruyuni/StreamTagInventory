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

/** nonce を Twitch redirect 往復の間に保管する sessionStorage key */
const NONCE_STORAGE_KEY = "oauth_nonce";
/**
 * nonce mismatch 時に auto-retry した回数を保持する sessionStorage key。
 * Twitch が前 session の id_token を cache して stale nonce で返すバグの
 * 回避策として用いる。MAX を超えたら retry 停止して Entrance を出す。
 */
const RETRY_COUNT_STORAGE_KEY = "oauth_retry_count";
const MAX_AUTO_RETRIES = 2;

/**
 * 診断ログ。nonce mismatch の真因調査用に ensureNonce / rotateNonce /
 * Phase A の各イベント発火時点で console.log する。mismatch 検知時点では
 * 既に storage が rewrite 済みのため、イベントが起きた瞬間に記録しないと
 * 真相が追えない。
 *
 * 再現時は DevTools Console の "Preserve log upon navigation" を ON にして
 * これらの行を時系列で追う。prefix `[auth]` で grep しやすくしてある。
 */
function diag(msg: string): void {
  console.log(`[auth] ${msg}`);
}

/**
 * mount 時点で sessionStorage に nonce が無ければ同期的に発行する。
 * useState の lazy init は first render の前に走るため、authorize URL を組み
 * 立てる時点で必ず sessionStorage に nonce が居る状態が保証される。
 */
function ensureNonce(): string {
  const existing = sessionStorage.getItem(NONCE_STORAGE_KEY);
  if (existing) {
    diag(`ensureNonce read=${existing} (no gen)`);
    return existing;
  }
  const fresh = generateNonce();
  sessionStorage.setItem(NONCE_STORAGE_KEY, fresh);
  diag(`ensureNonce read=<null> generated=${fresh}`);
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
   * sessionStorage と React state の両方を同期的に更新する。
   */
  const rotateNonce = useCallback(() => {
    const before = sessionStorage.getItem(NONCE_STORAGE_KEY);
    sessionStorage.removeItem(NONCE_STORAGE_KEY);
    const fresh = generateNonce();
    sessionStorage.setItem(NONCE_STORAGE_KEY, fresh);
    setNonce(fresh);
    diag(`rotateNonce before=${before ?? "<null>"} after=${fresh}`);
  }, []);

  // Phase A (one-shot): Twitch callback の URL fragment を消費し、id_token と
  // access_token を sessionStorage に保管する。`callbackHandledRef` で
  // StrictMode の double-invoke もガード。
  // biome-ignore lint/correctness/useExhaustiveDependencies: one-shot on mount
  useEffect(() => {
    diag(
      `phaseA enter hash=${window.location.hash ? "present" : "<empty>"} state.nonce=${nonce} storage.nonce=${sessionStorage.getItem(NONCE_STORAGE_KEY) ?? "<null>"} callbackHandled=${callbackHandledRef.current}`,
    );
    if (callbackHandledRef.current) return;
    const parsed = parseAuthFromHash();
    if (!parsed) {
      diag("phaseA no-hash (early return)");
      return;
    }
    callbackHandledRef.current = true;
    clearHash();

    const claimNonce = peekIdTokenNonce(parsed.idToken);
    diag(
      `phaseA compare claim=${claimNonce ?? "<null>"} state.nonce=${nonce} storage.nonce=${sessionStorage.getItem(NONCE_STORAGE_KEY) ?? "<null>"}`,
    );
    if (claimNonce !== nonce) {
      // Twitch のキャッシュ問題で stale nonce の id_token が返されることがある
      // (前タブで login 成功 → タブ close → 新タブで login すると再現)。ユーザが
      // もう一度 login ボタンを手動でクリックすれば成功するが UX が悪いので、
      // mismatch を検出したら自動的に authorize URL へ再 navigate する。
      //
      // mix-up 攻撃の場合でも、再 navigate は Twitch が fresh token を返すだけ
      // なので security 上のリスクは無い (stale token は破棄される)。
      //
      // ただし無限 retry ループを避けるため MAX_AUTO_RETRIES で打ち切り、
      // 上限到達時は通常通り Entrance に戻してユーザの再操作を待つ。
      const retryCount = Number(
        sessionStorage.getItem(RETRY_COUNT_STORAGE_KEY) ?? "0",
      );
      // 根本原因 (Twitch の cache バグ vs URL encoding vs 別事象) の特定用に
      // claim / expected の両値を出す。auto-retry の navigation で console が
      // 消えるため、DevTools Console の "Preserve log upon navigation" を ON
      // にしてから再現する。
      const nonceDiag = `claimed=${claimNonce ?? "<null>"} expected=${nonce}`;
      if (retryCount >= MAX_AUTO_RETRIES) {
        console.warn(
          `id_token nonce mismatch; auto-retry exhausted (${retryCount}/${MAX_AUTO_RETRIES}) ${nonceDiag}`,
        );
        sessionStorage.removeItem(RETRY_COUNT_STORAGE_KEY);
        callbackHandledRef.current = false;
        rotateNonce();
        return;
      }
      console.warn(
        `id_token nonce mismatch; auto-retrying (${retryCount + 1}/${MAX_AUTO_RETRIES}) ${nonceDiag}`,
      );
      sessionStorage.setItem(RETRY_COUNT_STORAGE_KEY, String(retryCount + 1));
      rotateNonce();
      const freshNonce =
        sessionStorage.getItem(NONCE_STORAGE_KEY) ?? generateNonce();
      const provider = getAuthProvider({
        get: () => idToken,
        set: setIdToken,
        remove: removeIdToken,
      });
      window.location.href = provider.getEntranceUri(
        `${APP_BASE_URL}/`,
        scope,
        freshNonce,
      );
      return;
    }

    // 一致 → consume + 次回用に新規発行 + retry counter を reset
    sessionStorage.removeItem(RETRY_COUNT_STORAGE_KEY);
    rotateNonce();
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
