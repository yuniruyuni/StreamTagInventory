import { expect, test } from "bun:test";
import { CLIENT_ID } from "~/constant";
import { clearHash, generateURI, parseTokenFromHash } from "./utils";

// テスト前にwindow.locationをモック
const originalLocation = window.location;

// テスト後に元に戻すための関数
function restoreWindowLocation() {
  // biome-ignore lint/suspicious/noExplicitAny: テスト用のモック
  (window as any).location = originalLocation;
}

test("generateURI関数が正しいURIを生成する", () => {
  const auth = {
    redirect_url: "https://example.com/callback",
    response_type: "token",
    scope: ["user:read:email", "channel:read:subscriptions"],
  };

  const expectedURI = `https://id.twitch.tv/oauth2/authorize?client_id=${CLIENT_ID}&redirect_uri=${auth.redirect_url}&response_type=${auth.response_type}&scope=${auth.scope.join("+")}`;

  const result = generateURI(auth);
  expect(result).toBe(expectedURI);
});

test("parseTokenFromHash関数がURLハッシュからトークンを取得する", () => {
  try {
    // window.locationをモック
    const originalHash = window.location.hash;
    Object.defineProperty(window.location, "hash", {
      writable: true,
      value: "#access_token=mock-token&other=value",
    });

    const result = parseTokenFromHash();
    expect(result).toBe("mock-token");

    // 元に戻す
    Object.defineProperty(window.location, "hash", {
      writable: true,
      value: originalHash,
    });
  } finally {
    // 念のため
    restoreWindowLocation();
  }
});

test("parseTokenFromHash関数がトークンがない場合はnullを返す", () => {
  try {
    // window.locationをモック
    const originalHash = window.location.hash;
    Object.defineProperty(window.location, "hash", {
      writable: true,
      value: "#other=value",
    });

    const result = parseTokenFromHash();
    expect(result).toBeNull();

    // 元に戻す
    Object.defineProperty(window.location, "hash", {
      writable: true,
      value: originalHash,
    });
  } finally {
    // 念のため
    restoreWindowLocation();
  }
});

test("clearHash関数がURLハッシュをクリアする", () => {
  try {
    // window.locationをモック
    const originalHash = window.location.hash;
    const originalPathname = window.location.pathname;

    Object.defineProperty(window.location, "hash", {
      writable: true,
      value: "#access_token=mock-token",
    });

    Object.defineProperty(window.location, "pathname", {
      writable: true,
      value: "/test-path",
    });

    // replaceStateをモック
    const originalReplaceState = window.history.replaceState;
    let replaceStateCalled = false;

    // replaceStateをモックに置き換え
    window.history.replaceState = (data, _title, url) => {
      expect(data).toBe("");
      expect(url).toBe("/test-path");
      replaceStateCalled = true;
    };

    try {
      clearHash();

      // モック関数が呼び出されたことを確認
      expect(replaceStateCalled).toBe(true);
    } finally {
      // 元に戻す
      window.history.replaceState = originalReplaceState;

      // locationも元に戻す
      Object.defineProperty(window.location, "hash", {
        writable: true,
        value: originalHash,
      });

      Object.defineProperty(window.location, "pathname", {
        writable: true,
        value: originalPathname,
      });
    }
  } finally {
    // 念のため
    restoreWindowLocation();
  }
});

test("clearHash関数がハッシュがない場合は何もしない", () => {
  try {
    // window.locationをモック
    const originalHash = window.location.hash;

    Object.defineProperty(window.location, "hash", {
      writable: true,
      value: "",
    });

    // replaceStateをモック
    const originalReplaceState = window.history.replaceState;
    let replaceStateCalled = false;

    // replaceStateをモックに置き換え
    window.history.replaceState = () => {
      replaceStateCalled = true;
    };

    try {
      clearHash();

      // モック関数が呼び出されていないことを確認
      expect(replaceStateCalled).toBe(false);
    } finally {
      // 元に戻す
      window.history.replaceState = originalReplaceState;

      // locationも元に戻す
      Object.defineProperty(window.location, "hash", {
        writable: true,
        value: originalHash,
      });
    }
  } finally {
    // 念のため
    restoreWindowLocation();
  }
});
