import type { Template } from "~/model/template";
import { DEFAULT_POST_TEMPLATE, POST_TEMPLATE_KEY } from "~/utils/postTemplate";

/** localStorage 旧 key (PR 7 以前の useStorage 由来) */
export const LEGACY_TEMPLATES_KEY = "templates";
export const LEGACY_POST_TEMPLATE_KEY = POST_TEMPLATE_KEY;
/** 移行完了タイムスタンプ (ISO string)。これが立っていれば再度 prompt しない */
export const MIGRATED_AT_KEY = "templates_migrated_at";

export interface LegacyData {
  templates: Template[];
  postTemplate: string | null;
}

/**
 * localStorage から旧データを読み出す。空配列 + DEFAULT_POST_TEMPLATE 同等のときは
 * 「移行する価値の無いデータ」として `null` を返し、prompt を抑制する。
 */
export function readLegacyData(): LegacyData | null {
  if (typeof window === "undefined") return null;
  if (localStorage.getItem(MIGRATED_AT_KEY)) return null;

  const templatesRaw = localStorage.getItem(LEGACY_TEMPLATES_KEY);
  const postRaw = localStorage.getItem(LEGACY_POST_TEMPLATE_KEY);
  const templates = parseTemplates(templatesRaw);
  const postTemplate = parseString(postRaw);

  const hasTemplates = templates.length > 0;
  const hasPostTemplate =
    postTemplate !== null &&
    postTemplate !== "" &&
    postTemplate !== DEFAULT_POST_TEMPLATE;
  if (!hasTemplates && !hasPostTemplate) return null;

  return { templates, postTemplate };
}

export function markMigrated(now: Date = new Date()): void {
  if (typeof window === "undefined") return;
  localStorage.setItem(MIGRATED_AT_KEY, now.toISOString());
}

function parseTemplates(raw: string | null): Template[] {
  if (raw === null) return [];
  try {
    const parsed: unknown = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    // shape 検証は最小限 (id / title が string) に留める。category / tags は
    // 移行時の bulkReplace で Y.Map に詰め直すので不正値は値レベルで吸収される。
    return parsed.filter(
      (t): t is Template =>
        t !== null &&
        typeof t === "object" &&
        typeof (t as Record<string, unknown>).id === "string" &&
        typeof (t as Record<string, unknown>).title === "string",
    );
  } catch {
    return [];
  }
}

function parseString(raw: string | null): string | null {
  if (raw === null) return null;
  try {
    const parsed: unknown = JSON.parse(raw);
    return typeof parsed === "string" ? parsed : null;
  } catch {
    return null;
  }
}
