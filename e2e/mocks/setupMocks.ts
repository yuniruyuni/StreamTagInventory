import type { Page } from "@playwright/test";
import * as Y from "yjs";

/**
 * 認証済 user として e2e を走らせるためのセットアップ (ADR 0007 + PR 7 用)。
 *
 * 1. **sessionStorage に id_token / access_token を直接 inject**: TwitchAuthProvider は
 *    useSession で sessionStorage を読むので、ここに置けば認証済状態が成立する。
 *    `useSession` は JSON.stringify するため、保存値はクォート込み JSON にする。
 * 2. **`/api/trpc/auth.me` を mock**: server は本物の Twitch JWKS で JWT を検証する
 *    ので e2e の mock token は通らない。route で intercept して mock user を返す。
 * 3. **`/api/trpc/templates.sync` を「Y.Doc を保持する mini server」として mock**:
 *    クライアントから来た update を server-side Y.Doc に apply して、クライアントの
 *    state vector に対する diff を返す。これによりローカル編集が次の sync で逆流しない
 * 4. **`templates_migrated_at` を pre-set**: localStorage 由来の Migration prompt を
 *    抑止 (sync 経由で Y.Doc に template を直接届けるため不要)
 */

const MOCK_TEMPLATE = {
  id: "test-template-1",
  title: "Test Stream Title",
  category: {
    id: "509658",
    name: "Just Chatting",
    box_art_url:
      "https://static-cdn.jtvnw.net/ttv-boxart/509658-{width}x{height}.jpg",
  },
  tags: ["English", "Gaming"],
};

/** クライアントの sync interaction を模倣する mini Y.Doc server */
function makeMockServer() {
  const serverDoc = new Y.Doc();
  // 初期 mock template を 1 件入れておく (e2e の見た目を決定的にする)
  const arr = serverDoc.getArray<Y.Map<unknown>>("templates");
  const m = new Y.Map<unknown>();
  m.set("id", MOCK_TEMPLATE.id);
  m.set("title", MOCK_TEMPLATE.title);
  m.set("categoryId", MOCK_TEMPLATE.category.id);
  m.set("categoryName", MOCK_TEMPLATE.category.name);
  m.set("categoryBoxArtUrl", MOCK_TEMPLATE.category.box_art_url);
  const tags = new Y.Array<string>();
  tags.push(MOCK_TEMPLATE.tags);
  m.set("tags", tags);
  arr.push([m]);

  return {
    /** クライアント sync 1 回分を処理: clientUpdate を取り込み、clientStateVector に対する diff を返す */
    apply(input: { clientStateVector: string; clientUpdate?: string }): {
      serverUpdate: string;
      serverStateVector: string;
    } {
      if (input.clientUpdate) {
        const upd = Buffer.from(input.clientUpdate, "base64");
        Y.applyUpdate(serverDoc, new Uint8Array(upd));
      }
      const csv = new Uint8Array(
        Buffer.from(input.clientStateVector, "base64"),
      );
      const diff = Y.encodeStateAsUpdate(serverDoc, csv);
      return {
        serverUpdate: Buffer.from(diff).toString("base64"),
        serverStateVector: Buffer.from(Y.encodeStateVector(serverDoc)).toString(
          "base64",
        ),
      };
    },
  };
}

export async function setupMocks(page: Page) {
  await page.route("**/api/trpc/auth.me*", async (route) => {
    const response = [
      {
        result: {
          data: {
            user: {
              id: "mock-twitch-user-id",
              twitchUserId: "mock-twitch-user-id",
              login: "mockuser",
              displayName: "Mock User",
            },
          },
        },
      },
    ];
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify(response),
    });
  });

  // PR 7: tRPC templates.sync mutation を「state を保持する mini Y.Doc server」で mock。
  // tRPC v11 の httpBatchLink は同じ procedure を 1 リクエストにまとめ、URL に
  // カンマ区切り procedure 名 (例 `templates.sync,templates.sync`) を出す。
  // 同期に同じ procedure が複数並ぶ場合、body は `{"0": {input}, "1": {input}}` 形式で
  // 入力が並ぶため、それぞれを順に処理して同数の result を返す必要がある。
  const server = makeMockServer();
  await page.route("**/api/trpc/**templates.sync*", async (route) => {
    const url = new URL(route.request().url());
    const path = url.pathname.split("/").pop() ?? "";
    const count = Math.max(1, path.split(",").length);

    const bodyText = route.request().postData() ?? "{}";
    let inputs: Array<{
      clientStateVector: string;
      clientUpdate?: string;
    }> = [];
    try {
      // tRPC v11 のリクエスト形式: { "0": {input}, "1": {input}, ... }
      const parsed = JSON.parse(bodyText) as Record<string, unknown>;
      for (let i = 0; i < count; i++) {
        const v = parsed[String(i)];
        if (
          v &&
          typeof v === "object" &&
          "clientStateVector" in v &&
          typeof (v as { clientStateVector?: unknown }).clientStateVector ===
            "string"
        ) {
          inputs.push(
            v as { clientStateVector: string; clientUpdate?: string },
          );
        }
      }
    } catch {
      // body parse 失敗時は空 input 列で count 分回す
      inputs = [];
    }
    while (inputs.length < count) {
      inputs.push({ clientStateVector: "" });
    }

    const response = inputs.map((input) => ({
      result: { data: server.apply(input) },
    }));
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify(response),
    });
  });

  await page.addInitScript(() => {
    sessionStorage.setItem(
      "twitch-id-token",
      JSON.stringify("mock-jwt-token-for-e2e"),
    );
    sessionStorage.setItem(
      "twitch-auth",
      JSON.stringify("mock-access-token-for-e2e"),
    );

    localStorage.setItem("language", "en");
    localStorage.setItem(
      "templates_migrated_at",
      new Date("2026-01-01T00:00:00.000Z").toISOString(),
    );
  });
}
