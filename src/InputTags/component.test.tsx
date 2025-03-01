import { expect, test } from "bun:test";
import { renderComponent, setupTestEnvironment } from "../test-utils";
import { InputTags } from "./component";

// テスト環境のセットアップ
setupTestEnvironment();

test("InputTagsコンポーネントが初期タグを正しくレンダリングする", () => {
  const tags = ["タグ1", "タグ2", "タグ3"];
  const onChange = () => {};

  const root = renderComponent(<InputTags tags={tags} onChange={onChange} />);

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

test("閉じるボタンをクリックしてタグを削除できる", () => {
  const tags = ["タグ1", "タグ2", "タグ3"];
  let newTags: string[] = [];
  const onChange = (updatedTags: string[]) => {
    newTags = updatedTags;
  };

  const root = renderComponent(<InputTags tags={tags} onChange={onChange} />);

  // 2番目のタグの閉じるボタンを取得
  const closeButtons = root?.querySelectorAll("button");
  expect(closeButtons?.length).toBe(3);

  // 2番目のタグの閉じるボタンをクリック
  closeButtons?.[1].click();

  // onChangeが正しく呼び出されたか確認
  expect(newTags).toEqual(["タグ1", "タグ3"]);
});
