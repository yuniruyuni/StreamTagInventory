import { expect, mock, test } from "bun:test";
import { render } from "@testing-library/react";
import { userEvent } from "@testing-library/user-event";
import { TagInput } from "./component";

test("TagInputコンポーネントが正しくレンダリングされる", () => {
  const onKeyDown = mock();
  const onFocus = mock();
  const onBlur = mock();

  const { getByRole } = render(
    <TagInput onKeyDown={onKeyDown} onFocus={onFocus} onBlur={onBlur} />,
  );

  const input = getByRole("textbox");
  expect(input).not.toBeNull();
  expect(input).toHaveAttribute("type", "text");
  expect(input).toHaveClass("flex-grow");

  expect(onFocus).not.toBeCalled();
  expect(onBlur).not.toBeCalled();
});

test("フォーカス時にonFocus関数が呼び出される", async () => {
  const onKeyDown = mock();
  const onFocus = mock();
  const onBlur = mock();

  const { getByRole } = render(
    <TagInput onKeyDown={onKeyDown} onFocus={onFocus} onBlur={onBlur} />,
  );

  const user = userEvent.setup();

  const input = getByRole("textbox");
  expect(input).not.toBeNull();

  await user.click(input); // focus
  expect(onFocus).toBeCalled();
  expect(onBlur).not.toBeCalled();
});

test("ブラー時にonBlur関数が呼び出される", async () => {
  const onKeyDown = mock();
  const onFocus = mock();
  const onBlur = mock();

  const { getByRole } = render(
    <TagInput onKeyDown={onKeyDown} onFocus={onFocus} onBlur={onBlur} />,
  );

  const user = userEvent.setup();

  const input = getByRole("textbox");
  expect(input).not.toBeNull();

  await user.click(input); // focus
  expect(onFocus).toBeCalled();
  expect(onBlur).not.toBeCalled();

  await user.click(document.body); // unfocus
  expect(onBlur).toBeCalled();
});
