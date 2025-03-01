import { expect, test } from "bun:test";
import { renderComponent, setupTestEnvironment } from "../../test-utils";
import { TagList } from "./component";

// テスト環境のセットアップ
setupTestEnvironment();

test("TagListコンポーネントが空の配列の場合、何も表示しない", () => {
  const tags: string[] = [];
  const onClose = () => {};

  const root = renderComponent(<TagList tags={tags} onClose={onClose} />);

  // タグ要素が存在しないことを確認
  const tagElements = root?.querySelectorAll(
    "span[id='badge-dismiss-default']",
  );
  expect(tagElements?.length).toBe(0);
});

test("TagListコンポーネントがタグを正しくレンダリングする", () => {
  const tags = ["タグ1", "タグ2", "タグ3"];
  const onClose = () => {};

  const root = renderComponent(<TagList tags={tags} onClose={onClose} />);

  // タグの数を確認
  const tagElements = root?.querySelectorAll(
    "span[id='badge-dismiss-default']",
  );
  expect(tagElements?.length).toBe(3);

  // タグのテキストを確認
  expect(tagElements?.[0].textContent).toContain("タグ1");
  expect(tagElements?.[1].textContent).toContain("タグ2");
  expect(tagElements?.[2].textContent).toContain("タグ3");
});

test("タグの閉じるボタンをクリックすると、onClose関数が呼び出される", () => {
  const tags = ["タグ1", "タグ2", "タグ3"];
  let closedIndex = -1;
  const onClose = (index: number) => {
    closedIndex = index;
  };

  const root = renderComponent(<TagList tags={tags} onClose={onClose} />);

  // 2番目のタグの閉じるボタンを取得
  const closeButtons = root?.querySelectorAll("button");
  expect(closeButtons?.length).toBe(3);

  // 2番目のタグの閉じるボタンをクリック
  closeButtons?.[1].click();

  // onCloseが正しいインデックスで呼び出されたか確認
  expect(closedIndex).toBe(1);
});
