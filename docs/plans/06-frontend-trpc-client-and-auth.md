# PR 6: Frontend tRPC client + auth provider 改修

## コンテキスト

### このシリーズについて
本 PR は「Twitch OIDC 認証 + テンプレートのサーバー保存」第 6 弾。共通設計・セキュリティモデルは [`00-overview.md`](./00-overview.md) を参照。

### 前提
- PR 1〜5 でバックエンドが `auth.startNonce` / `auth.login` / `auth.logout` / `auth.me` / `templates.sync` を提供済
- Frontend は現状 OAuth Implicit Flow (`response_type=token`) で sessionStorage に access_token 保管
- テンプレートはまだ localStorage 保管 (PR 7 で Y.Doc 化)

### この PR の目的
- **tRPC client セットアップ**: `@trpc/client` + `@trpc/react-query` + `@tanstack/react-query` 追加、`<TRPCProvider>` で App 全体ラップ
- **Auth provider 改修**: id_token もサーバへ POST → HttpOnly Cookie でセッション確立。access_token は **従来通り sessionStorage 維持** (Twitch API 直接呼出は無変更)
- **`auth/twitch.ts` の改修**: `response_type=token id_token`、`openid` scope、`nonce` パラメータ追加
- **`CLIENT_ID` の環境変数化**: `BUN_PUBLIC_TWITCH_CLIENT_ID` 経由

### 設計の根拠
- **既存 SWR + Twitch 直接呼出は無変更**: テンプレート適用 / カテゴリ検索 / チャンネル情報取得は client が直接 Twitch を叩く設計を維持 (00-overview.md の方針)
- **csrfToken は Context で memory 保持**: Cookie に出さないことで XSS 耐性向上
- **fragment parse の二重対応**: 既存の access_token 抽出に id_token 抽出を追加。レガシー Implicit Flow も一時的にサポート可 (本 PR では新方式に切替えて旧 parse は削除)
- **nonce 取得タイミング**: ログインボタンクリック時に `auth.startNonce` を叩き、authorize URL に組み込む

### 後続 PR との関係
- PR 7 (テンプレート tRPC 化) が本 PR で導入した tRPC client を使用
- PR 8 (E2E) が本 PR で導入した Cookie ベース認証フローをテスト

---

## タスク

### 0. 既存コードの確認

実装前に以下を読むこと:
- `client/src/auth/twitch.ts` — 現状の `getEntranceUri` (Implicit Flow)
- `client/src/TwitchAuth/provider.tsx` — 現状の AuthProvider (sessionStorage 利用)
- `client/src/TwitchAuth/utils.ts` — `parseTokenFromHash`, `clearHash`
- `client/src/TwitchAuth/context.tsx` — `AuthInfo` 型
- `client/src/Entrance/component.tsx` — ログイン画面
- `client/src/index.tsx` — App 全体のエントリーポイント
- `client/src/constant.ts` — 現状の CLIENT_ID ハードコード
- 04-trpc-middleware-and-auth-router.md の AppRouter 構造

### 1. 依存関係の追加

```bash
cd client && bun add @trpc/client @trpc/react-query @tanstack/react-query @trpc/server
```

- `@trpc/server` は型のみ import するため、devDependencies でも可
- バージョン: `@trpc/*` は ^11.x、`@tanstack/react-query` は ^5.x

### 2. AppRouter 型を server から import できるようにする

`client/tsconfig.json` の `paths` に `~server/*` 等のエイリアスを追加するか、または相対パス (`../server/src/presentation/trpc/routers`) で import するか選ぶ。

**推奨**: workspace package として server を type 参照。`client/package.json` の dependencies に `"server": "workspace:*"` を追加し、`server/package.json` の `exports` に router 型を公開:

```json
// server/package.json
{
  "exports": {
    "./trpc": "./src/presentation/trpc/routers/index.ts"
  }
}
```

```typescript
// client/src/trpc/client.ts
import type { AppRouter } from "server/trpc";
```

これにより client から server の型のみを import できる。**実コードは bundle されない** (型情報のみ)。

### 3. `client/src/trpc/client.ts` を新規作成

```typescript
import { createTRPCReact, httpBatchLink } from "@trpc/react-query";
import type { AppRouter } from "server/trpc";

export const trpc = createTRPCReact<AppRouter>();

// CSRF token の memory store (Provider で値を更新)
let csrfTokenStore: string | null = null;

export const setCsrfToken = (token: string | null) => {
  csrfTokenStore = token;
};

export const getCsrfToken = (): string | null => csrfTokenStore;

export const trpcClient = trpc.createClient({
  links: [
    httpBatchLink({
      url: "/api/trpc",
      fetch: (url, options) =>
        fetch(url, {
          ...options,
          credentials: "same-origin",  // Cookie 自動送信
        }),
      headers: () => {
        const csrf = getCsrfToken();
        return csrf ? { "x-csrf-token": csrf } : {};
      },
    }),
  ],
});
```

### 4. `client/src/trpc/provider.tsx` を新規作成

```typescript
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { useState } from "react";
import { trpc, trpcClient } from "./client";

export const TRPCProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [queryClient] = useState(() => new QueryClient({
    defaultOptions: {
      queries: {
        staleTime: 1000 * 60,         // 1 分
        retry: false,
      },
    },
  }));

  return (
    <trpc.Provider client={trpcClient} queryClient={queryClient}>
      <QueryClientProvider client={queryClient}>
        {children}
      </QueryClientProvider>
    </trpc.Provider>
  );
};
```

### 5. `client/src/constant.ts` を改修

```typescript
// 旧: export const CLIENT_ID = "d2kz8x5se7k6b1n0picux0r7kaozi3";

// 新: 環境変数経由
export const CLIENT_ID =
  (import.meta.env?.BUN_PUBLIC_TWITCH_CLIENT_ID as string | undefined) ??
  "d2kz8x5se7k6b1n0picux0r7kaozi3";  // fallback (開発時用)

export const APP_BASE_URL =
  (import.meta.env?.BUN_PUBLIC_APP_BASE_URL as string | undefined) ??
  "http://localhost:3000";
```

**メモ**:
- Bun bundler の env 注入方法: `BUN_PUBLIC_*` prefix で client 側に埋め込まれる (Bun の仕様確認)
- もし Bun bundler が `import.meta.env` をサポートしないなら、`process.env.BUN_PUBLIC_*` または `globalThis` 経由に変更
- `package.json` の `watch:run` script で `BUN_PUBLIC_TWITCH_CLIENT_ID=$TWITCH_CLIENT_ID bun build` のように環境変数を伝播させる必要があるかも (要確認)

### 6. `client/src/auth/twitch.ts` を改修

```typescript
import { CLIENT_ID } from "../constant";

class TwitchAuthProvider {
  // ...

  getEntranceUri(redirectUrl: string, scope: string[], nonce: string): string {
    const params = new URLSearchParams({
      response_type: "token id_token",   // ← 変更
      client_id: CLIENT_ID,
      redirect_uri: redirectUrl,
      scope: ["openid", ...scope].join(" "),  // ← openid 追加
      nonce,                              // ← 追加
      claims: JSON.stringify({
        id_token: { preferred_username: null },
      }),
    });
    return `https://id.twitch.tv/oauth2/authorize?${params.toString()}`;
  }

  // ... 既存の clearToken 等は維持
}
```

**メモ**:
- `scope` 引数に `openid` を含めて呼ぶか、関数内で自動付与するか統一
- `nonce` は呼出側 (Provider) が `auth.startNonce` で取得して渡す

### 7. `client/src/TwitchAuth/utils.ts` を改修

```typescript
import { CLIENT_ID } from "../constant";

export interface AuthFromHash {
  accessToken: string;
  idToken: string;
}

export function parseAuthFromHash(): AuthFromHash | null {
  // fragment 例: #access_token=xxx&id_token=yyy&token_type=bearer&...
  const hash = window.location.hash;
  if (!hash) return null;

  const params = new URLSearchParams(hash.slice(1));  // "#" を除く
  const accessToken = params.get("access_token");
  const idToken = params.get("id_token");

  if (!accessToken || !idToken) return null;
  return { accessToken, idToken };
}

export function clearHash(): void {
  if (window.location.hash) {
    const title = document.title || "";
    window.history.replaceState("", title, window.location.pathname);
  }
}

// 旧 parseTokenFromHash は削除
```

### 8. `client/src/TwitchAuth/context.tsx` を改修

```typescript
import { createContext } from "react";

export type AuthToken = string;

export interface AuthUser {
  id: string;
  twitchUserId: string;
  login: string;
  displayName: string;
}

export interface AuthInfo {
  token: AuthToken;        // Twitch access_token (sessionStorage 経由、Twitch API 用)
  user: AuthUser | null;
  csrfToken: string;
  logout: () => Promise<void>;
}

export const TwitchAuthContext = createContext<AuthInfo>({
  token: "",
  user: null,
  csrfToken: "",
  logout: async () => {},
});
```

### 9. `client/src/TwitchAuth/provider.tsx` を改修

完全な実装例 (要点のみ):

```typescript
import { useEffect, useState } from "react";
import { useSession } from "../useStorage";
import { setCsrfToken, trpc } from "../trpc/client";
import { TwitchAuthContext, type AuthToken } from "./context";
import { Entrance } from "../Entrance";
import { parseAuthFromHash, clearHash } from "./utils";
import { authProvider } from "../auth/twitch";  // singleton
import { APP_BASE_URL } from "../constant";

interface Props {
  scope: string[];
  entrance: (uri: string) => React.ReactNode;
  children: React.ReactNode;
}

export const TwitchAuthProvider: React.FC<Props> = ({ scope, entrance, children }) => {
  const [token, setToken, clearToken] = useSession<AuthToken>("twitch-auth", "");
  const [authorizeUrl, setAuthorizeUrl] = useState<string | null>(null);

  const startNonceMutation = trpc.auth.startNonce.useMutation();
  const loginMutation = trpc.auth.login.useMutation();
  const logoutMutation = trpc.auth.logout.useMutation();
  const meQuery = trpc.auth.me.useQuery(undefined, {
    retry: false,
    enabled: !!token,  // access_token があるときだけ me を試行
  });

  // 1. 起動時: fragment から token を抽出
  useEffect(() => {
    const auth = parseAuthFromHash();
    if (!auth) return;
    setToken(auth.accessToken);
    clearHash();
    // id_token をサーバへ送る
    // nonce は session storage に保存しておく必要あり (startNonce の戻り値を一時保管)
    const storedNonce = sessionStorage.getItem("oauth_nonce");
    if (!storedNonce) {
      console.error("nonce not found in sessionStorage");
      return;
    }
    sessionStorage.removeItem("oauth_nonce");
    loginMutation.mutate(
      { idToken: auth.idToken, nonce: storedNonce },
      {
        onSuccess: (data) => {
          setCsrfToken(data.csrfToken);
          // me を refetch
          meQuery.refetch();
        },
      },
    );
  }, []);

  // 2. csrfToken を Context 値が更新されたら memory store にも反映
  useEffect(() => {
    if (meQuery.data?.csrfToken) {
      setCsrfToken(meQuery.data.csrfToken);
    }
  }, [meQuery.data?.csrfToken]);

  // 3. 未ログイン (token なし or me failed) → Entrance を生成
  useEffect(() => {
    if (token && meQuery.data) return;       // ログイン済
    if (token && meQuery.isLoading) return;  // 取得中
    // 未ログイン: nonce を取得して authorize URL を組み立て
    startNonceMutation.mutate(undefined, {
      onSuccess: (data) => {
        sessionStorage.setItem("oauth_nonce", data.nonce);
        const uri = authProvider.getEntranceUri(
          `${APP_BASE_URL}/`,
          scope,
          data.nonce,
        );
        setAuthorizeUrl(uri);
      },
    });
  }, [token, meQuery.data, meQuery.isLoading]);

  const logout = async () => {
    try {
      await logoutMutation.mutateAsync();
    } finally {
      setCsrfToken(null);
      clearToken();
      sessionStorage.removeItem("oauth_nonce");
    }
  };

  // 描画分岐
  if (!token || !meQuery.data) {
    if (!authorizeUrl) return <div>Loading...</div>;
    return <>{entrance(authorizeUrl)}</>;
  }

  return (
    <TwitchAuthContext.Provider
      value={{
        token,
        user: meQuery.data.user,
        csrfToken: meQuery.data.csrfToken,
        logout,
      }}
    >
      {children}
    </TwitchAuthContext.Provider>
  );
};
```

**注意点**:
- `useEffect` の依存配列とライフサイクル管理が複雑。React の StrictMode で二重発火する可能性に注意
- `loginMutation` は idempotent ではない (nonce が consume される)。二重実行で 2 回目が失敗する → onSuccess で必ず nonce 削除
- nonce を sessionStorage に置くのはやや汚い。Provider component 内 state でもよいが、page reload で消えるのでフロー失敗の可能性。**sessionStorage 案を採用** (起動 → ログインボタン押下 → リダイレクト → 戻り の流れで sessionStorage は保持される)

### 10. `client/src/Entrance/component.tsx` の確認

```typescript
// 既存実装は uri を受け取って Link で表示。変更不要。
// ただし Link が anchor element を出力するなら、`href={uri}` で素直に Twitch にリダイレクトされるか確認
```

### 11. `client/src/index.tsx` を改修

```typescript
import { TRPCProvider } from "./trpc/provider";
// ... 他の import

const App = () => (
  <TRPCProvider>
    <TwitchAuthProvider
      scope={["user:edit:broadcast", "channel:manage:broadcast", "channel_editor"]}
      entrance={(uri) => <Entrance uri={uri} />}
    >
      <MainScreen />
    </TwitchAuthProvider>
  </TRPCProvider>
);
```

`TwitchAuthProvider` の外側に `<TRPCProvider>` を置くこと (Provider が tRPC hook を使うため)。

### 12. SWR config の整理

既存の `SWRConfig` で 401 自動 logout している箇所がある (`provider.tsx` 内)。tRPC は React Query を使うため別ハンドリング:
- `QueryClient` の `defaultOptions.queries.onError` で 401 を検知 → logout
- もしくは個別 query の `onError` で対応
- 既存の SWR は **削除しない** (Twitch 直接呼出で継続使用)、SWRConfig も残す

### 13. ビルド時 env 注入の確認

開発サーバ (`bun run watch:run`) と production build (`bun run build`) で `BUN_PUBLIC_TWITCH_CLIENT_ID` が正しく埋め込まれることを確認:

```bash
# 1. 環境変数 set
export BUN_PUBLIC_TWITCH_CLIENT_ID=d2kz8x5se7k6b1n0picux0r7kaozi3
export BUN_PUBLIC_APP_BASE_URL=http://localhost:3000

# 2. build
bun run build

# 3. 出力 JS で文字列がインライン化されているか確認
grep -r 'd2kz8x5se7k6b1n0picux0r7kaozi3' client/static/
```

### 14. Twitch app 設定 (手動)

開発用 Twitch app:
- Twitch Developer Console → Application
- OAuth Redirect URLs に `http://localhost:3000/` を登録
- Client Type は **Public** のまま

本番用は PR 8 で対応。

---

## テスト

### Unit Test
- `client/src/TwitchAuth/provider.test.tsx`: 
  - 未ログイン (token なし) → `auth.startNonce` が呼ばれて Entrance 表示
  - fragment あり → `auth.login` 呼出 → meQuery refetch → children 描画
  - logout → token / csrfToken クリア
- `client/src/TwitchAuth/utils.test.ts`:
  - `parseAuthFromHash` 各種ケース
  - `clearHash`

tRPC mock は `msw` + `@trpc/client` の `httpLink` 差し替えか、または `trpc.useMutation` を mock するパターン。

### Manual Verification
1. 開発用 Twitch app の CLIENT_ID を環境変数に設定
2. `bun run watch:run` で起動
3. ブラウザで `http://localhost:3000` を開く
4. ログインボタン → Twitch 同意画面 → callback (fragment 経由)
5. DevTools Network タブで:
   - `/api/trpc/auth.startNonce` が POST されている
   - `/api/trpc/auth.login` が POST され、`Set-Cookie: __Host-sid=...` が返る
   - `/api/trpc/auth.me` が `user` を返す
6. ログアウトボタン → Cookie がクリアされる

---

## Definition of Done

- [ ] `client/package.json` に tRPC + React Query 追加
- [ ] `client/src/trpc/{client,provider}.tsx` 作成
- [ ] `client/src/constant.ts` の CLIENT_ID 環境変数化
- [ ] `client/src/auth/twitch.ts` で `response_type=token id_token` + nonce 対応
- [ ] `client/src/TwitchAuth/utils.ts` で `parseAuthFromHash` 実装、旧 `parseTokenFromHash` 削除
- [ ] `client/src/TwitchAuth/context.tsx` で `AuthInfo` 拡張
- [ ] `client/src/TwitchAuth/provider.tsx` 改修 (id_token POST、me query、csrfToken 管理)
- [ ] `client/src/index.tsx` で `<TRPCProvider>` ラップ
- [ ] AppRouter 型が server から型 import できる仕組み
- [ ] `bun run check` 全緑
- [ ] `bun run build` 成功 (env 埋込み確認)
- [ ] 手動: ログイン → セッション確立 → ログアウト の通しで正常動作

---

## 既知の落とし穴

- **`__Host-` Cookie の Secure 必須**: localhost では HTTPS が無いため Cookie が set されない可能性。PR 4 で `secure: process.env.NODE_ENV === "production"` の switching を入れたか確認。本 PR では開発時の挙動を再確認
- **nonce の sessionStorage 経由**: ブラウザタブを閉じると消える。開いたまま Twitch リダイレクトを通る限りは保持される
- **二重ログイン (loginMutation 二重実行)**: React StrictMode で `useEffect` が 2 回発火 → 2 回目で nonce が consume 済 → fail。useRef で「実行済」フラグを立てるか、または mutation の onSettled で sessionStorage から nonce を消す設計
- **`@trpc/server` を client にインストール**: bundle に server コードが入らないよう、type-only import を厳守。`tsconfig` の `verbatimModuleSyntax` 等で機械的にチェック
- **AppRouter 型の循環**: server → client への型参照は OK だが、server から client を参照しないこと
- **tRPC の `useMutation` vs `mutate` vs `mutateAsync`**: `mutate` は fire-and-forget、`mutateAsync` は Promise。エラーハンドリングを忘れずに
- **既存 SWR との共存**: tRPC は React Query を使うため、二重で同じデータを fetch する可能性。明確に責務分離 (Twitch API は SWR、tRPC は `auth.*` と `templates.sync`。テンプレート本体は Y.Doc + y-indexeddb 管理で tRPC は sync のみ使う)
- **Bun の `import.meta.env` サポート**: 確認が必要。サポートしていない場合は `globalThis.BUN_PUBLIC_*` 経由 or build スクリプトでテキスト置換
- **`csrfToken` の memory store がモジュールスコープ**: テスト並列実行で衝突しないか? React strict mode で同一プロセス内なので影響なし。実プロダクションでも server-side rendering をしないため問題なし
- **Network タブで access_token が見えてしまう**: fragment は Network タブの URL に出ないが、`Referer` ヘッダで漏洩する可能性。`Referrer-Policy: strict-origin-when-cross-origin` を維持 (既存の secureHeaders で設定済)
