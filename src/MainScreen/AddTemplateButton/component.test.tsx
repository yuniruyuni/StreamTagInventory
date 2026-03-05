import { beforeAll, expect, mock, test } from "bun:test";
import { render } from "@testing-library/react";
import { userEvent } from "@testing-library/user-event";
import type React from "react";
import { I18nextProvider } from "react-i18next";
import i18n from "~/i18n/config";
import type { Template } from "~/model/template";
import { AddTemplateButton } from "./component";

// テスト用のラッパーコンポーネント
const TestWrapper: React.FC<{ children: React.ReactNode }> = ({ children }) => (
  <I18nextProvider i18n={i18n}>{children}</I18nextProvider>
);

// テスト実行前にi18nを英語に設定
beforeAll(async () => {
  await i18n.changeLanguage("en");
});

test("AddTemplateButtonコンポーネントが正しくレンダリングされる", () => {
  const onAdd = mock(() => {});

  const { getByRole } = render(<AddTemplateButton onAdd={onAdd} />, {
    wrapper: TestWrapper,
  });

  // ボタン要素が存在することを確認
  const button = getByRole("button");
  expect(button).not.toBeNull();
  expect(button).toHaveTextContent("Add");
  expect(button).toHaveClass("bg-violet-700");
});

test("ボタンをクリックすると、新しいテンプレートを作成してonAddコールバックに渡す", async () => {
  const onAdd = mock((_: Template) => {});

  const { getByRole } = render(<AddTemplateButton onAdd={onAdd} />, {
    wrapper: TestWrapper,
  });

  // ボタン要素を取得
  const button = getByRole("button");
  expect(button).not.toBeNull();

  const user = userEvent.setup();
  await user.click(button);

  // onAddが呼び出されたことを確認
  expect(onAdd).toHaveBeenCalledTimes(1);

  // 呼び出し時の引数を検証
  const callArg = onAdd.mock.calls[0][0];

  // テンプレートの構造を検証
  expect(callArg).toEqual({
    id: callArg.id, // ignore for random id generation.
    title: "",
    tags: [],
    category: {
      id: "",
      name: "",
      box_art_url: "",
    },
  });

  // 新しいテンプレートであることを確認
  expect(typeof callArg.id).toBe("string");
  expect(callArg.id.length).toBeGreaterThan(0);
});
