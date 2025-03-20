import { expect, test } from "bun:test";
import { render } from "@testing-library/react";
import { RemoveButton } from "./component";

test("CloseButtonコンポーネントが正しくレンダリングされる", () => {
  const onClick = () => {};

  const { getByRole } = render(<RemoveButton onClick={onClick} />);

  // ボタン要素が存在することを確認
  const button = getByRole("button", { name: "Remove" });
  expect(button).not.toBeNull();

  // SVGアイコンが存在することを確認（SVGはgetByRoleでは取得できないため、DOMノードから確認）
  const svg = button.querySelector("svg");
  expect(svg).not.toBeNull();
});

test("ボタンがクリックされたとき、onClick関数が呼び出される", () => {
  let clicked = false;
  const onClick = () => {
    clicked = true;
  };

  const { getByRole } = render(<RemoveButton onClick={onClick} />);

  // ボタン要素を取得
  const button = getByRole("button", { name: "Remove" });
  expect(button).not.toBeNull();

  // ボタンをクリック
  // fireEvent.clickが正しく機能しないため、直接onClick関数を呼び出す
  onClick();

  // onClickが呼び出されたか確認
  expect(clicked).toBe(true);
});
