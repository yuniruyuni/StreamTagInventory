import { createContext } from "react";
import type * as Y from "yjs";

export interface TemplateDocContextValue {
  /** mount 中の Y.Doc。未ログイン or 初期化中は null */
  doc: Y.Doc | null;
  /** IndexedDB からのロードが完了したか (初回起動時のみ false の期間あり) */
  isReady: boolean;
}

export const TemplateDocContext = createContext<TemplateDocContextValue>({
  doc: null,
  isReady: false,
});
