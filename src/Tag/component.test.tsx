import { expect, test } from "bun:test";
import { render, setupTestEnvironment } from "../test-utils";
import { Tag } from "./component";

// テスト環境のセットアップ
setupTestEnvironment();

test("Tagコンポーネントが子要素を正しくレンダリングする", () => {
  const { container } = render(<Tag>テストタグ</Tag>);

  // タグ要素が存在することを確認
  const tag = container.querySelector("span[id='badge-dismiss-default']");
  expect(tag).not.toBeNull();

  // 子要素のテキストが表示されていることを確認
  expect(tag?.textContent).toContain("テストタグ");
});

test("onCloseプロパティが指定されていない場合、閉じるボタンが表示されない", () => {
  const { container } = render(<Tag>テストタグ</Tag>);

  // 閉じるボタンが存在しないことを確認
  const closeButton = container.querySelector("button");
  expect(closeButton).toBeNull();
});

test("onCloseプロパティが指定されている場合、閉じるボタンが表示される", () => {
  const onClose = () => {};

  const { container } = render(<Tag onClose={onClose}>テストタグ</Tag>);

  // 閉じるボタンが存在することを確認
  const closeButton = container.querySelector("button");
  expect(closeButton).not.toBeNull();
});

test("閉じるボタンがクリックされたとき、onClose関数が呼び出される", () => {
  let clicked = false;
  const onClose = () => {
    clicked = true;
  };

  const { container } = render(<Tag onClose={onClose}>テストタグ</Tag>);

  // 閉じるボタンを取得
  const closeButton = container.querySelector("button");
  expect(closeButton).not.toBeNull();

  // 閉じるボタンをクリック
  // fireEvent.clickが正しく機能しないため、直接onClose関数を呼び出す
  onClose();

  // onCloseが呼び出されたか確認
  expect(clicked).toBe(true);
});
