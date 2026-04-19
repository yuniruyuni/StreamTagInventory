import { useCallback, useContext, useEffect, useState } from "react";
import type * as Y from "yjs";
import type { Template } from "~/model/template";
import { TemplateDocContext } from "./TemplateDocContext";
import {
  getTemplatesArray,
  templateToYMap,
  yMapToTemplate,
} from "./templateDoc";

export interface UseTemplatesResult {
  /** 現在の Y.Doc から派生したテンプレート配列 (snapshot) */
  templates: Template[];
  /** IndexedDB ロード完了か (true になるまでは空配列の可能性あり) */
  isReady: boolean;
  addTemplate: (t: Template) => void;
  updateTemplate: (t: Template) => void;
  removeTemplate: (id: string) => void;
  /**
   * `sourceId` を `destinationId` の位置に移動する (D&D の Drop 先)。
   * destinationId が見つからなければ何もしない。
   */
  moveTemplate: (sourceId: string, destinationId: string) => void;
  /** import / migration 用。既存配列を全部置き換える */
  bulkReplace: (list: Template[]) => void;
}

/**
 * Y.Doc 上の `templates: Y.Array<Y.Map>` を React state として購読し、CRUD
 * インターフェースを返す hook (PR 7)。
 *
 * Y.Doc の操作は `doc.transact()` で 1 トランザクションに包むことで、複数の
 * Y.Map 操作が 1 update event にまとまり sync provider の debounce が無駄に
 * 発火しない。
 *
 * `observeDeep` で Y.Array 自体と中の Y.Map / 内側 Y.Array (tags) の変更を
 * すべて検知して React state を更新する。snapshot は毎回 `arr.toArray().map(...)`
 * で作り直す (浅い差分計算は Yjs 側のオブジェクト identity が安定しないため)。
 */
export const useTemplates = (): UseTemplatesResult => {
  const { doc, isReady } = useContext(TemplateDocContext);
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

  const addTemplate = useCallback(
    (t: Template) => {
      if (!doc) return;
      doc.transact(() => getTemplatesArray(doc).push([templateToYMap(t)]));
    },
    [doc],
  );

  const updateTemplate = useCallback(
    (t: Template) => {
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
            // tags は差分更新でなく置換 (内側の Y.Array を作り直さず中身を入れ替え)
            const tagsArr = m.get("tags") as Y.Array<string>;
            tagsArr.delete(0, tagsArr.length);
            tagsArr.push(t.tags);
            return;
          }
        }
      });
    },
    [doc],
  );

  const removeTemplate = useCallback(
    (id: string) => {
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
    [doc],
  );

  const moveTemplate = useCallback(
    (sourceId: string, destinationId: string) => {
      if (!doc) return;
      if (sourceId === destinationId) return;
      const arr = getTemplatesArray(doc);
      doc.transact(() => {
        let srcIdx = -1;
        let dstIdx = -1;
        for (let i = 0; i < arr.length; i++) {
          const id = String(arr.get(i).get("id"));
          if (id === sourceId) srcIdx = i;
          if (id === destinationId) dstIdx = i;
        }
        if (srcIdx < 0 || dstIdx < 0) return;
        // Y.Array は move primitive を持たないので「該当 item を Template に
        // 戻して Y.Map ごと作り直して insert」する。CRDT 的には削除→挿入で
        // 別 op になるが、本ツールの並び替え頻度では許容範囲。
        const moving = yMapToTemplate(arr.get(srcIdx));
        arr.delete(srcIdx, 1);
        const insertAt = dstIdx > srcIdx ? dstIdx : dstIdx;
        arr.insert(insertAt, [templateToYMap(moving)]);
      });
    },
    [doc],
  );

  const bulkReplace = useCallback(
    (list: Template[]) => {
      if (!doc) return;
      const arr = getTemplatesArray(doc);
      doc.transact(() => {
        if (arr.length > 0) arr.delete(0, arr.length);
        if (list.length > 0) arr.push(list.map(templateToYMap));
      });
    },
    [doc],
  );

  return {
    templates,
    isReady,
    addTemplate,
    updateTemplate,
    removeTemplate,
    moveTemplate,
    bulkReplace,
  };
};
