import * as Y from "yjs";
import type { Template } from "~/model/template";

/**
 * Y.Doc のトップレベル構造を定義し、client 画面層 (`Template`) との相互変換を集約する
 * (ADR 0004)。
 *
 * ルート namespace:
 *  - `templates`: `Y.Array<Y.Map>` — テンプレート 1 件 = 1 Map。tags は内側 Y.Array
 *  - `settings`: `Y.Map` — postTemplate 等の単一値設定をまとめる
 *
 * Y.Map のキーは camelCase (`categoryId` / `categoryName` / `categoryBoxArtUrl`)。
 * client の Template 型は snake_case (`box_art_url`) を持つので、変換時にここで吸収する。
 */
export const TEMPLATES_KEY = "templates";
export const SETTINGS_KEY = "settings";
export const POST_TEMPLATE_KEY = "postTemplate";

export const createTemplateDoc = (): Y.Doc => new Y.Doc();

export function getTemplatesArray(doc: Y.Doc): Y.Array<Y.Map<unknown>> {
  return doc.getArray<Y.Map<unknown>>(TEMPLATES_KEY);
}

export function getSettingsMap(doc: Y.Doc): Y.Map<unknown> {
  return doc.getMap(SETTINGS_KEY);
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
  const v = getSettingsMap(doc).get(POST_TEMPLATE_KEY);
  return typeof v === "string" ? v : "";
}

export function writePostTemplate(doc: Y.Doc, value: string): void {
  getSettingsMap(doc).set(POST_TEMPLATE_KEY, value);
}

export function encodeStateVector(doc: Y.Doc): Uint8Array {
  return Y.encodeStateVector(doc);
}

export function encodeStateAsUpdate(
  doc: Y.Doc,
  since?: Uint8Array,
): Uint8Array {
  return Y.encodeStateAsUpdate(doc, since);
}

/**
 * server から受け取った update を doc に取り込む。`origin` を `"remote"` にすることで、
 * sync provider の update listener はこれを「自分が apply したもの」と判定して push を
 * skip できる (echo loop 防止)。
 */
export const REMOTE_ORIGIN = "remote";

export function applyRemoteUpdate(doc: Y.Doc, update: Uint8Array): void {
  Y.applyUpdate(doc, update, REMOTE_ORIGIN);
}

/**
 * Uint8Array ↔ base64 変換。tRPC 経由で送受する際のシリアライズ。
 * server (PR 5) の templates.sync は `clientStateVector` / `clientUpdate` /
 * `serverStateVector` / `serverUpdate` をすべて base64 文字列として扱う。
 */
export function toBase64(bytes: Uint8Array): string {
  let s = "";
  for (let i = 0; i < bytes.length; i++) s += String.fromCharCode(bytes[i]);
  return btoa(s);
}

export function fromBase64(s: string): Uint8Array {
  const bin = atob(s);
  const out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
  return out;
}
