import { expect, test } from "bun:test";
import { renderComponent, setupTestEnvironment } from "../../test-utils";
import { TagInput } from "./component";

// テスト環境のセットアップ
setupTestEnvironment();

test("TagInputコンポーネントが正しくレンダリングされる", () => {
  const onKeyDown = () => {};
  const onFocus = () => {};
  const onBlur = () => {};

  const root = renderComponent(
    <TagInput onKeyDown={onKeyDown} onFocus={onFocus} onBlur={onBlur} />,
  );

  const input = root?.querySelector("input");
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

  const root = renderComponent(
    <TagInput onKeyDown={onKeyDown} onFocus={onFocus} onBlur={onBlur} />,
  );

  const input = root?.querySelector("input");
  expect(input).not.toBeNull();

  // フォーカスイベントをシミュレート
  input?.focus();

  expect(focusCalled).toBe(true);
});

test("ブラー時にonBlur関数が呼び出される", () => {
  const onKeyDown = () => {};
  const onFocus = () => {};
  let blurCalled = false;
  const onBlur = () => {
    blurCalled = true;
  };

  const root = renderComponent(
    <TagInput onKeyDown={onKeyDown} onFocus={onFocus} onBlur={onBlur} />,
  );

  const input = root?.querySelector("input");
  expect(input).not.toBeNull();

  // フォーカスしてからブラーイベントをシミュレート
  input?.focus();
  input?.blur();

  expect(blurCalled).toBe(true);
});
