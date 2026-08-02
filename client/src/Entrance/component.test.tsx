import { beforeAll, expect, test } from "bun:test";
import { render } from "@testing-library/react";
import { I18nextProvider } from "react-i18next";
import i18n from "~/i18n/config";
import { Entrance } from "./component";

beforeAll(() => {
  i18n.changeLanguage("en");
});

test("ログイン前でもサードパーティライセンスページへ移動できる", () => {
  const { getByText } = render(
    <I18nextProvider i18n={i18n}>
      <Entrance uri="https://id.twitch.tv/oauth2/authorize" />
    </I18nextProvider>,
  );

  const licensesLink = getByText("Third-party licenses").closest("a");
  expect(licensesLink?.getAttribute("href")).toBe("/third-party-licenses.html");
});
