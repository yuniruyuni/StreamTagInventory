# PR 7: Y.Doc プロバイダ + テンプレート UI の CRDT 化 + 移行 UI

## コンテキスト

### このシリーズについて
本 PR は「Twitch OIDC 認証 + テンプレートのサーバー保存」第 7 弾。共通設計・セキュリティモデルは [`00-overview.md`](./00-overview.md) を、データ同期戦略は [ADR 0004](../adr/0004-local-first-sync-with-yjs.md) を参照。

### 前提
- PR 5 で `trpc.templates.sync` が tRPC で利用可能 (単一 procedure、base64 エンコードされた state vector / update を交換)
- PR 6 で client 側 tRPC client + auth provider が整備済
- 現状 client はテンプレートを `useStorage<Template[]>("templates", [])`、postTemplate を `useStorage<string>(POST_TEMPLATE_KEY, DEFAULT_POST_TEMPLATE)` で localStorage に保管
- **Twitch API 直接呼出 (テンプレート適用、カテゴリ検索、チャンネル情報取得) は無変更**

### この PR の目的
- **Yjs による local-first 同期クライアントの構築**:
  - `Y.Doc` + `y-indexeddb` によるローカル永続化
  - tRPC `templates.sync` を呼ぶ独自 provider でサーバと双方向同期
  - オフライン編集キュー / 再接続時の自動同期
- `MainScreen` のテンプレート / postTemplate 保管を Y.Doc 参照に置き換え
- 既存 `useTemplateOperations` の CRUD 部分を Y.Doc 操作に、**Twitch API 呼出 (`onApplyTemplate`) は無変更**
- 既存ユーザー向けの **`MigrationPrompt` Modal** を実装: 初回ログインで localStorage に旧データがあれば「サーバへ移行しますか?」を表示し、承諾されたら Y.Doc に取り込んで sync

### 設計の根拠
- **Optimistic update は不要**: Y.Doc への書込みは即座に `y-indexeddb` でローカル永続化 + UI に反映される。サーバは非同期 sync の片方向パートナー
- **並び替えは Y.Array に委譲**: position 列も fractional indexing も存在しない。D&D は `Y.Array.delete` → `Y.Array.insert` で表現
- **localStorage は即削除しない**: 移行成功で `templates_migrated_at` を記録、1 ヶ月保持してロールバック余地を残す (cleanup は PR 8)
- **既存 import/export 機能は残す**: ユーザーが手動でバックアップ取れるように
- **postTemplate も Y.Doc 内**: 別 hook / 別 endpoint は無し、`doc.getMap('settings').get('postTemplate')` で統一

### 後続 PR との関係
- PR 8 で 1 ヶ月超過判定の localStorage cleanup 処理を起動時に実行

---

## タスク

### 0. 既存コードの確認

実装前に以下を読むこと:
- [`../adr/0004-local-first-sync-with-yjs.md`](../adr/0004-local-first-sync-with-yjs.md) (必読)
- `client/src/MainScreen/component.tsx` — `useStorage<Template[]>("templates", [])` の使い方
- `client/src/hooks/useTemplateOperations.ts` — テンプレート CRUD と Twitch 適用
- `client/src/hooks/useTemplateSearch.ts` — 検索 hook
- `client/src/utils/templateIO.ts` — import/export
- `client/src/utils/postTemplate.ts` — POST_TEMPLATE_KEY と DEFAULT_POST_TEMPLATE
- `client/src/model/template.ts` — Template 型と validateTemplate (client 側の見た目型は維持、Y.Map との変換は本 PR で実装)
- 06-frontend-trpc-client-and-auth.md — `trpc` の使い方

### 1. 依存追加

```bash
bun add yjs y-indexeddb
```

型は Yjs 本体に同梱されている。Bun workspaces の client サブパッケージに追加する。

### 2. `client/src/model/template.ts` の扱い

既存の `Template` 型 (client 側の見た目型) は維持。Y.Map と変換するヘルパーを新設する。

```typescript
// client/src/model/template.ts (既存)
export type Template = {
  id: string;
  title: string;
  category: Category;    // { id, name, box_art_url } (snake_case)
  tags: string[];
};
```

Y.Map のフィールド名は camelCase (`categoryId` / `categoryName` / `categoryBoxArtUrl`) に統一する。Y.Doc 内のフィールド名と DB / tRPC スキーマが一致し、client 画面層の型だけ snake_case を保つ構造になる。

### 3. `client/src/sync/templateDoc.ts` を新規作成

Y.Doc のトップレベル構造定義と client Template との相互変換を集約する。

```typescript
import * as Y from "yjs";
import type { Template } from "../model/template";

/** Y.Doc のルート名前空間: templates (Y.Array<Y.Map>) と settings (Y.Map) */
export const createTemplateDoc = (): Y.Doc => new Y.Doc();

export function getTemplatesArray(doc: Y.Doc): Y.Array<Y.Map<unknown>> {
  return doc.getArray<Y.Map<unknown>>("templates");
}

export function getSettingsMap(doc: Y.Doc): Y.Map<unknown> {
  return doc.getMap("settings");
}

export function yMapToTemplate(m: Y.Map<unknown>): Template {
  const tags = m.get("tags");
  return {
    id: String(m.get("id") ?? ""),
    title: String(m.get("title") ?? ""),
    category: {
      id: String(m.get("categoryId") ?? ""),
      name: String(m.get("categoryName") ?? ""),
      box_art_url: String(m.get("categoryBoxArtUrl") ?? ""),
    },
    tags: tags instanceof Y.Array ? tags.toArray().map(String) : [],
  };
}

export function templateToYMap(t: Template): Y.Map<unknown> {
  const m = new Y.Map<unknown>();
  m.set("id", t.id);
  m.set("title", t.title);
  m.set("categoryId", t.category.id);
  m.set("categoryName", t.category.name);
  m.set("categoryBoxArtUrl", t.category.box_art_url);
  const tags = new Y.Array<string>();
  tags.push(t.tags);
  m.set("tags", tags);
  return m;
}

export function readPostTemplate(doc: Y.Doc): string {
  const v = getSettingsMap(doc).get("postTemplate");
  return typeof v === "string" ? v : "";
}

export function writePostTemplate(doc: Y.Doc, value: string): void {
  getSettingsMap(doc).set("postTemplate", value);
}

export function encodeStateVector(doc: Y.Doc): Uint8Array {
  return Y.encodeStateVector(doc);
}

export function encodeStateAsUpdate(doc: Y.Doc, since?: Uint8Array): Uint8Array {
  return Y.encodeStateAsUpdate(doc, since);
}

export function applyRemoteUpdate(doc: Y.Doc, update: Uint8Array): void {
  Y.applyUpdate(doc, update, "remote");
}
```

### 4. `client/src/sync/tRpcSyncProvider.ts` を新規作成

tRPC `templates.sync` を呼んでサーバと双方向同期する provider。

```typescript
import * as Y from "yjs";
import type { TrpcClient } from "../trpc/client";
import {
  applyRemoteUpdate,
  encodeStateAsUpdate,
  encodeStateVector,
} from "./templateDoc";

const DEBOUNCE_MS = 500;
const POLL_MS = 30_000;

export interface TRpcSyncProviderOptions {
  doc: Y.Doc;
  trpc: TrpcClient;
  onError?: (err: unknown) => void;
}

export class TRpcSyncProvider {
  private lastServerStateVector: Uint8Array | undefined;
  private pending = false;
  private debounceTimer: ReturnType<typeof setTimeout> | undefined;
  private pollTimer: ReturnType<typeof setInterval> | undefined;
  private focusHandler = () => void this.sync();
  private onlineHandler = () => void this.sync();
  private updateHandler = (_update: Uint8Array, origin: unknown) => {
    // 'remote' origin は自身で applyUpdate したもの。ループさせない
    if (origin === "remote") return;
    this.scheduleSync();
  };

  constructor(private readonly opts: TRpcSyncProviderOptions) {
    opts.doc.on("update", this.updateHandler);
    if (typeof window !== "undefined") {
      window.addEventListener("focus", this.focusHandler);
      window.addEventListener("online", this.onlineHandler);
    }
    this.pollTimer = setInterval(() => void this.sync(), POLL_MS);
    // 起動直後に 1 回 sync
    void this.sync();
  }

  destroy(): void {
    this.opts.doc.off("update", this.updateHandler);
    if (typeof window !== "undefined") {
      window.removeEventListener("focus", this.focusHandler);
      window.removeEventListener("online", this.onlineHandler);
    }
    if (this.pollTimer) clearInterval(this.pollTimer);
    if (this.debounceTimer) clearTimeout(this.debounceTimer);
  }

  private scheduleSync(): void {
    if (this.debounceTimer) clearTimeout(this.debounceTimer);
    this.debounceTimer = setTimeout(() => void this.sync(), DEBOUNCE_MS);
  }

  async sync(): Promise<void> {
    if (this.pending) return;
    this.pending = true;
    try {
      const clientSV = encodeStateVector(this.opts.doc);
      const clientUpdate = this.lastServerStateVector
        ? encodeStateAsUpdate(this.opts.doc, this.lastServerStateVector)
        : encodeStateAsUpdate(this.opts.doc);

      const res = await this.opts.trpc.templates.sync.mutate({
        clientStateVector: toBase64(clientSV),
        clientUpdate: clientUpdate.byteLength > 0 ? toBase64(clientUpdate) : undefined,
      });

      const serverUpdate = fromBase64(res.serverUpdate);
      if (serverUpdate.byteLength > 0) {
        applyRemoteUpdate(this.opts.doc, serverUpdate);
      }
      this.lastServerStateVector = fromBase64(res.serverStateVector);
    } catch (err) {
      this.opts.onError?.(err);
    } finally {
      this.pending = false;
    }
  }
}

function toBase64(bytes: Uint8Array): string {
  let s = "";
  for (let i = 0; i < bytes.length; i++) s += String.fromCharCode(bytes[i]);
  return btoa(s);
}

function fromBase64(s: string): Uint8Array {
  const bin = atob(s);
  const out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
  return out;
}
```

**メモ**:
- `doc.on('update', ...)` でローカル変更を検知 → debounce 付きで push
- 初期 load / focus / online / 定期 poll (30s) / ローカル更新 の 5 トリガーで `sync()`
- `origin === 'remote'` のループ抑止を忘れない (サーバから受けた update で再 push すると永久ループ)
- エラー時は次の sync トリガーで自動リトライ (キューを自前で持たない)

### 5. `client/src/sync/TemplateDocProvider.tsx` を新規作成

Y.Doc + y-indexeddb + tRPC sync provider を React の context で束ねる。

```typescript
import { createContext, useContext, useEffect, useRef, useState, type ReactNode } from "react";
import * as Y from "yjs";
import { IndexeddbPersistence } from "y-indexeddb";
import { trpc } from "../trpc/client";
import { useAuth } from "../auth/AuthContext";
import { createTemplateDoc } from "./templateDoc";
import { TRpcSyncProvider } from "./tRpcSyncProvider";

interface TemplateDocContextValue {
  doc: Y.Doc | null;
  isReady: boolean;          // IndexedDB からのロード完了
}

const ctx = createContext<TemplateDocContextValue>({ doc: null, isReady: false });

export const TemplateDocProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const { user } = useAuth();
  const [isReady, setIsReady] = useState(false);
  const docRef = useRef<Y.Doc | null>(null);
  const persistenceRef = useRef<IndexeddbPersistence | null>(null);
  const syncRef = useRef<TRpcSyncProvider | null>(null);
  const trpcClient = trpc.useContext().client;

  useEffect(() => {
    if (!user) {
      // ログアウト: doc を破棄
      syncRef.current?.destroy();
      persistenceRef.current?.destroy();
      docRef.current?.destroy();
      syncRef.current = null;
      persistenceRef.current = null;
      docRef.current = null;
      setIsReady(false);
      return;
    }

    const doc = createTemplateDoc();
    docRef.current = doc;

    const persistence = new IndexeddbPersistence(`templates:${user.id}`, doc);
    persistenceRef.current = persistence;
    persistence.whenSynced.then(() => setIsReady(true));

    const sync = new TRpcSyncProvider({ doc, trpc: trpcClient });
    syncRef.current = sync;

    return () => {
      sync.destroy();
      persistence.destroy();
      doc.destroy();
    };
  }, [user?.id, trpcClient]);

  return (
    <ctx.Provider value={{ doc: docRef.current, isReady }}>
      {children}
    </ctx.Provider>
  );
};

export const useTemplateDoc = (): TemplateDocContextValue => useContext(ctx);
```

**メモ**:
- ユーザーごとに IndexedDB の namespace (`templates:${user.id}`) を分ける → 同一端末で別ユーザーログインしても混ざらない
- ログアウト時に doc / persistence / sync を破棄
- `whenSynced` 完了まで `isReady = false`、UI は loading 表示

### 6. `client/src/hooks/useTemplates.ts` を新規作成

Y.Doc 上のテンプレート配列を React state として購読する hook。

```typescript
import { useEffect, useState } from "react";
import type * as Y from "yjs";
import { useTemplateDoc } from "../sync/TemplateDocProvider";
import {
  getTemplatesArray,
  templateToYMap,
  yMapToTemplate,
} from "../sync/templateDoc";
import type { Template } from "../model/template";

export interface UseTemplatesResult {
  templates: Template[];
  isReady: boolean;
  addTemplate: (t: Template) => void;
  updateTemplate: (t: Template) => void;
  removeTemplate: (id: string) => void;
  moveTemplate: (sourceId: string, destinationId: string) => void;
  bulkReplace: (list: Template[]) => void;      // import / migration 用
}

export const useTemplates = (): UseTemplatesResult => {
  const { doc, isReady } = useTemplateDoc();
  const [templates, setTemplates] = useState<Template[]>([]);

  useEffect(() => {
    if (!doc) {
      setTemplates([]);
      return;
    }
    const arr = getTemplatesArray(doc);
    const refresh = () => setTemplates(arr.toArray().map(yMapToTemplate));
    refresh();
    arr.observeDeep(refresh);
    return () => arr.unobserveDeep(refresh);
  }, [doc]);

  return {
    templates,
    isReady,
    addTemplate: (t) => {
      if (!doc) return;
      doc.transact(() => getTemplatesArray(doc).push([templateToYMap(t)]));
    },
    updateTemplate: (t) => {
      if (!doc) return;
      const arr = getTemplatesArray(doc);
      doc.transact(() => {
        for (let i = 0; i < arr.length; i++) {
          const m = arr.get(i);
          if (String(m.get("id")) === t.id) {
            m.set("title", t.title);
            m.set("categoryId", t.category.id);
            m.set("categoryName", t.category.name);
            m.set("categoryBoxArtUrl", t.category.box_art_url);
            // tags は差分更新ではなく置換 (Y.Array 全体を作り直す)
            const tagsArr = m.get("tags") as Y.Array<string>;
            tagsArr.delete(0, tagsArr.length);
            tagsArr.push(t.tags);
            return;
          }
        }
      });
    },
    removeTemplate: (id) => {
      if (!doc) return;
      const arr = getTemplatesArray(doc);
      doc.transact(() => {
        for (let i = 0; i < arr.length; i++) {
          if (String(arr.get(i).get("id")) === id) {
            arr.delete(i, 1);
            return;
          }
        }
      });
    },
    moveTemplate: (sourceId, destinationId) => {
      if (!doc) return;
      const arr = getTemplatesArray(doc);
      doc.transact(() => {
        let srcIdx = -1;
        let dstIdx = -1;
        for (let i = 0; i < arr.length; i++) {
          const id = String(arr.get(i).get("id"));
          if (id === sourceId) srcIdx = i;
          if (id === destinationId) dstIdx = i;
        }
        if (srcIdx < 0 || dstIdx < 0 || srcIdx === dstIdx) return;
        // Y.Array は move を持たないため delete + insert で表現
        const snapshot = arr.get(srcIdx).clone();
        arr.delete(srcIdx, 1);
        const insertAt = srcIdx < dstIdx ? dstIdx : dstIdx;  // 前方から移動ならインデックスが 1 減ってる
        arr.insert(insertAt, [snapshot]);
      });
    },
    bulkReplace: (list) => {
      if (!doc) return;
      const arr = getTemplatesArray(doc);
      doc.transact(() => {
        arr.delete(0, arr.length);
        arr.push(list.map(templateToYMap));
      });
    },
  };
};
```

**注意**:
- すべての書込みは `doc.transact(...)` で包み、sync provider に 1 つの update として届ける (余計な中間状態を流さない)
- `Y.Map` のネストされた `Y.Array` (`tags`) は `set` で差し替えると元の `Y.Array` が他に参照されている場合に不整合を起こす。既存 `Y.Array` を `delete + push` で中身だけ更新するのが安全
- `moveTemplate` の `insertAt` 計算は慎重に (配列から要素を抜いた後のインデックスのズレ)。テストで前方移動・後方移動・隣接移動・同一位置を全てカバー

### 7. `client/src/hooks/usePostTemplate.ts` を新規作成

```typescript
import { useEffect, useState } from "react";
import { useTemplateDoc } from "../sync/TemplateDocProvider";
import { getSettingsMap, readPostTemplate, writePostTemplate } from "../sync/templateDoc";
import { DEFAULT_POST_TEMPLATE } from "../utils/postTemplate";

export interface UsePostTemplateResult {
  postTemplate: string;
  setPostTemplate: (value: string) => void;
  isReady: boolean;
}

export const usePostTemplate = (): UsePostTemplateResult => {
  const { doc, isReady } = useTemplateDoc();
  const [value, setValue] = useState<string>(DEFAULT_POST_TEMPLATE);

  useEffect(() => {
    if (!doc) return;
    const settings = getSettingsMap(doc);
    const refresh = () => setValue(readPostTemplate(doc) || DEFAULT_POST_TEMPLATE);
    refresh();
    settings.observe(refresh);
    return () => settings.unobserve(refresh);
  }, [doc]);

  return {
    postTemplate: value,
    isReady,
    setPostTemplate: (v) => {
      if (!doc) return;
      doc.transact(() => writePostTemplate(doc, v));
    },
  };
};
```

### 8. `client/src/hooks/useTemplateOperations.ts` を改修

**重要**: Twitch API 呼出部分 (`applyTemplate`, `createMarker`) は **無変更**。CRUD 部分のみ Y.Doc 操作に。

改修箇所:
- `useStorage<Template[]>("templates", [])` の代わりに `useTemplates()` を使用
- `useStorage<string>(POST_TEMPLATE_KEY, DEFAULT_POST_TEMPLATE)` の代わりに `usePostTemplate()` を使用
- `onMoveTemplate`: `moveTemplate(sourceId, destinationId)` を呼ぶ (position 計算なし)
- `onSaveTemplate` / `onAddTemplate`: `addTemplate(...)` または `updateTemplate(...)`
- `onRemoveTemplate`: `removeTemplate(template.id)`
- `onCloneTemplate`: `cloneTemplate(template)` で新 id 生成 → `addTemplate(...)`
- `onApplyTemplate`: **無変更** (Twitch 直接呼出)
- `onImportTemplates`: ファイル読込 → `bulkReplace(list)` または差分 `addTemplate` の繰り返し
- `onExportTemplates`: 既存ロジック (現在のテンプレート配列を JSON で出力)

### 9. `client/src/MainScreen/component.tsx` を改修

```typescript
// 旧:
// const [templates, setTemplates] = useStorage<Template[]>("templates", []);
// const [postTemplate, setPostTemplate] = useStorage<string>(POST_TEMPLATE_KEY, DEFAULT_POST_TEMPLATE);

// 新:
const { templates, isReady: templatesReady } = useTemplates();
const { postTemplate, setPostTemplate, isReady: settingsReady } = usePostTemplate();
```

`isReady === false` の間はスケルトン or loading 表示 (旧 useStorage には無かった loading 状態)。

### 10. `client/src/main.tsx` (もしくはルートコンポーネント) に Provider を配置

```tsx
<TrpcProvider>
  <AuthProvider>
    <TemplateDocProvider>
      <App />
    </TemplateDocProvider>
  </AuthProvider>
</TrpcProvider>
```

認証済みユーザーの `user.id` が取れてから IndexedDB namespace を決めるため、`AuthProvider` の内側に配置すること。

### 11. `client/src/MainScreen/MigrationPrompt/component.tsx` を新規作成

```typescript
import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import type { Template } from "../../model/template";
import { POST_TEMPLATE_KEY, DEFAULT_POST_TEMPLATE } from "../../utils/postTemplate";
import { useTemplates } from "../../hooks/useTemplates";
import { usePostTemplate } from "../../hooks/usePostTemplate";
import { useTemplateDoc } from "../../sync/TemplateDocProvider";

const MIGRATED_AT_KEY = "templates_migrated_at";

interface LegacyData {
  templates: Template[];
  postTemplate: string;
}

function readLegacy(): LegacyData | null {
  if (localStorage.getItem(MIGRATED_AT_KEY)) return null;  // 移行済
  try {
    const t = localStorage.getItem("templates");
    const p = localStorage.getItem(POST_TEMPLATE_KEY);
    const templates = t ? JSON.parse(t) : [];
    const postTemplate = p ? JSON.parse(p) : "";
    if (templates.length === 0 && !postTemplate) return null;
    return { templates, postTemplate };
  } catch {
    return null;
  }
}

export const MigrationPrompt: React.FC = () => {
  const { t } = useTranslation();
  const { isReady } = useTemplateDoc();
  const { templates, bulkReplace } = useTemplates();
  const { setPostTemplate } = usePostTemplate();
  const [legacy, setLegacy] = useState<LegacyData | null>(null);
  const [open, setOpen] = useState(false);

  useEffect(() => {
    if (!isReady) return;                 // IndexedDB 復元を待つ
    if (templates.length > 0) return;     // 既にサーバ / ローカルにデータあり
    const found = readLegacy();
    if (found) {
      setLegacy(found);
      setOpen(true);
    }
  }, [isReady, templates.length]);

  const onMigrate = () => {
    if (!legacy) return;
    if (legacy.templates.length > 0) {
      bulkReplace(legacy.templates);
    }
    if (legacy.postTemplate && legacy.postTemplate !== DEFAULT_POST_TEMPLATE) {
      setPostTemplate(legacy.postTemplate);
    }
    localStorage.setItem(MIGRATED_AT_KEY, new Date().toISOString());
    setOpen(false);
  };

  const onSkip = () => {
    setOpen(false);
    // 「あとで」: migrated_at は記録しない、次回再表示
  };

  const onCancel = () => {
    setOpen(false);
    localStorage.setItem(MIGRATED_AT_KEY, new Date().toISOString());
    // 「移行しない」: migrated_at を記録、再表示しない
  };

  if (!open || !legacy) return null;

  return (
    <div className="modal-backdrop">
      <div className="modal">
        <h2>{t("migration.title")}</h2>
        <p>{t("migration.description", { count: legacy.templates.length })}</p>
        <div className="modal-actions">
          <button onClick={onMigrate}>{t("migration.migrate")}</button>
          <button onClick={onSkip}>{t("migration.later")}</button>
          <button onClick={onCancel}>{t("migration.cancel")}</button>
        </div>
      </div>
    </div>
  );
};
```

**ポイント**:
- サーバ呼出は一切しない。Y.Doc に書き込むだけで、sync provider が自動的にサーバに push
- `isReady` 完了前 (IndexedDB 復元前) に判定すると「サーバから未取得のデータがまだローカルに無い」状態で誤発火する。`isReady && templates.length === 0` で慎重に
- さらに慎重にするなら **最初の sync を 1 往復待ってから** legacy 判定する (初回 sync 完了フラグを TemplateDocProvider が expose する設計でもよい)

### 12. `client/src/MainScreen/MigrationPrompt/index.ts` を新規作成

```typescript
export { MigrationPrompt } from "./component";
```

### 13. `client/src/MainScreen/MigrationPrompt/component.test.tsx` を新規作成

ケース:
- localStorage 空 → Modal 非表示
- localStorage に旧 templates あり + サーバ / Y.Doc 空 → Modal 表示
- 「移行」ボタン → `bulkReplace` + `setPostTemplate` 呼出 → migrated_at 記録 → Modal 閉じる
- 「あとで」→ migrated_at 記録なし
- 「移行しない」→ migrated_at 記録あり、Modal 閉じる
- Y.Doc に既にテンプレートがある状態 → Modal 非表示 (サーバ同期済みと判定)

### 14. `client/src/MainScreen/component.tsx` に `<MigrationPrompt />` を配置

```typescript
import { MigrationPrompt } from "./MigrationPrompt";

export const MainScreen: React.FC = () => {
  // ...
  return (
    <main>
      <MigrationPrompt />
      {/* 既存の UI */}
    </main>
  );
};
```

### 15. i18n 文言の追加

`client/src/i18n/locales/ja.json` と `en.json` に以下のキーを追加:

```json
{
  "migration": {
    "title": "ローカルのテンプレートをサーバへ移行しますか？",
    "description": "ブラウザに保存されている {{count}} 件のテンプレートをサーバに保存することで、複数の端末で同じテンプレートを使えるようになります。",
    "migrate": "サーバへ移行",
    "later": "あとで",
    "cancel": "移行しない"
  }
}
```

英語版は同等の意味で。

### 16. 既存の useStorage 利用箇所の確認

`useStorage<Template[]>("templates")` と `useStorage<string>("postTemplate")` の使用箇所を grep で確認し、全て Y.Doc ベースに置き換え済か確認:

```bash
grep -rn 'useStorage' client/src/ | grep -E 'templates|postTemplate'
```

`useStorage` 自体は他用途 (i18n 等) で使い続けるため削除しない。

### 17. 既存の import/export 機能の整合性確認

`useTemplateOperations.onImportTemplates` で読み込んだファイル内容を `bulkReplace(list)` に渡すように改修。client 側のバリデーション (`validateImportedTemplates`) はそのまま使う (server 側 shape 検証でも弾かれるが、client 側で早期エラー表示する意味はある)。

---

## テスト

### Unit Test

#### `client/src/sync/templateDoc.test.ts`
- `templateToYMap` ↔ `yMapToTemplate` ラウンドトリップ
- `readPostTemplate` / `writePostTemplate`
- `encodeStateAsUpdate(doc, serverSV)` が未知変更のみ含むこと

#### `client/src/sync/tRpcSyncProvider.test.ts`
- mock trpc client で「ローカル更新 → debounce → push」を確認
- mock trpc client で「サーバ update を applyUpdate してもループしない」を確認
- エラー時に `onError` が呼ばれる
- `destroy()` 後は listener が外れている

#### `client/src/hooks/useTemplates.test.tsx`
- addTemplate / updateTemplate / removeTemplate / moveTemplate の各操作が Y.Array に反映される
- moveTemplate の前方移動・後方移動・隣接移動・同一位置の境界
- `bulkReplace` が 0 件 / 複数件両方で正しく置換

#### `client/src/MainScreen/MigrationPrompt/component.test.tsx`
- 上記 13 のケースを Testing Library + Y.Doc mock で

### Manual Verification
1. localStorage に旧テンプレートを仕込む:
   ```js
   localStorage.setItem("templates", JSON.stringify([
     { id: "1", title: "Test", category: { id: "509658", name: "Just Chatting", box_art_url: "" }, tags: ["tag1"] }
   ]));
   ```
2. ログイン → MigrationPrompt 表示
3. 「移行」クリック → UI に旧テンプレートが表示される → 数秒後にサーバ DB `template_docs` に 1 行 INSERT (`docker compose exec postgres psql -c 'SELECT user_id, size_bytes FROM template_docs;'`)
4. シークレットウィンドウで同じユーザーで再ログイン → y-indexeddb は空、起動 sync でサーバからテンプレートが取得されて表示
5. テンプレートを D&D で並び替え → Y.Array が更新 → debounce 後にサーバ同期 → 別タブでも反映
6. オフライン (ネット切断) で編集 → ローカルに反映 → ネット復帰で自動 sync
7. テンプレート適用 → Twitch ダッシュボードで配信情報が更新される (Twitch 直接呼出が動作)

---

## Definition of Done

- [ ] `yjs` / `y-indexeddb` が `client/package.json` に追加
- [ ] `client/src/sync/{templateDoc,tRpcSyncProvider,TemplateDocProvider}.{ts,tsx}` 作成
- [ ] `client/src/hooks/{useTemplates,usePostTemplate}.ts` 作成
- [ ] `client/src/hooks/useTemplateOperations.ts` 改修 (CRUD 部分のみ Y.Doc 操作、Twitch 部分無変更)
- [ ] `client/src/MainScreen/component.tsx` から `useStorage<Template[]>` / `useStorage<string>("postTemplate")` を撤去
- [ ] `client/src/MainScreen/MigrationPrompt/{component.tsx,index.ts,component.test.tsx}` 作成
- [ ] `client/src/i18n/locales/{ja,en}.json` に migration キー追加
- [ ] `TemplateDocProvider` がルートに配置され、Y.Doc ライフサイクル (ユーザー切替時の破棄) が正しい
- [ ] オフラインで編集できて復帰時に自動 sync される (手動確認)
- [ ] 既存 import/export 機能が `bulkReplace` で動作
- [ ] `bun run check` 全緑
- [ ] `bun run build` 成功
- [ ] 手動: 移行 → 別端末同期 → オフライン編集 → Twitch 適用の通しで正常動作

---

## 既知の落とし穴

- **ループ防止**: `doc.on('update', ...)` でサーバ側 update にも反応すると `applyUpdate → sync → applyUpdate → ...` の無限ループに。`origin === 'remote'` を見て無視する
- **Y.Array.move が無い**: `moveTemplate` は `delete + insert`。その際、先に delete するとインデックスがずれるので注意 (snapshot を `clone()` してから delete → 新しい位置に insert)
- **IndexedDB namespace**: `templates:${user.id}` で分離。ユーザー切替時に破棄して新 namespace で再生成しないと前ユーザーのデータが混ざる
- **`isReady` の扱い**: `y-indexeddb` の `whenSynced` 完了前に画面を描くと一瞬 templates=[] が見える。ロード中は skeleton にすること
- **migration の誤発火**: `isReady = true` かつ `templates.length === 0` の条件で発火するが、**初回 sync 前だとサーバに実際はデータがあっても誤って移行 prompt が出る**。より堅牢にするには TRpcSyncProvider に「初回 sync 完了」フラグを持たせて、それが true になるまで MigrationPrompt を待機させる
- **base64 encoding**: サーバ (`Buffer.toString("base64")`) と互換。brower の `btoa` は UTF-16 文字列しか受けないため、Uint8Array は一旦 `String.fromCharCode` で bytes を 1 文字ずつ直接 string 化してから `btoa` に渡す (上記コード参照)
- **React StrictMode の二重 mount**: `TemplateDocProvider` の `useEffect` が二回走る。Y.Doc は 2 つ作られて片方 destroy される動きになるが、y-indexeddb の同一 namespace を同時に 2 つ開かないよう順序を保つ (cleanup の順序厳守)
- **localStorage cleanup のタイミング**: 本 PR では「移行成功で migrated_at 記録」のみ。実際の旧データ削除は PR 8 で 1 ヶ月超過判定後に実行
- **bulkReplace の重複 id**: 移行時に旧データ内で id が重複していたら Y.Doc 側でも重複する。client 側で import バリデーションで弾くか、`new Map()` で重複除去しておく
- **Y.Doc バイナリサイズの肥大化**: 長期運用で update 履歴が積まれて state が膨らむ場合、`new Y.Doc({ gc: true })` (デフォルト true) に任せれば自動 GC される。`gc = false` にしないこと
- **Twitch 適用は変えない**: `onApplyTemplate` は Y.Doc から読んだ Template をそのまま Twitch API に渡せば OK (shape は client 側で変わらないため)
