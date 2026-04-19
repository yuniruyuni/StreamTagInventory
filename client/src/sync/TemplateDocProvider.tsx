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
    let isReady = false;
    setValue({ doc, isReady });

    // IndexedDB が利用可能な環境のみ persistence を起動 (test 環境は skip)
    if (typeof window !== "undefined" && "indexedDB" in window) {
      persistence = new IndexeddbPersistence(namespace, doc);
      persistence.whenSynced.then(() => {
        isReady = true;
        setValue({ doc, isReady });
      });
    } else {
      isReady = true;
      setValue({ doc, isReady });
    }

    const sync: SyncMutator = {
      mutate: (input) => utils.client.templates.sync.mutate(input),
    };
    const syncProvider = new TRpcSyncProvider({ doc, sync });

    return () => {
      syncProvider.destroy();
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
