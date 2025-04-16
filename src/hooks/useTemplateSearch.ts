import { useMemo, useState } from "react";
import type { Template } from "~/model/template";

type UseTemplateSearchResult = {
  searchQuery: string;
  setSearchQuery: (query: string) => void;
  filteredTemplates: Template[];
};

/**
 * カスタムフック: テンプレートの検索機能を提供する
 *
 * @param templates 検索対象のテンプレート配列
 * @returns 検索クエリ、検索クエリ設定関数、フィルター済みテンプレート配列
 */
export const useTemplateSearch = (templates: Template[]): UseTemplateSearchResult => {
  const [searchQuery, setSearchQuery] = useState("");

  const filteredTemplates = useMemo(() => {
    if (!searchQuery.trim()) {
      return templates;
    }

    const query = searchQuery.toLowerCase().trim();
    return templates.filter(
      (template) =>
        template.title.toLowerCase().includes(query) ||
        template.category.name.toLowerCase().includes(query) ||
        template.tags.some((tag) => tag.toLowerCase().includes(query)),
    );
  }, [templates, searchQuery]);

  return {
    searchQuery,
    setSearchQuery,
    filteredTemplates,
  };
};
