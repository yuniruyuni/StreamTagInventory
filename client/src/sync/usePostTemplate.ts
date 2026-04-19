import { useCallback, useContext, useEffect, useState } from "react";
import { TemplateDocContext } from "./TemplateDocContext";
import {
  getSettingsMap,
  POST_TEMPLATE_KEY,
  readPostTemplate,
  writePostTemplate,
} from "./templateDoc";

export interface UsePostTemplateResult {
  postTemplate: string;
  /** doc 未準備時の click も safe (no-op) */
  setPostTemplate: (value: string) => void;
}

/**
 * Y.Doc の `settings.postTemplate` を React state として購読し、setter を返す。
 * テンプレート配列とは独立した key なので observe 対象を `getSettingsMap(doc)` に絞り、
 * 全 settings 変更で発火する (postTemplate しか入れない前提)。
 */
export const usePostTemplate = (): UsePostTemplateResult => {
  const { doc } = useContext(TemplateDocContext);
  const [postTemplate, setLocal] = useState<string>("");

  useEffect(() => {
    if (!doc) {
      setLocal("");
      return;
    }
    const settings = getSettingsMap(doc);
    const refresh = () => setLocal(readPostTemplate(doc));
    refresh();
    settings.observe(refresh);
    return () => settings.unobserve(refresh);
  }, [doc]);

  const setPostTemplate = useCallback(
    (value: string) => {
      if (!doc) return;
      writePostTemplate(doc, value);
    },
    [doc],
  );

  return { postTemplate, setPostTemplate };
};

// re-export for callers that want the storage key constant
export { POST_TEMPLATE_KEY };
