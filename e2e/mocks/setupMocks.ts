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

type MockUser = {
  id: string;
  twitchUserId: string;
  login: string;
  displayName: string;
};

const DEFAULT_MOCK_USER: MockUser = {
  id: "mock-twitch-user-id",
  twitchUserId: "mock-twitch-user-id",
  login: "mockuser",
  displayName: "Mock User",
};

function makeTemplateMap(index: number): Y.Map<unknown> {
  const m = new Y.Map<unknown>();
  m.set("id", `test-template-${index + 1}`);
  m.set(
    "title",
    index === 0 ? MOCK_TEMPLATE.title : `${MOCK_TEMPLATE.title} ${index + 1}`,
  );
  m.set("categoryId", MOCK_TEMPLATE.category.id);
  m.set("categoryName", MOCK_TEMPLATE.category.name);
  m.set("categoryBoxArtUrl", MOCK_TEMPLATE.category.box_art_url);
  const tags = new Y.Array<string>();
  tags.push(MOCK_TEMPLATE.tags);
  m.set("tags", tags);
  return m;
}

function setTemplateTitle(
  serverDoc: Y.Doc,
  templateId: string,
  title: string,
): void {
  const arr = serverDoc.getArray<Y.Map<unknown>>("templates");
  for (let i = 0; i < arr.length; i++) {
    const template = arr.get(i);
    if (String(template.get("id")) === templateId) {
      template.set("title", title);
      return;
    }
  }
}

/** クライアントの sync interaction を模倣する mini Y.Doc server */
function makeMockServer(templateCount: number) {
  const serverDoc = new Y.Doc();
  // 初期 mock template を入れておく (e2e の見た目を決定的にする)
  const arr = serverDoc.getArray<Y.Map<unknown>>("templates");
  arr.push(
    Array.from({ length: templateCount }, (_, index) => makeTemplateMap(index)),
  );

  return {
    setTemplateTitle(templateId: string, title: string): void {
      setTemplateTitle(serverDoc, templateId, title);
    },

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

type SetupMocksOptions = {
  authenticated?: boolean;
  language?: string;
  templateCount?: number;
  user?: Partial<MockUser>;
  migratedAt?: string | null;
  legacyTemplates?: unknown[];
  legacyPostTemplate?: string | null;
};

type MockServer = ReturnType<typeof makeMockServer>;

export type SetupMocksController = {
  setUser: (user: Partial<MockUser>, templateCount?: number) => void;
  setRemoteTemplateTitle: (
    templateId: string,
    title: string,
    userId?: string,
  ) => void;
  setSyncFailure: (enabled: boolean) => void;
};

export async function setupMocks(
  page: Page,
  {
    authenticated = true,
    language = "en",
    templateCount = 1,
    user,
    migratedAt = "2026-01-01T00:00:00.000Z",
    legacyTemplates,
    legacyPostTemplate,
  }: SetupMocksOptions = {},
): Promise<SetupMocksController> {
  let currentUser: MockUser = { ...DEFAULT_MOCK_USER, ...user };
  const servers = new Map<string, MockServer>();
  const getServer = (userId = currentUser.id, count = templateCount) => {
    let server = servers.get(userId);
    if (!server) {
      server = makeMockServer(count);
      servers.set(userId, server);
    }
    return server;
  };
  getServer(currentUser.id, templateCount);
  let syncFailureEnabled = false;

  await page.route("**/api/trpc/auth.me*", async (route) => {
    const response = [
      {
        result: {
          data: {
            user: currentUser,
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
  await page.route("**/api/trpc/**templates.sync*", async (route) => {
    if (syncFailureEnabled) {
      await route.fulfill({
        status: 503,
        contentType: "application/json",
        body: JSON.stringify({ error: "sync unavailable" }),
      });
      return;
    }

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
      result: { data: getServer().apply(input) },
    }));
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify(response),
    });
  });

  await page.addInitScript(
    ({
      shouldAuthenticate,
      mockLanguage,
      mockMigratedAt,
      mockLegacyTemplates,
      mockLegacyPostTemplate,
    }) => {
      if (shouldAuthenticate) {
        sessionStorage.setItem(
          "twitch-id-token",
          JSON.stringify("mock-jwt-token-for-e2e"),
        );
        sessionStorage.setItem(
          "twitch-auth",
          JSON.stringify("mock-access-token-for-e2e"),
        );
      }
      if (localStorage.getItem("language") === null) {
        localStorage.setItem("language", mockLanguage);
      }
      if (mockLegacyTemplates !== undefined) {
        localStorage.setItem("templates", JSON.stringify(mockLegacyTemplates));
      }
      if (mockLegacyPostTemplate !== undefined) {
        if (mockLegacyPostTemplate === null) {
          localStorage.removeItem("postTemplate");
        } else {
          localStorage.setItem(
            "postTemplate",
            JSON.stringify(mockLegacyPostTemplate),
          );
        }
      }
      if (mockMigratedAt !== null) {
        localStorage.setItem("templates_migrated_at", mockMigratedAt);
      }
    },
    {
      shouldAuthenticate: authenticated,
      mockLanguage: language,
      mockMigratedAt: migratedAt,
      mockLegacyTemplates: legacyTemplates,
      mockLegacyPostTemplate: legacyPostTemplate,
    },
  );

  return {
    setUser(nextUser, nextTemplateCount = 0) {
      currentUser = { ...DEFAULT_MOCK_USER, ...nextUser };
      getServer(currentUser.id, nextTemplateCount);
    },
    setRemoteTemplateTitle(templateId, title, userId = currentUser.id) {
      getServer(userId).setTemplateTitle(templateId, title);
    },
    setSyncFailure(enabled) {
      syncFailureEnabled = enabled;
    },
  };
}
