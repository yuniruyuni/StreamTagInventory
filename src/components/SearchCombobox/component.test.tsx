import { beforeAll, expect, mock, test } from "bun:test";
import { fireEvent, render } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import i18n from "~/i18n/config";
import { I18nWrapper } from "~/test-utils";
import { SearchCombobox } from "./component";

type Item = { id: string; name: string };

const items: Item[] = [
  { id: "1", name: "Alpha" },
  { id: "2", name: "Beta" },
  { id: "3", name: "Gamma" },
  { id: "4", name: "Apple" },
];

const getItemId = (item: Item) => item.id;
const getItemName = (item: Item) => item.name;
const renderItem = (item: Item, isSelected: boolean) => (
  <span className={isSelected ? "selected" : ""}>{item.name}</span>
);

beforeAll(async () => {
  await i18n.changeLanguage("en");
});

test("初期状態でドロップダウンが表示されない", () => {
  const onSelect = mock();
  const onQueryChange = mock();

  const { queryByTestId } = render(
    <SearchCombobox
      items={items}
      value={undefined}
      query=""
      onQueryChange={onQueryChange}
      onSelect={onSelect}
      getItemId={getItemId}
      getItemName={getItemName}
      renderItem={renderItem}
      placeholder="Search..."
    />,
    { wrapper: I18nWrapper },
  );

  expect(queryByTestId("combobox-dropdown")).toBeNull();
});

test("フォーカスでitemsありのドロップダウンが表示される", () => {
  const onSelect = mock();
  const onQueryChange = mock();

  const { getByPlaceholderText, getByTestId } = render(
    <SearchCombobox
      items={items}
      value={undefined}
      query=""
      onQueryChange={onQueryChange}
      onSelect={onSelect}
      getItemId={getItemId}
      getItemName={getItemName}
      renderItem={renderItem}
      placeholder="Search..."
    />,
    { wrapper: I18nWrapper },
  );

  fireEvent.focus(getByPlaceholderText("Search..."));

  expect(getByTestId("combobox-dropdown")).not.toBeNull();
});

test("フォーカスでitemsが空の場合ドロップダウンが表示されない", () => {
  const onSelect = mock();
  const onQueryChange = mock();

  const { getByPlaceholderText, queryByTestId } = render(
    <SearchCombobox
      items={[]}
      value={undefined}
      query=""
      onQueryChange={onQueryChange}
      onSelect={onSelect}
      getItemId={getItemId}
      getItemName={getItemName}
      renderItem={renderItem}
      placeholder="Search..."
    />,
    { wrapper: I18nWrapper },
  );

  fireEvent.focus(getByPlaceholderText("Search..."));

  expect(queryByTestId("combobox-dropdown")).toBeNull();
});

test("ArrowDown + Enterで選択確定", async () => {
  const onSelect = mock();
  const onQueryChange = mock();

  const { getByPlaceholderText } = render(
    <SearchCombobox
      items={items}
      value={undefined}
      query=""
      onQueryChange={onQueryChange}
      onSelect={onSelect}
      getItemId={getItemId}
      getItemName={getItemName}
      renderItem={renderItem}
      placeholder="Search..."
    />,
    { wrapper: I18nWrapper },
  );

  const user = userEvent.setup();
  const input = getByPlaceholderText("Search...");

  await user.click(input);
  await user.keyboard("{ArrowDown}{Enter}");

  // ArrowDown moves cursor from 0 to 1 (Beta), Enter selects it
  expect(onSelect).toHaveBeenCalledWith(items[1]);
  expect(onQueryChange).toHaveBeenCalledWith("Beta");
});

test("ArrowUp index 0でwrap-around", async () => {
  const onSelect = mock();
  const onQueryChange = mock();

  const { getByPlaceholderText } = render(
    <SearchCombobox
      items={items}
      value={undefined}
      query=""
      onQueryChange={onQueryChange}
      onSelect={onSelect}
      getItemId={getItemId}
      getItemName={getItemName}
      renderItem={renderItem}
      placeholder="Search..."
    />,
    { wrapper: I18nWrapper },
  );

  const user = userEvent.setup();
  const input = getByPlaceholderText("Search...");

  await user.click(input);
  await user.keyboard("{ArrowUp}{Enter}");

  // ArrowUp from 0 wraps to last item (Apple, index 3)
  expect(onSelect).toHaveBeenCalledWith(items[3]);
  expect(onQueryChange).toHaveBeenCalledWith("Apple");
});

test("Tabでprefixサイクル", async () => {
  const onSelect = mock();
  const onQueryChange = mock();

  const { getByPlaceholderText } = render(
    <SearchCombobox
      items={items}
      value={undefined}
      query="Al"
      onQueryChange={onQueryChange}
      onSelect={onSelect}
      getItemId={getItemId}
      getItemName={getItemName}
      renderItem={renderItem}
      placeholder="Search..."
    />,
    { wrapper: I18nWrapper },
  );

  const user = userEvent.setup();
  const input = getByPlaceholderText("Search...");

  await user.click(input);
  await user.keyboard("{Tab}");

  // "Al" matches Alpha (index 0), next is Beta (index 1)
  expect(onSelect).toHaveBeenCalledWith(items[1]);
  expect(onQueryChange).toHaveBeenCalledWith("Beta");
});

test("IME composing中はキーイベントが無視される", () => {
  const onSelect = mock();
  const onQueryChange = mock();

  const { getByPlaceholderText } = render(
    <SearchCombobox
      items={items}
      value={undefined}
      query=""
      onQueryChange={onQueryChange}
      onSelect={onSelect}
      getItemId={getItemId}
      getItemName={getItemName}
      renderItem={renderItem}
      placeholder="Search..."
    />,
    { wrapper: I18nWrapper },
  );

  const input = getByPlaceholderText("Search...");
  fireEvent.focus(input);

  // Simulate IME composing Enter via native KeyboardEvent
  input.dispatchEvent(
    new KeyboardEvent("keydown", {
      key: "Enter",
      bubbles: true,
      isComposing: true,
    }),
  );

  expect(onSelect).not.toHaveBeenCalled();
});

test("mousedownでonSelectが呼ばれblurしない", () => {
  const onSelect = mock();
  const onQueryChange = mock();

  const { getByPlaceholderText, getByTestId } = render(
    <SearchCombobox
      items={items}
      value={undefined}
      query=""
      onQueryChange={onQueryChange}
      onSelect={onSelect}
      getItemId={getItemId}
      getItemName={getItemName}
      renderItem={renderItem}
      placeholder="Search..."
    />,
    { wrapper: I18nWrapper },
  );

  const input = getByPlaceholderText("Search...");
  fireEvent.focus(input);

  const dropdown = getByTestId("combobox-dropdown");
  const buttons = dropdown.querySelectorAll("button");
  fireEvent.mouseDown(buttons[2]); // Gamma

  expect(onSelect).toHaveBeenCalledWith(items[2]);
  expect(onQueryChange).toHaveBeenCalledWith("Gamma");
});

test("renderSelectedありでサムネイルオーバーレイが表示される", () => {
  const onSelect = mock();
  const onQueryChange = mock();
  const renderSelected = (v: Item | undefined) =>
    v ? <img data-testid="selected-thumb" alt={v.name} /> : null;

  const { getByTestId } = render(
    <SearchCombobox
      items={items}
      value={items[0]}
      query="Alpha"
      onQueryChange={onQueryChange}
      onSelect={onSelect}
      getItemId={getItemId}
      getItemName={getItemName}
      renderItem={renderItem}
      renderSelected={renderSelected}
      placeholder="Search..."
    />,
    { wrapper: I18nWrapper },
  );

  expect(getByTestId("selected-thumb")).not.toBeNull();
});

test("renderSelectedなしでサムネイルオーバーレイが非表示", () => {
  const onSelect = mock();
  const onQueryChange = mock();

  const { queryByTestId } = render(
    <SearchCombobox
      items={items}
      value={items[0]}
      query="Alpha"
      onQueryChange={onQueryChange}
      onSelect={onSelect}
      getItemId={getItemId}
      getItemName={getItemName}
      renderItem={renderItem}
      placeholder="Search..."
    />,
    { wrapper: I18nWrapper },
  );

  expect(queryByTestId("selected-thumb")).toBeNull();
});
