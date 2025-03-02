import { expect, test } from "bun:test";
import { fireEvent, render, setupTestEnvironment } from "../../test-utils";
import { TagInput } from "./component";

// テスト環境のセットアップ
setupTestEnvironment();

test("TagInputコンポーネントが正しくレンダリングされる", () => {
  const onKeyDown = () => {};
  const onFocus = () => {};
  const onBlur = () => {};

  const { container } = render(
    <TagInput onKeyDown={onKeyDown} onFocus={onFocus} onBlur={onBlur} />
  );

  const input = container.querySelector("input");
  expect(input).not.toBeNull();
  expect(input?.getAttribute("type")).toBe("text");
  expect(input?.className).toContain("flex-grow");
});

test("フォーカス時にonFocus関数が呼び出される", () => {
  const onKeyDown = () => {};
  let focusCalled = false;
  const onFocus = () => {
    focusCalled = true;
  };
  const onBlur = () => {};

  const { container } = render(
    <TagInput onKeyDown={onKeyDown} onFocus={onFocus} onBlur={onBlur} />
  );

  const input = container.querySelector("input");
  expect(input).not.toBeNull();

  // フォーカスイベントをシミュレート
  if (input) {
    fireEvent.focus(input);
  }

  expect(focusCalled).toBe(true);
});

test("ブラー時にonBlur関数が呼び出される", () => {
  const onKeyDown = () => {};
  const onFocus = () => {};
  let blurCalled = false;
  const onBlur = () => {
    blurCalled = true;
  };

  const { container } = render(
    <TagInput onKeyDown={onKeyDown} onFocus={onFocus} onBlur={onBlur} />
  );

  const input = container.querySelector("input");
  expect(input).not.toBeNull();

  // フォーカスしてからブラーイベントをシミュレート
  if (input) {
    fireEvent.focus(input);
    fireEvent.blur(input);
  }

  expect(blurCalled).toBe(true);
});
