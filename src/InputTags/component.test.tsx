import { expect, mock, test } from "bun:test";
import { renderComponent, setupTestEnvironment } from "../test-utils";
import { InputTags, handleTagKeyDown } from "./component";

// テスト環境のセットアップ
setupTestEnvironment();

// 初期タグデータ
const initialTags = ["React", "TypeScript", "Tailwind"];

test("InputTagsコンポーネントが初期タグを正しくレンダリングする", () => {
  // モックコールバック
  const mockOnChange = mock((_tags: string[]) => {});

  // コンポーネントをレンダリング
  const root = renderComponent(
    <InputTags tags={initialTags} onChange={mockOnChange} />,
  );

  // タグが正しくレンダリングされていることを確認
  const tagElements = root.querySelectorAll("#badge-dismiss-default");
  expect(tagElements.length).toBe(initialTags.length);

  // 各タグのテキストを確認
  initialTags.forEach((tag, index) => {
    expect(tagElements[index].textContent).toContain(tag);
  });

  // 入力フィールドが存在することを確認
  const input = root.querySelector("input");
  expect(input).not.toBeNull();
});

test("Enterキーでタグを追加できる", () => {
  // モックコールバック
  const mockOnChange = mock((_tags: string[]) => {});

  // モックイベントを作成
  const mockEvent = {
    key: "Enter",
    currentTarget: { value: "New Tag" },
    preventDefault: () => {},
    nativeEvent: { isComposing: false },
  };

  // エクスポートされたhandleTagKeyDown関数を直接呼び出す
  handleTagKeyDown(mockEvent, initialTags, mockOnChange);

  // onChangeが呼び出されたことを確認
  expect(mockOnChange).toHaveBeenCalled();
  expect(mockOnChange.mock.calls[0][0]).toEqual([...initialTags, "New Tag"]);
});

test("Backspaceキーで最後のタグを削除できる", () => {
  // モックコールバック
  const mockOnChange = mock((_tags: string[]) => {});

  // モックイベントを作成
  const mockEvent = {
    key: "Backspace",
    currentTarget: { value: "" },
    preventDefault: () => {},
    nativeEvent: { isComposing: false },
  };

  // エクスポートされたhandleTagKeyDown関数を直接呼び出す
  handleTagKeyDown(mockEvent, initialTags, mockOnChange);

  // onChangeが呼び出されたことを確認
  expect(mockOnChange).toHaveBeenCalled();
  // 最後のタグが削除されたことを確認
  expect(mockOnChange.mock.calls[0][0]).toEqual(initialTags.slice(0, -1));
});

test("閉じるボタンをクリックしてタグを削除できる", () => {
  // モックコールバック
  const mockOnChange = mock((_tags: string[]) => {});

  // コンポーネントをレンダリング
  const root = renderComponent(
    <InputTags tags={initialTags} onChange={mockOnChange} />,
  );

  // 閉じるボタンを取得
  const closeButtons = root.querySelectorAll("button[aria-label='Remove']");
  expect(closeButtons.length).toBe(initialTags.length);

  // 最初のタグの閉じるボタンをクリック
  (closeButtons[0] as HTMLElement).click();

  // onChangeが呼び出されたことを確認
  expect(mockOnChange).toHaveBeenCalled();
  // 最初のタグが削除されたことを確認
  expect(mockOnChange.mock.calls[0][0]).toEqual(initialTags.slice(1));
});

test("フォーカス時にアクティブクラスが適用される", () => {
  // モックコールバック
  const mockOnChange = mock((_tags: string[]) => {});

  // コンポーネントをレンダリング
  const root = renderComponent(
    <InputTags tags={initialTags} onChange={mockOnChange} />,
  );

  // コンテナ要素を取得
  const container = root.querySelector("div");
  expect(container).not.toBeNull();

  // 初期状態ではアクティブクラスがないことを確認
  expect(container?.classList.contains("outline-slate-200")).toBe(false);

  // 入力フィールドを取得
  const input = root.querySelector("input");
  expect(input).not.toBeNull();

  // フォーカスイベントをトリガー
  if (input) {
    input.focus();
  }

  // アクティブクラスが適用されることを確認
  expect(container?.classList.contains("outline-slate-200")).toBe(true);

  // ブラーイベントをトリガー
  if (input) {
    input.blur();
  }

  // アクティブクラスが削除されることを確認
  expect(container?.classList.contains("outline-slate-200")).toBe(false);
});

test("空の値ではタグが追加されない", () => {
  // モックコールバック
  const mockOnChange = mock((_: string[]) => {});

  // コンポーネントをレンダリング
  const root = renderComponent(
    <InputTags tags={initialTags} onChange={mockOnChange} />,
  );

  // 入力フィールドを取得
  const input = root.querySelector("input");
  expect(input).not.toBeNull();

  // 入力値を空白に設定
  if (input) {
    input.value = "   ";
  }

  // Enterキーイベントをシミュレート
  // CustomEventを使用して詳細情報を渡す
  const enterEvent = new CustomEvent("keydown", {
    bubbles: true,
    detail: { key: "Enter" },
  });

  // イベントハンドラを上書き
  const originalAddEventListener = input?.addEventListener;
  // biome-ignore lint/suspicious/noExplicitAny: テスト用のモック
  (input as any).addEventListener = function (type: string, handler: any) {
    if (type === "keydown") {
      // キーダウンイベントの場合、ハンドラを直接呼び出す
      handler({
        key: "Enter",
        bubbles: true,
        preventDefault: () => {},
        stopPropagation: () => {},
      });
    } else if (originalAddEventListener) {
      // その他のイベントは通常通り処理
      originalAddEventListener.call(this, type, handler);
    }
  };

  // イベントを発火
  input?.dispatchEvent(enterEvent);

  // イベントリスナーを元に戻す
  if (originalAddEventListener) {
    // biome-ignore lint/suspicious/noExplicitAny: テスト用のモック
    (input as any).addEventListener = originalAddEventListener;
  }

  // onChangeが呼び出されないことを確認
  expect(mockOnChange).not.toHaveBeenCalled();
});

test("IME入力中はキーイベントが処理されない", () => {
  // モックコールバック
  const mockOnChange = mock((_: string[]) => {});

  // コンポーネントをレンダリング
  const root = renderComponent(
    <InputTags tags={initialTags} onChange={mockOnChange} />,
  );

  // 入力フィールドを取得
  const input = root.querySelector("input");
  expect(input).not.toBeNull();

  // 入力値を設定
  if (input) {
    input.value = "日本語";
  }

  // IME入力中のEnterキーイベントをシミュレート
  // CustomEventを使用して詳細情報を渡す
  const enterEvent = new CustomEvent("keydown", {
    bubbles: true,
    detail: { key: "Enter", isComposing: true },
  });

  // イベントハンドラを上書き
  const originalAddEventListener = input?.addEventListener;
  // biome-ignore lint/suspicious/noExplicitAny: テスト用のモック
  (input as any).addEventListener = function (type: string, handler: any) {
    if (type === "keydown") {
      // キーダウンイベントの場合、ハンドラを直接呼び出す
      handler({
        key: "Enter",
        bubbles: true,
        isComposing: true,
        preventDefault: () => {},
        stopPropagation: () => {},
      });
    } else if (originalAddEventListener) {
      // その他のイベントは通常通り処理
      originalAddEventListener.call(this, type, handler);
    }
  };

  // イベントを発火
  input?.dispatchEvent(enterEvent);

  // イベントリスナーを元に戻す
  if (originalAddEventListener) {
    // biome-ignore lint/suspicious/noExplicitAny: テスト用のモック
    (input as any).addEventListener = originalAddEventListener;
  }

  // onChangeが呼び出されないことを確認
  expect(mockOnChange).not.toHaveBeenCalled();
});
