import {
  type FC,
  type ReactNode,
  useContext,
  useEffect,
  useState,
} from "react";
import { IndexeddbPersistence } from "y-indexeddb";
import { TwitchAuthContext } from "~/TwitchAuth";
import { trpc } from "~/trpc/client";
import {
  TemplateDocContext,
  type TemplateDocContextValue,
} from "./TemplateDocContext";
import { createTemplateDoc } from "./templateDoc";
import { type SyncMutator, TRpcSyncProvider } from "./tRpcSyncProvider";

/**
 * Y.Doc + y-indexeddb + tRPC sync provider を React context に束ねる
 * (ADR 0004 / PR 7)。
 *
 * ライフサイクル:
 *  - user がログイン → Y.Doc 作成 → IndexedDB persistence (`templates:${user.id}`)
 *    に attach → server sync provider 起動。`whenSynced` で IndexedDB ロード完了
 *  - user がログアウト or 切替 → 既存 doc/persistence/sync を destroy → null へ
 *
 * IndexedDB の namespace を user id で分けることで同一端末で別 user に
 * ログインし直しても Y.Doc が混ざらない。
 */
export const TemplateDocProvider: FC<{ children: ReactNode }> = ({
  children,
}) => {
  const { user } = useContext(TwitchAuthContext);
  const [value, setValue] = useState<TemplateDocContextValue>({
    doc: null,
    isReady: false,
  });

  // tRPC mutation を SyncMutator interface に適合させる。React Query を介さず
  // 純 Promise で叩きたいので useUtils ではなく `trpc.useUtils().client` を使う。
  const utils = trpc.useUtils();

  // biome-ignore lint/correctness/useExhaustiveDependencies: utils.client は stable (trpc client は singleton)
  useEffect(() => {
    if (!user) {
      setValue({ doc: null, isReady: false });
      return;
    }

    const doc = createTemplateDoc();
    const namespace = `templates:${user.id}`;
    let persistence: IndexeddbPersistence | null = null;
    let syncProvider: TRpcSyncProvider | null = null;
    let disposed = false;

    // IndexedDB が利用可能な環境のみ persistence を起動 (test 環境は skip)。
    // isReady は whenSynced (IndexedDB ロード完了) まで false。IndexedDB 無し環境は
    // 即 true で render を進めさせる。
    const startSync = () => {
      if (disposed) return;
      const sync: SyncMutator = {
        mutate: (input) => utils.client.templates.sync.mutate(input),
      };
      syncProvider = new TRpcSyncProvider({ doc, sync });
    };

    if (typeof window !== "undefined" && "indexedDB" in window) {
      setValue({ doc, isReady: false });
      persistence = new IndexeddbPersistence(namespace, doc);
      persistence.whenSynced.then(() => {
        if (disposed) return;
        setValue({ doc, isReady: true });
        startSync();
      });
    } else {
      setValue({ doc, isReady: true });
      startSync();
    }

    return () => {
      disposed = true;
      if (syncProvider) syncProvider.destroy();
      if (persistence) persistence.destroy();
      doc.destroy();
    };
  }, [user]);

  return (
    <TemplateDocContext.Provider value={value}>
      {children}
    </TemplateDocContext.Provider>
  );
};
