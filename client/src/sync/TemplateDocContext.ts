import { createContext } from "react";
import type * as Y from "yjs";

export type SyncStatus = "idle" | "syncing" | "synced" | "error";

export interface TemplateDocContextValue {
  /** mount 中の Y.Doc。未ログイン or 初期化中は null */
  doc: Y.Doc | null;
  /** IndexedDB からのロードが完了したか (初回起動時のみ false の期間あり) */
  isReady: boolean;
  /** server sync の現在状態。IndexedDB 初期化待ち or 未ログイン時は idle */
  syncStatus: SyncStatus;
  /** 最後に server sync が成功した時刻 */
  lastSyncedAt: Date | null;
}

export const TemplateDocContext = createContext<TemplateDocContextValue>({
  doc: null,
  isReady: false,
  syncStatus: "idle",
  lastSyncedAt: null,
});
