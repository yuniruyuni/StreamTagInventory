import { describe, expect, test } from "bun:test";
import {
  buildTweetIntentUrl,
  DEFAULT_POST_TEMPLATE,
  formatPostText,
} from "./postTemplate";

describe("formatPostText", () => {
  test("全プレースホルダーを正しく置換する", () => {
    const result = formatPostText("{title} - {category} [{tags}] {url}", {
      title: "テスト配信",
      category: "Apex Legends",
      tags: ["FPS", "ランク"],
      url: "https://twitch.tv/testuser",
    });
    expect(result).toBe(
      "テスト配信 - Apex Legends [FPS, ランク] https://twitch.tv/testuser",
    );
  });

  test("空タグ配列の場合は空文字になる", () => {
    const result = formatPostText("{tags}", {
      title: "",
      category: "",
      tags: [],
      url: "",
    });
    expect(result).toBe("");
  });

  test("同一プレースホルダーが複数回出現する場合すべて置換される", () => {
    const result = formatPostText("{title} / {title}", {
      title: "配信",
      category: "",
      tags: [],
      url: "",
    });
    expect(result).toBe("配信 / 配信");
  });

  test("未知のプレースホルダーはそのまま残る", () => {
    const result = formatPostText("{unknown}", {
      title: "",
      category: "",
      tags: [],
      url: "",
    });
    expect(result).toBe("{unknown}");
  });

  test("空文字列テンプレートでは空文字列を返す", () => {
    const result = formatPostText("", {
      title: "テスト配信",
      category: "Apex Legends",
      tags: ["FPS"],
      url: "https://twitch.tv/testuser",
    });
    expect(result).toBe("");
  });

  test("デフォルトテンプレートで正しく動作する", () => {
    const result = formatPostText(DEFAULT_POST_TEMPLATE, {
      title: "テスト配信",
      category: "Apex Legends",
      tags: ["FPS", "ランク"],
      url: "https://twitch.tv/testuser",
    });
    expect(result).toContain("テスト配信");
    expect(result).toContain("Apex Legends");
    expect(result).toContain("FPS, ランク");
    expect(result).toContain("https://twitch.tv/testuser");
  });
});

describe("buildTweetIntentUrl", () => {
  test("テキストをURLエンコードしてX intent URLを生成する", () => {
    const result = buildTweetIntentUrl("Hello World");
    expect(result).toBe("https://x.com/intent/tweet?text=Hello%20World");
  });

  test("日本語テキストを正しくエンコードする", () => {
    const result = buildTweetIntentUrl("配信開始");
    expect(result).toBe(
      `https://x.com/intent/tweet?text=${encodeURIComponent("配信開始")}`,
    );
  });

  test("改行を含むテキストを正しくエンコードする", () => {
    const result = buildTweetIntentUrl("line1\nline2");
    expect(result).toBe("https://x.com/intent/tweet?text=line1%0Aline2");
  });
});
