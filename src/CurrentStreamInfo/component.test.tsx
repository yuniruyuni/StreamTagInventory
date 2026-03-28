import { beforeAll, expect, mock, test } from "bun:test";
import { render } from "@testing-library/react";
import { userEvent } from "@testing-library/user-event";
import type React from "react";
import { I18nextProvider } from "react-i18next";
import i18n from "~/i18n/config";
import type { Category } from "~/model/category";
import type { ChannelInfo } from "~/model/channel";
import { CurrentStreamInfo } from "./component";

const TestWrapper: React.FC<{ children: React.ReactNode }> = ({ children }) => (
  <I18nextProvider i18n={i18n}>{children}</I18nextProvider>
);

beforeAll(async () => {
  await i18n.changeLanguage("en");
});

const mockChannelInfo: ChannelInfo = {
  broadcaster_id: "123",
  broadcaster_name: "testuser",
  broadcaster_language: "en",
  game_name: "Just Chatting",
  game_id: "509658",
  title: "Test Stream Title",
  tags: ["English", "Chill"],
};

const mockCategory: Category = {
  id: "509658",
  name: "Just Chatting",
  box_art_url: "https://example.com/boxart-{width}x{height}.jpg",
};

test("ローディング中にスケルトンが表示される", () => {
  const { container } = render(
    <CurrentStreamInfo
      channelInfo={undefined}
      category={undefined}
      isLoading={true}
      onImportAsTemplate={() => {}}
    />,
    { wrapper: TestWrapper },
  );

  const skeleton = container.querySelector(".animate-pulse");
  expect(skeleton).not.toBeNull();
});

test("channelInfoがundefinedの場合は何も表示しない", () => {
  const { container } = render(
    <CurrentStreamInfo
      channelInfo={undefined}
      category={undefined}
      isLoading={false}
      onImportAsTemplate={() => {}}
    />,
    { wrapper: TestWrapper },
  );

  expect(container.innerHTML).toBe("");
});

test("配信情報が正しく表示される", () => {
  const { getByText } = render(
    <CurrentStreamInfo
      channelInfo={mockChannelInfo}
      category={mockCategory}
      isLoading={false}
      onImportAsTemplate={() => {}}
    />,
    { wrapper: TestWrapper },
  );

  expect(getByText("Current Stream")).not.toBeNull();
  expect(getByText("Test Stream Title")).not.toBeNull();
  expect(getByText("Just Chatting")).not.toBeNull();
  expect(getByText("English")).not.toBeNull();
  expect(getByText("Chill")).not.toBeNull();
});

test("カテゴリサムネイルが表示される", () => {
  const { container } = render(
    <CurrentStreamInfo
      channelInfo={mockChannelInfo}
      category={mockCategory}
      isLoading={false}
      onImportAsTemplate={() => {}}
    />,
    { wrapper: TestWrapper },
  );

  const img = container.querySelector("img");
  expect(img).not.toBeNull();
  expect(img?.src).toBe("https://example.com/boxart-52x72.jpg");
  expect(img?.alt).toBe("Just Chatting");
});

test("カテゴリがない場合サムネイルが表示されない", () => {
  const { container } = render(
    <CurrentStreamInfo
      channelInfo={mockChannelInfo}
      category={undefined}
      isLoading={false}
      onImportAsTemplate={() => {}}
    />,
    { wrapper: TestWrapper },
  );

  const img = container.querySelector("img");
  expect(img).toBeNull();
});

test("タイトルが空の場合フォールバックテキストが表示される", () => {
  const channelInfoNoTitle: ChannelInfo = {
    ...mockChannelInfo,
    title: "",
  };

  const { getByText } = render(
    <CurrentStreamInfo
      channelInfo={channelInfoNoTitle}
      category={mockCategory}
      isLoading={false}
      onImportAsTemplate={() => {}}
    />,
    { wrapper: TestWrapper },
  );

  expect(getByText("No title set")).not.toBeNull();
});

test("カテゴリ名が空の場合フォールバックテキストが表示される", () => {
  const channelInfoNoCategory: ChannelInfo = {
    ...mockChannelInfo,
    game_name: "",
    game_id: "",
  };

  const { getByText } = render(
    <CurrentStreamInfo
      channelInfo={channelInfoNoCategory}
      category={undefined}
      isLoading={false}
      onImportAsTemplate={() => {}}
    />,
    { wrapper: TestWrapper },
  );

  expect(getByText("No category set")).not.toBeNull();
});

test("タグがない場合タグセクションが表示されない", () => {
  const channelInfoNoTags: ChannelInfo = {
    ...mockChannelInfo,
    tags: [],
  };

  const { container } = render(
    <CurrentStreamInfo
      channelInfo={channelInfoNoTags}
      category={mockCategory}
      isLoading={false}
      onImportAsTemplate={() => {}}
    />,
    { wrapper: TestWrapper },
  );

  const badges = container.querySelectorAll(".rounded-full.font-medium");
  expect(badges.length).toBe(0);
});

test("スケルトンとロード後のレイアウト構造が一致する", () => {
  // レイアウトに影響するCSSクラスのセレクタ。
  // スケルトンとロード後の両方に存在しなければレイアウトシフトが発生する。
  const layoutSelectors = [
    ".w-full.bg-slate-50.rounded-lg.p-4", // 外枠
    ".flex.items-center.justify-between.mb-2", // ヘッダー行
    ".flex.gap-4.items-start", // コンテンツ行
    ".flex-1.min-w-0", // テキスト領域
  ];

  const { container: skeletonContainer } = render(
    <CurrentStreamInfo
      channelInfo={undefined}
      category={undefined}
      isLoading={true}
      onImportAsTemplate={() => {}}
    />,
    { wrapper: TestWrapper },
  );

  const { container: loadedContainer } = render(
    <CurrentStreamInfo
      channelInfo={mockChannelInfo}
      category={mockCategory}
      isLoading={false}
      onImportAsTemplate={() => {}}
    />,
    { wrapper: TestWrapper },
  );

  for (const selector of layoutSelectors) {
    expect(skeletonContainer.querySelector(selector)).not.toBeNull();
    expect(loadedContainer.querySelector(selector)).not.toBeNull();
  }
});

test("テンプレートとして取り込むボタンをクリックするとコールバックが呼ばれる", async () => {
  const onImport = mock(() => {});

  const { getByText } = render(
    <CurrentStreamInfo
      channelInfo={mockChannelInfo}
      category={mockCategory}
      isLoading={false}
      onImportAsTemplate={onImport}
    />,
    { wrapper: TestWrapper },
  );

  const button = getByText("Import as Template");
  const user = userEvent.setup();
  await user.click(button);

  expect(onImport).toHaveBeenCalledTimes(1);
});
